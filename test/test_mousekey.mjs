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
        await page.waitForTimeout(300)

        //用AHK物理點擊視窗中央, 確保OS焦點在瀏覽器
        let center = await page.evaluate(() => ({
            x: Math.round(window.screenX + window.outerWidth / 2),
            y: Math.round(window.screenY + window.outerHeight / 2),
        }))
        await mk.mouseClick(center.x, center.y)
        await page.waitForTimeout(300)

        //再用Playwright聚焦input
        await page.click('#input1')
        await page.waitForTimeout(300)

        await mk.sendString('hello')
        await page.waitForTimeout(500)

        let val = await page.$eval('#input1', (el) => el.value)
        assert.strictEqual(val, 'hello', `預期'hello', 實際'${val}'`)
    })

    it('sendChar: 於焦點輸入框輸入單字元', async function () {
        await mk.sendChar('Z')
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

    it('mouseDblClick: 雙擊圖片觸發dblclick事件', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let tmpDir = path.join(testDir, '_tmp_mk')
        fs.mkdirSync(tmpDir, { recursive: true })

        let screenPath = path.join(tmpDir, 'screen.png')
        await sc.screenFullSave(screenPath)
        let rawTarget = path.join(imgsDir, 'target.png')
        let match = await cp.calcSimilarity(rawTarget, screenPath, 1)
        let cx = match.x + match.width / 2
        let cy = match.y + match.height / 2

        await mk.mouseDblClick(cx, cy)
        await page.waitForTimeout(500)

        let text = await page.textContent('#result')
        assert.strictEqual(text, 'DBLCLICKED', `預期'DBLCLICKED', 實際'${text}'`)

        fs.rmSync(tmpDir, { recursive: true })
    })

    it('mouseClick(right): 右鍵觸發contextmenu', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let tmpDir = path.join(testDir, '_tmp_mk')
        fs.mkdirSync(tmpDir, { recursive: true })

        let screenPath = path.join(tmpDir, 'screen.png')
        await sc.screenFullSave(screenPath)
        let rawTarget = path.join(imgsDir, 'target.png')
        let match = await cp.calcSimilarity(rawTarget, screenPath, 1)
        let cx = match.x + match.width / 2
        let cy = match.y + match.height / 2

        await mk.mouseClick(cx, cy, 'right')
        await page.waitForTimeout(500)

        let text = await page.textContent('#result')
        assert.strictEqual(text, 'RIGHTCLICKED', `預期'RIGHTCLICKED', 實際'${text}'`)

        fs.rmSync(tmpDir, { recursive: true })
    })

    it('mouseScroll: 向下滾動觸發wheel事件', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(500)

        let center = await page.evaluate(() => ({
            x: Math.round(window.screenX + window.outerWidth / 2),
            y: Math.round(window.screenY + window.outerHeight / 2),
        }))

        await mk.mouseScroll(center.x, center.y, 'down', 3)
        await page.waitForTimeout(500)

        let text = await page.textContent('#wheelInfo')
        assert.strictEqual(text, 'DOWN', `預期'DOWN', 實際'${text}'`)
    })

    it('sendCombo: ctrl+a全選後取代內容', async function () {
        await page.goto(fileUrl('test_mousekey.html'))
        await page.waitForLoadState('load')
        await page.bringToFront()
        await page.waitForTimeout(300)

        //物理點擊+focus input
        let center = await page.evaluate(() => ({
            x: Math.round(window.screenX + window.outerWidth / 2),
            y: Math.round(window.screenY + window.outerHeight / 2),
        }))
        await mk.mouseClick(center.x, center.y)
        await page.waitForTimeout(300)
        await page.click('#input1')
        await page.waitForTimeout(300)

        //輸入hello
        await mk.sendString('hello')
        await page.waitForTimeout(300)

        //ctrl+a全選
        await mk.sendCombo('ctrl+a')
        await page.waitForTimeout(300)

        //取代為xx
        await mk.sendString('xx')
        await page.waitForTimeout(500)

        let val = await page.$eval('#input1', (el) => el.value)
        assert.strictEqual(val, 'xx', `預期'xx'(全選後取代), 實際'${val}'`)
    })
})
