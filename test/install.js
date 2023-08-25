const goIPFS = require('../src/index');
const assert = require('assert');
const fs = require('fs');
const Tmp = require('tmp');
const Path = require('path')
describe("kubo", function() {
    this.timeout(240000);
    it("Install - temp path", async() => {
        var tempPath = Path.join(Tmp.dirSync().name, "ipfs");
        const realPath = await goIPFS.install({installPath:tempPath, recursive: true, dev: false, version: 'v0.16.0'})
        assert.strictEqual(realPath, tempPath)
        assert.strictEqual(fs.existsSync(realPath), true)
    })
    it("Install - default path", async() => {
        const realPath = await goIPFS.install({recursive: true, dev: false, version: 'v0.16.0'})
        assert.strictEqual(fs.existsSync(realPath), true)
    })
    it("Install - dev mode", async() => {
        const realPath = await goIPFS.install({recursive: true, dev: true, version: 'v0.16.0'})
        assert.strictEqual(fs.existsSync(realPath), true)
    })
})
