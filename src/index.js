const axios = require('axios')
const fetch = require('node-fetch').default;
const goenv = require('go-platform')
const gunzip = require('gunzip-maybe')
const Path = require('path')
const tarFS = require('tar-fs')
const tarStream = require('tar-stream')
const unzip = require('unzip-stream')
const os = require('os')
const fs = require('fs')

const goIpfsPaths = [
    Path.resolve(Path.join(__dirname, '..', 'go-ipfs', 'ipfs')),
    Path.resolve(Path.join(__dirname, '..', 'go-ipfs', 'ipfs.exe')),
    Path.resolve(Path.join(__dirname, '..', '..', 'go-ipfs', 'bin', 'ipfs')),
    Path.resolve(Path.join(__dirname, '..', '..', 'go-ipfs', 'bin', 'ipfs.exe')),
    Path.resolve(Path.join(__dirname, '..', 'node_modules', 'go-ipfs', 'go-ipfs', 'ipfs.exe')),
    Path.resolve(Path.join(__dirname, '..', 'node_modules', 'go-ipfs', 'go-ipfs', 'ipfs')),
    Path.resolve(Path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'go-ipfs', 'go-ipfs', 'ipfs.exe')),
    Path.resolve(Path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'go-ipfs', 'go-ipfs', 'ipfs')),
    Path.resolve(Path.join(__dirname, '..', '..', '..', '..', '..', 'go-ipfs', 'go-ipfs', 'ipfs.exe')),
    Path.resolve(Path.join(__dirname, '..', '..', '..', '..', '..', 'go-ipfs', 'go-ipfs', 'ipfs'))
]
let devIpfsPath;
for (const bin of goIpfsPaths) {
    if (fs.existsSync(bin)) {
        devIpfsPath = bin;
    }
}
const ipfsDistUrls = ["ipfs.3speak.tv", "ipfs.tech", "cloudflare-ipfs.com"].map(e => (`https://${e}/ipns/dist.ipfs.io`))


function unpack(url, installPath, stream) {
    return new Promise((resolve, reject) => {
        if (url.endsWith('.zip')) {
            /*return stream.pipe(
                unzip
                    .Extract({ path: installPath })
                    .on('close', resolve)
                    .on('error', reject)
            )*/
            return stream.pipe(
                unzip.Parse())
                    .on('entry', function(entry) {
                        var filePath = entry.path;
                        if (filePath === "go-ipfs/ipfs.exe") {
                            entry.pipe(fs.createWriteStream(Path.join(installPath)));
                        } else {
                            entry.autodrain();
                        }
                    })
                    .on('close', resolve)
                    .on('error', reject)
        }

        var tar = tarStream.extract()
        tar.on('entry', async function(header, stream, next) {
            // header is the tar header
            // stream is the content body (might be an empty stream)
            // call next when you are done with this entry
            if(header.name === "go-ipfs/ipfs") {
                await new Promise((resolve2, reject2) => {
                    stream.pipe(fs.createWriteStream(Path.join(installPath))).on('ready', resolve2).on('error', reject2)
                })
            }
            stream.on('end', function() {
                next() // ready for next entry
            })
            
            stream.resume() // just auto drain the stream
        }).on('finish', resolve).on('error', reject)
        return stream
            .pipe(gunzip())
            .pipe(tar)
    })
}

function cleanArguments(version, platform, arch, installPath) {
    const conf = pkgConf.sync('go-ipfs', {
        cwd: process.env.INIT_CWD || process.cwd(),
        defaults: {
            version: 'v' + pkg.version.replace(/-[0-9]+/, ''),
            distUrl: ipfsDistUrl
        }
    })

    return {
        version: process.env.TARGET_VERSION || version || conf.version,
        platform: process.env.TARGET_OS || platform || goenv.GOOS,
        arch: process.env.TARGET_ARCH || arch || goenv.GOARCH,
        distUrl: process.env.GO_IPFS_DIST_URL || conf.distUrl,
        installPath: installPath ? Path.resolve(installPath) : process.cwd()
    }
}

async function ensureVersion(version, distUrl) {
    const res = await fetch(`${distUrl}/go-ipfs/versions`)
    console.info(`${distUrl}/go-ipfs/versions`)
    if (!res.ok) {
        throw new Error(`Unexpected status: ${res.status}`)
    }

    const versions = (await res.text()).trim().split('\n')

    if (versions.indexOf(version) === -1) {
        throw new Error(`Version '${version}' not available`)
    }
}


