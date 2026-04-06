import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sc from '../src/screen.mjs'
import cp from '../src/compare.mjs'
import runScp from '../src/runScp.mjs'
import { testDir, imgsDir, fileUrl, checkAhk, checkScreen, launchBrowser, ensureImages } from './helper.mjs'

describe('runScp', function () {
    this.timeout(30000)

    let browser, page

    before(async function () {
        if (!checkAhk()) this.skip()
        if (!(await checkScreen())) this.skip()
        await ensureImages()
        ;({ browser, page } = await launchBrowser())
    })

    after(async function () {
        if (browser) await browser.close()
    })

    it('執行腳本點擊圖片按鈕', async function () {
        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let tmpDir = path.join(testDir, '_tmp_rs')
        fs.mkdirSync(tmpDir, { recursive: true })

        //全螢幕截圖找btn_a位置
        let screenPath = path.join(tmpDir, 'screen.png')
        await sc.screenFullSave(screenPath)

        let rawTarget = path.join(imgsDir, 'target.png')
        let match = await cp.calcSimilarity(rawTarget, screenPath, 1)
        let sx = Math.round(match.x + match.width / 2)
        let sy = Math.round(match.y + match.height / 2)

        //建立腳本
        let scriptPath = path.join(testDir, '_test_script.json')
        fs.writeFileSync(scriptPath, JSON.stringify({
            repeat: 1,
            steps: [{ x: sx, y: sy, delay: 0 }],
        }))

        await runScp(scriptPath)
        await page.waitForTimeout(500)

        let text = await page.textContent('#result')
        assert.strictEqual(text, 'CLICKED', '腳本應點擊到圖片按鈕')

        fs.unlinkSync(scriptPath)
        fs.rmSync(tmpDir, { recursive: true })
    })
})
