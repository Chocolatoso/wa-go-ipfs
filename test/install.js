const goIPFS = require('../src/index');
const assert = require('assert');
const fs = require('fs');
const Tmp = require('tmp');
const Path = require('path')
describe("go-ipfs", function() {
    this.timeout(240000);
    it("Install - temp path", async() => {
        var tempPath = Path.join(Tmp.dirSync().name, "ipfs");
        const realPath = await goIPFS.install({installPath:tempPath, recursive: true})
        assert.strictEqual(realPath, tempPath)
        assert.strictEqual(fs.existsSync(realPath), true)
    })
    it("Install - default path", async() => {
        const realPath = await goIPFS.install({recursive: true})
        assert.strictEqual(fs.existsSync(realPath), true)
    })
})