async function getDownloadURL(version, platform, arch, distUrl) {
    await ensureVersion(version, distUrl)

    const res = await fetch(`${distUrl}/go-ipfs/${version}/dist.json`)
    if (!res.ok) throw new Error(`Unexpected status: ${res.status}`)
    const data = await res.json()

    if (!data.platforms[platform]) {
        throw new Error(`No binary available for platform '${platform}'`)
    }

    if (!data.platforms[platform].archs[arch]) {
        throw new Error(`No binary available for arch '${arch}'`)
    }

    const link = data.platforms[platform].archs[arch].link
    return `${distUrl}/go-ipfs/${version}${link}`
}
async function download({ version, platform, arch, installPath, distUrl, progressHandler }) {
    const url = await getDownloadURL(version, platform, arch, distUrl)

    console.info(`Downloading ${url}`)


    const data = await axios.head(url)
    
    const res = await fetch(url)

    if (!res.ok) {
        throw new Error(`Unexpected status: ${res.status}`)
    }

    console.info(`Downloaded ${url}`)

    let totalSize = 0;
    res.body.on('data', (e) => {
        totalSize = e.length + totalSize;
        const pct = totalSize / Number(data.headers['content-length']);
        if(progressHandler) {
            progressHandler(Math.round(pct * 100))
        }
    })

    await unpack(url, installPath, res.body)

    console.info(`Unpacked ${installPath}`)

    return Path.join(installPath/*, `ipfs${platform === 'windows' ? '.exe' : ''}`*/)
}
/**
 * Creates a directory and the path to the directory if necessary
 * Use instead of mkDirSync(dir, {recursive: true})
 * Issue: https://github.com/nodejs/node/issues/27293#issuecomment-521986527
 * @param {string} dir
 */
const mkdirRecursive = dir => {
    if (fs.existsSync(dir)) return
    const dirname = Path.dirname(dir)
    mkdirRecursive(dirname);
    fs.mkdirSync(dir);
  }
  
module.exports = class {
    static getDefaultPath({dev} = {}) {
        if(dev === true) {
            if(fs.existsSync(devIpfsPath)) {
                return devIpfsPath;
            } else {
                throw new Error("IPFS is not installed (dev mode)");
            }
        }
        switch(goenv.GOOS) {
            case "windows": {
                return Path.join(os.homedir(), "AppData/Roaming/Microsoft/Windows/Start Menu/Programs/go-ipfs/ipfs.exe");
            }
            case "darwin": {
                return  Path.join(os.homedir(), "Applications/go-ipfs/ipfs");
            }
            case "linux": {
                return  Path.join(os.homedir(), "bin/go-ipfs/ipfs");
            }
        }
    }
    /**
     * @throws {Error} If IPFS is not installed on the given path.
     */
    static async getPath(path) {
        if(fs.existsSync(path)) {
            return path;
        } else {
            throw new Error("IPFS is not installed");
        }
    }
    /**
     * Installs IPFS. 
     * @param {{version, path}}
     * @returns {String} IPFS Executable Path
     */
    static async install({ version, installPath, progressHandler, recursive, dev } = {}) {
        let ipfsDistUrl;
        for(let url of ipfsDistUrls) {
            try {
                const {headers} = await axios.head(url)
                if(headers['x-ipfs-roots']) {
                    ipfsDistUrl = url;
                    break;
                }
            } catch {

            }
        }
        if (!version) {
            console.warn("[Warn] IPFS version not specified. Installing latest... This may cause unexpected behaviour")
            const data = (await axios.get(`${ipfsDistUrl}/go-ipfs/versions`)).data;
            const versions = data.split("\n");
            versions.pop();
            version = versions[versions.length - 1];
        }
        if(!recursive) {
            recursive = false
        }
        if(!installPath) {
            installPath = this.getDefaultPath();
        }
        if(dev === true) {
            if(fs.existsSync(devIpfsPath)) {
                return devIpfsPath;
            } else {
                throw new Error("IPFS is not installed (dev mode)");
            }
        }
        if(!fs.existsSync(Path.dirname(installPath))) {
            if(recursive === true) {
                mkdirRecursive(Path.dirname(installPath))
            } else {
                fs.mkdirSync(Path.dirname(installPath))
            }
        }
        var outPath = await download({
            version, 
            platform: goenv.GOOS, 
            arch: goenv.GOARCH, 
            installPath,
            distUrl:ipfsDistUrl,
            progressHandler
        })
        if(goenv.GOOS === "darwin" || goenv.GOOS === "linux") {
            fs.chmodSync(outPath, 755)
        }
        return outPath
    }
}
