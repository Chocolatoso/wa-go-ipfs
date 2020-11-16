const goIPFS = require('../src/index');
const assert = require('assert');
const fs = require('fs');
describe("go-ipfs", function() {
    this.timeout(240000);
    it("Install", async() => {
        var str = goIPFS.getDefaultPath();
        const realPath = await goIPFS.install()
        assert.strictEqual(realPath, str)
        assert.strictEqual(fs.existsSync(realPath), true)
    })
})