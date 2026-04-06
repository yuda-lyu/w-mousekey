import assert from 'assert'
import path from 'path'
import fs from 'fs'
import mk from '../src/mousekey.mjs'
import sc from '../src/screen.mjs'
import cp from '../src/compare.mjs'
import { testDir, imgsDir, fileUrl, checkAhk, checkScreen, launchBrowser, ensureImages } from './helper.mjs'

describe('mousekey', function () {
    this.timeout(30000)

    let browser, page
    let screenOk = false

    before(async function () {
        if (!checkAhk()) this.skip()
        screenOk = await checkScreen()
        await ensureImages()
        ;({ browser, page } = await launchBrowser())
    })

    after(async function () {
        if (browser) await browser.close()
    })

    it('sendString: 於焦點輸入框輸入文字', async function () {
        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.click('#input1')
        await page.waitForTimeout(300)

        await mk.sendString('hello')
        await page.waitForTimeout(500)

        let val = await page.$eval('#input1', (el) => el.value)
        assert.strictEqual(val, 'hello', `預期'hello', 實際'${val}'`)
    })

    it('sendKey: 於焦點輸入框輸入單字元', async function () {
        await mk.sendKey('Z')
        await page.waitForTimeout(300)

        let val = await page.$eval('#input1', (el) => el.value)
        assert.strictEqual(val, 'helloZ', `預期'helloZ', 實際'${val}'`)
    })

    it('mouseClick: 全螢幕截圖辨識圖片位置後點擊', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let tmpDir = path.join(testDir, '_tmp_mk')
        fs.mkdirSync(tmpDir, { recursive: true })

        //全螢幕截圖, 用raw target找btn_a位置, 裁切螢幕版本
        let screenPath = path.join(tmpDir, 'screen.png')
        await sc.screenFullSave(screenPath)

        let rawTarget = path.join(imgsDir, 'target.png')
        let match = await cp.calcSimilarity(rawTarget, screenPath, 1)
        console.log('      match: sim=%s pos=(%d,%d)', match.similarity.toFixed(4), match.x, match.y)

        let cx = match.x + match.width / 2
        let cy = match.y + match.height / 2

        //mouseClick點擊全螢幕座標
        await mk.mouseClick(cx, cy)
        await page.waitForTimeout(500)

        let text = await page.textContent('#result')
        assert.strictEqual(text, 'CLICKED', `預期'CLICKED', 實際'${text}'`)

        fs.rmSync(tmpDir, { recursive: true })
    })

    it('mouseDrag: 拖曳不拋錯', async function () {
        let center = await page.evaluate(() => ({
            x: Math.round(window.screenX + window.outerWidth / 2),
            y: Math.round(window.screenY + window.outerHeight / 2),
        }))
        await mk.mouseDrag(center.x - 25, center.y - 25, center.x + 25, center.y + 25)
    })
})
