import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import ckPic from '../src/ckPic.mjs'
import { testDir, fileUrl, checkAhk, checkScreen, assertDesktopVisible, launchBrowser, ensureImages, waitPageReady, waitTargetOnScreen, waitText } from './tools/helper.mjs'
import { setBinEnv } from './tools/binEnv.mjs'

//同步原則: 載入後等頁面就緒並以桌面截圖見到目標為條件(辨識成功才進行), 點擊後等#result之文字, 不以固定延時作同步手段
describe('ckPic', function () {
    this.timeout(60000)

    let browser, page
    let restoreBin = null
    let picDir = path.join(testDir, '_pic')
    let tmpDir = path.join(testDir, '_tmp')
    let screenWidth, screenHeight

    before(async function () {
        restoreBin = setBinEnv('ckPic') //執行檔取自repo bin/之本機鏡像, 不連網
        if (!(await checkAhk())) this.skip()
        if (!(await checkScreen())) this.skip()
        await assertDesktopVisible()
        await ensureImages()
        fs.mkdirSync(picDir, { recursive: true })
        fs.mkdirSync(tmpDir, { recursive: true })

        ;({ browser, page } = await launchBrowser())

        //開啟test.html
        await page.goto(fileUrl('test_compare.html'))
        await waitPageReady(page)

        //從全螢幕截圖裁切btn_a作為target(與ckPic同一截圖來源); 桌面截圖須見到目標(辨識成功)才裁切
        let fullPath = path.join(tmpDir, '_fullscreen.png')
        let match = await waitTargetOnScreen(fullPath)
        console.log('    raw target match: sim=%s pos=(%d,%d)', match.similarity.toFixed(4), match.x, match.y)
        let fullMeta = await sharp(fullPath).metadata()
        screenWidth = fullMeta.width
        screenHeight = fullMeta.height

        await sharp(fullPath)
            .extract({ left: match.x, top: match.y, width: match.width, height: match.height })
            .toFile(path.join(picDir, 'target.png'))
    })

    after(async function () {
        this.timeout(120000) //僅防懸置之上限: 滿載時關閉有頭Chrome可能逾describe之逾時
        if (browser) await browser.close()
        if (restoreBin) restoreBin()
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
        //reload乾淨狀態, 等頁面就緒且桌面見到目標圖
        await page.goto(fileUrl('test_compare.html'))
        await waitPageReady(page)
        await waitTargetOnScreen(path.join(tmpDir, '_ready.png'))

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

        assert.strictEqual(result, true, 'ckPic應回傳true')

        //spec: ckPic withClick辨識成功後點擊圖片中心 -> 圖片A之click使#result為'A'
        let text = await waitText(page, '#result', 'A')
        assert.strictEqual(text, 'A', '應點擊到圖片A')
    })
})
