import assert from 'assert'
import path from 'path'
import fs from 'fs'
import runScp from '../src/runScp.mjs'
import { testDir, fileUrl, checkAhk, checkScreen, assertDesktopVisible, launchBrowser, ensureImages, waitPageReady, waitTargetOnScreen, waitText } from './tools/helper.mjs'
import { setBinEnv } from './tools/binEnv.mjs'

//同步原則: 載入後等頁面就緒並以桌面截圖見到目標為條件, 腳本執行後等#result之文字, 不以固定延時作同步手段;
//runScp自身之步間延時、重複與錯誤處理見unit-runScpTrace.test.mjs(以onTrace事件同步)
describe('runScp', function () {
    this.timeout(30000)

    let browser, page
    let restoreBin = null

    before(async function () {
        restoreBin = setBinEnv('runScp') //執行檔取自repo bin/之本機鏡像, 不連網
        if (!(await checkAhk())) this.skip()
        if (!(await checkScreen())) this.skip()
        await assertDesktopVisible()
        await ensureImages()
        ;({ browser, page } = await launchBrowser())
    })

    after(async function () {
        this.timeout(120000) //僅防懸置之上限: 滿載時關閉有頭Chrome可能逾describe之逾時(舊版於8壓力行程下after hook逾時30s)
        if (browser) await browser.close()
        if (restoreBin) restoreBin()
    })

    it('執行腳本點擊圖片按鈕', async function () {
        await page.goto(fileUrl('test_mousekey.html'))
        await waitPageReady(page)

        let tmpDir = path.join(testDir, '_tmp_rs')
        fs.mkdirSync(tmpDir, { recursive: true })

        //全螢幕截圖找btn_a位置; 桌面截圖須見到目標才算頁面已繪製於桌面
        let screenPath = path.join(tmpDir, 'screen.png')
        let match = await waitTargetOnScreen(screenPath)
        let sx = Math.round(match.x + match.width / 2)
        let sy = Math.round(match.y + match.height / 2)

        //建立腳本
        let scriptPath = path.join(testDir, '_test_script.json')
        fs.writeFileSync(scriptPath, JSON.stringify({
            repeat: 1,
            steps: [{ x: sx, y: sy, delay: 0 }],
        }))

        await runScp(scriptPath)

        //spec: runScp依腳本步驟點擊座標 -> 圖片按鈕之click使#result為'CLICKED'
        let text = await waitText(page, '#result', 'CLICKED')
        assert.strictEqual(text, 'CLICKED', '腳本應點擊到圖片按鈕')

        fs.unlinkSync(scriptPath)
        fs.rmSync(tmpDir, { recursive: true })
    })
})
