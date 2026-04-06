import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import sc from '../src/screen.mjs'
import cp from '../src/compare.mjs'
import waitPics from '../src/waitPics.mjs'
import { testDir, imgsDir, fileUrl, checkAhk, checkScreen, launchBrowser, ensureImages } from './helper.mjs'

describe('waitPics', function () {
    this.timeout(60000)

    let browser, page
    let picDir = path.join(testDir, '_pic_wp')
    let tmpDir = path.join(testDir, '_tmp_wp')
    let screenWidth, screenHeight

    before(async function () {
        if (!checkAhk()) this.skip()
        if (!(await checkScreen())) this.skip()
        await ensureImages()
        fs.mkdirSync(picDir, { recursive: true })
        fs.mkdirSync(tmpDir, { recursive: true })

        ;({ browser, page } = await launchBrowser())

        //開啟test.html
        await page.goto(fileUrl('test_compare.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        //從全螢幕截圖裁切btn_a作為target
        let fullPath = path.join(tmpDir, '_fullscreen.png')
        await sc.screenFullSave(fullPath)
        let fullMeta = await sharp(fullPath).metadata()
        screenWidth = fullMeta.width
        screenHeight = fullMeta.height

        let rawTarget = path.join(imgsDir, 'target.png')
        let match = await cp.calcSimilarity(rawTarget, fullPath, 1)

        await sharp(fullPath)
            .extract({ left: match.x, top: match.y, width: match.width, height: match.height })
            .toFile(path.join(picDir, 'target.png'))
    })

    after(async function () {
        if (browser) await browser.close()
        try {
            fs.rmSync(picDir, { recursive: true })
        }
        catch { /* ignore */ }
        try {
            fs.rmSync(tmpDir, { recursive: true })
        }
        catch { /* ignore */ }
    })

    it('等待並找到目標圖', async function () {
        //reload乾淨狀態
        await page.goto(fileUrl('test_compare.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let result = await waitPics('target', {
            fdTar: picDir,
            fdTmp: tmpDir,
            x: 0,
            y: 0,
            width: screenWidth,
            height: screenHeight,
            threshold: 0.9,
            withClick: true,
            numMax: 3,
            timeDelay: 1000,
        })

        await page.waitForTimeout(500)
        assert.strictEqual(result, true, 'waitPics應回傳true')
    })
})
