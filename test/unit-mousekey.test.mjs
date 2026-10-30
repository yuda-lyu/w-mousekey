import assert from 'assert'
import path from 'path'
import fs from 'fs'
import mk from '../src/mousekey.mjs'
import { testDir, fileUrl, checkAhk, checkScreen, assertDesktopVisible, launchBrowser, ensureImages, waitPageReady, waitTargetOnScreen, waitText, waitTyped, waitSelectAll, focusInputByPhysicalClick } from './tools/helper.mjs'
import { setBinEnv } from './tools/binEnv.mjs'

//同步原則(規格: 計時器相關之測試以事件同步, 不以延時偵測): 動作後等可觀察之結果(輸入框值、元素文字、事件計數、桌面截圖見到目標), 不以固定延時作同步手段;
//helper.mjs之WATCHDOG_MS僅為防懸置之上限, 條件成立即返回
describe('mousekey', function () {
    this.timeout(30000)

    let browser, page
    let screenOk = false
    let restoreBin = null

    before(async function () {
        restoreBin = setBinEnv('mousekey') //執行檔取自repo bin/之本機鏡像, 不連網
        if (!(await checkAhk())) this.skip()
        await assertDesktopVisible()
        screenOk = await checkScreen()
        await ensureImages()
        ;({ browser, page } = await launchBrowser())
    })

    after(async function () {
        this.timeout(120000) //僅防懸置之上限: 滿載時關閉有頭Chrome可能逾describe之逾時(舊版於8壓力行程下2/5次after hook逾時30s)
        if (browser) await browser.close()
        if (restoreBin) restoreBin()
    })

    it('sendString: 於焦點輸入框輸入文字', async function () {
        await page.goto(fileUrl('test_mousekey.html'))
        await waitPageReady(page)

        //用AHK物理點擊視窗中央, 確保OS焦點在瀏覽器, 再用Playwright聚焦input
        await focusInputByPhysicalClick(page, '#input1', mk)

        await mk.sendString('hello')

        //spec: sendString於焦點輸入框輸入文字 -> 輸入框值為'hello'
        let val = await waitTyped(page, '#input1', 'hello')
        assert.strictEqual(val, 'hello', `預期'hello', 實際'${val}'`)
    })

    it('sendChar: 於焦點輸入框輸入單字元', async function () {
        await mk.sendChar('Z')

        //spec: sendChar於焦點輸入框輸入單字元 -> 於既有'hello'後接'Z'
        let val = await waitTyped(page, '#input1', 'helloZ')
        assert.strictEqual(val, 'helloZ', `預期'helloZ', 實際'${val}'`)
    })

    it('mouseClick: 全螢幕截圖辨識圖片位置後點擊', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await waitPageReady(page)

        let tmpDir = path.join(testDir, '_tmp_mk')
        fs.mkdirSync(tmpDir, { recursive: true })

        //全螢幕截圖, 用raw target找btn_a位置; 桌面截圖須見到目標才算頁面已繪製於桌面
        let screenPath = path.join(tmpDir, 'screen.png')
        let match = await waitTargetOnScreen(screenPath)
        console.log('      match: sim=%s pos=(%d,%d)', match.similarity.toFixed(4), match.x, match.y)

        let cx = match.x + match.width / 2
        let cy = match.y + match.height / 2

        //mouseClick點擊全螢幕座標
        await mk.mouseClick(cx, cy)

        //spec: mouseClick點擊圖片 -> click事件使#result為'CLICKED'
        let text = await waitText(page, '#result', 'CLICKED')
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
        await waitPageReady(page)

        let tmpDir = path.join(testDir, '_tmp_mk')
        fs.mkdirSync(tmpDir, { recursive: true })

        let screenPath = path.join(tmpDir, 'screen.png')
        let match = await waitTargetOnScreen(screenPath)
        let cx = match.x + match.width / 2
        let cy = match.y + match.height / 2

        await mk.mouseDblClick(cx, cy)

        //spec: mouseDblClick雙擊圖片 -> dblclick事件使#result為'DBLCLICKED'(雙擊先經兩次click事件使其暫為'CLICKED', 故等最終文字)
        let text = await waitText(page, '#result', 'DBLCLICKED')
        assert.strictEqual(text, 'DBLCLICKED', `預期'DBLCLICKED', 實際'${text}'`)

        fs.rmSync(tmpDir, { recursive: true })
    })

    it('mouseClick(right): 右鍵觸發contextmenu', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await waitPageReady(page)

        let tmpDir = path.join(testDir, '_tmp_mk')
        fs.mkdirSync(tmpDir, { recursive: true })

        let screenPath = path.join(tmpDir, 'screen.png')
        let match = await waitTargetOnScreen(screenPath)
        let cx = match.x + match.width / 2
        let cy = match.y + match.height / 2

        await mk.mouseClick(cx, cy, 'right')

        //spec: mouseClick右鍵 -> contextmenu事件使#result為'RIGHTCLICKED'
        let text = await waitText(page, '#result', 'RIGHTCLICKED')
        assert.strictEqual(text, 'RIGHTCLICKED', `預期'RIGHTCLICKED', 實際'${text}'`)

        fs.rmSync(tmpDir, { recursive: true })
    })

    it('mouseScroll: 向下滾動觸發wheel事件', async function () {
        if (!screenOk) this.skip()

        await page.goto(fileUrl('test_mousekey.html'))
        await waitPageReady(page)

        let center = await page.evaluate(() => ({
            x: Math.round(window.screenX + window.outerWidth / 2),
            y: Math.round(window.screenY + window.outerHeight / 2),
        }))

        await mk.mouseScroll(center.x, center.y, 'down', 3)

        //spec: mouseScroll向下滾動 -> wheel事件之deltaY>0使#wheelInfo為'DOWN'
        let text = await waitText(page, '#wheelInfo', 'DOWN')
        assert.strictEqual(text, 'DOWN', `預期'DOWN', 實際'${text}'`)
    })

    it('sendCombo: ctrl+a全選後取代內容', async function () {
        await page.goto(fileUrl('test_mousekey.html'))
        await waitPageReady(page)

        //物理點擊+focus input
        await focusInputByPhysicalClick(page, '#input1', mk)

        //輸入hello
        await mk.sendString('hello')
        let val1 = await waitTyped(page, '#input1', 'hello')
        assert.strictEqual(val1, 'hello', `預期先輸入'hello', 實際'${val1}'`)

        //ctrl+a全選: 以輸入框內容被全選為可觀察結果
        await mk.sendCombo('ctrl+a')
        await waitSelectAll(page, '#input1')

        //取代為xx
        await mk.sendString('xx')

        //spec: sendCombo ctrl+a全選後再輸入 -> 取代原內容而非接續
        let val = await waitTyped(page, '#input1', 'xx')
        assert.strictEqual(val, 'xx', `預期'xx'(全選後取代), 實際'${val}'`)
    })
})
