import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import sc from '../src/screen.mjs'
import { imgsDir, checkScreen } from './helper.mjs'

describe('screen', function () {
    this.timeout(30000)

    let tmpFiles = []

    before(async function () {
        fs.mkdirSync(imgsDir, { recursive: true })
        if (!(await checkScreen())) this.skip()
    })

    after(function () {
        for (let fp of tmpFiles) {
            try { fs.unlinkSync(fp) }
            catch { /* ignore */ }
        }
    })

    it('screenFull: 回傳非空Buffer', async function () {
        let buf = await sc.screenFull()
        assert(Buffer.isBuffer(buf), '應回傳Buffer')
        assert(buf.length > 0, 'Buffer不應為空')
    })

    it('screenFullSave: 儲存全螢幕PNG', async function () {
        let fp = path.join(imgsDir, '_test_fullscreen.png')
        tmpFiles.push(fp)
        await sc.screenFullSave(fp)
        assert(fs.existsSync(fp), '檔案應存在')
        let meta = await sharp(fp).metadata()
        assert.strictEqual(meta.format, 'png')
        assert(meta.width > 0 && meta.height > 0)
    })

    it('screen: 回傳裁切區域Buffer', async function () {
        let buf = await sc.screen(0, 0, 200, 200)
        assert(Buffer.isBuffer(buf), '應回傳Buffer')
        assert(buf.length > 0)
    })

    it('screenSave: 儲存裁切區域PNG且尺寸正確', async function () {
        let fp = path.join(imgsDir, '_test_crop.png')
        tmpFiles.push(fp)
        await sc.screenSave(0, 0, 200, 200, fp)
        let meta = await sharp(fp).metadata()
        assert.strictEqual(meta.format, 'png')
        assert.strictEqual(meta.width, 200)
        assert.strictEqual(meta.height, 200)
    })
})
