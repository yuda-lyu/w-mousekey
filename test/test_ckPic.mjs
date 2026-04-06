import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import sc from '../src/screen.mjs'
import cp from '../src/compare.mjs'
import ckPic from '../src/ckPic.mjs'
import { testDir, imgsDir, fileUrl, checkAhk, checkScreen, launchBrowser, ensureImages } from './helper.mjs'

describe('ckPic', function () {
    this.timeout(60000)

    let browser, page
    let picDir = path.join(testDir, '_pic')
    let tmpDir = path.join(testDir, '_tmp')
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

        //從全螢幕截圖裁切btn_a作為target(與ckPic同一截圖來源)
        let fullPath = path.join(tmpDir, '_fullscreen.png')
        await sc.screenFullSave(fullPath)
        let fullMeta = await sharp(fullPath).metadata()
        screenWidth = fullMeta.width
        screenHeight = fullMeta.height

        //用raw target找btn_a在全螢幕的位置, 再裁切螢幕版本
        let rawTarget = path.join(imgsDir, 'target.png')
        let match = await cp.calcSimilarity(rawTarget, fullPath, 1)
        console.log('    raw target match: sim=%s pos=(%d,%d)', match.similarity.toFixed(4), match.x, match.y)

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

    it('辨識目標圖(withClick=false)回傳true', async function () {
        let result = await ckPic('target', {
            fdTar: picDir,
            fdTmp: tmpDir,
            x: 0,
            y: 0,
            width: screenWidth,
            height: screenHeight,
            threshold: 0.9,
            withClick: false,
        })

        assert.strictEqual(result, true, 'ckPic應辨識成功')
    })

    it('辨識目標圖並點擊, 結果文字為A', async function () {
        //reload乾淨狀態
        await page.goto(fileUrl('test_compare.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let result = await ckPic('target', {
            fdTar: picDir,
            fdTmp: tmpDir,
            x: 0,
            y: 0,
            width: screenWidth,
            height: screenHeight,
            threshold: 0.9,
            withClick: true,
        })

        await page.waitForTimeout(1000)
        assert.strictEqual(result, true, 'ckPic應回傳true')

        let text = await page.textContent('#result')
        assert.strictEqual(text, 'A', '應點擊到圖片A')
    })
})
