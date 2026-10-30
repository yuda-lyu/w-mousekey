import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import waitPics from '../src/waitPics.mjs'
import { testDir, fileUrl, checkAhk, checkScreen, assertDesktopVisible, launchBrowser, ensureImages, waitPageReady, waitTargetOnScreen, waitText } from './tools/helper.mjs'
import { setBinEnv } from './tools/binEnv.mjs'

//同步原則: 載入後等頁面就緒並以桌面截圖見到目標為條件, 點擊後等#result之文字, 不以固定延時作同步手段;
//waitPics自身之輪詢行為(輪次、等待、放棄)見unit-waitPicsTrace.test.mjs(以onTrace事件同步)
describe('waitPics', function () {
    this.timeout(60000)

    let browser, page
    let restoreBin = null
    let picDir = path.join(testDir, '_pic_wp')
    let tmpDir = path.join(testDir, '_tmp_wp')
    let screenWidth, screenHeight

    before(async function () {
        restoreBin = setBinEnv('waitPics') //執行檔取自repo bin/之本機鏡像, 不連網
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

        //從全螢幕截圖裁切btn_a作為target; 桌面截圖須見到目標(辨識成功)才裁切
        let fullPath = path.join(tmpDir, '_fullscreen.png')
        let match = await waitTargetOnScreen(fullPath)
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

    it('等待並找到目標圖', async function () {
        //reload乾淨狀態, 等頁面就緒且桌面見到目標圖
        await page.goto(fileUrl('test_compare.html'))
        await waitPageReady(page)
        await waitTargetOnScreen(path.join(tmpDir, '_ready.png'))

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

        assert.strictEqual(result, true, 'waitPics應回傳true')

        //spec: waitPics withClick辨識成功後點擊 -> 圖片A之click使#result為'A'(原僅斷言回傳值, 補斷言點擊確實送達)
        let text = await waitText(page, '#result', 'A')
        assert.strictEqual(text, 'A', '應點擊到圖片A')
    })
})
