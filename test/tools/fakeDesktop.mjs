//fakeDesktop.mjs: 替身桌面預載模組. 真實桌面不可用(工作階段鎖定、前景被其他視窗遮蓋等)時, 以Playwright無頭Chrome模擬「OS層輸入」與「桌面截圖」,
//使4個需真實桌面之測試檔(unit-mousekey、unit-runScp、unit-ckPic、unit-waitPics)不改一行即可實跑, 用以驗證測試輔助(test/tools/helper.mjs)之邏輯,
//並於輸入層注入缺陷(變異)或延後送達(非缺陷之時序變異)以驗證測試仍抓得到缺陷、且不因送達延遲而誤報.
//  注意: 不是真實桌面. Playwright之輸入同步送入頁面, 與AutoHotkey經OS非同步送達不同, 故只能驗證測試邏輯與變異, 不能取代真實桌面實跑.
//用法(只在mocha行程啟用, 檔名須含mocha):
//  NODE_OPTIONS=--import=<本檔之file:///網址> node node_modules/mocha/bin/mocha.js --no-parallel test/unit-mousekey.test.mjs --timeout 180000
//  FD_TREE: 被測樹根(含src/), 預設為本檔往上兩層(本套件根); 供對舊版快照(git archive解出之副本)實跑時指定
//  FD_MUT: none | drop(輸入全不送達) | wrongchar(sendString/sendChar末字元改p) | rightAsLeft | dbl1 | scrollUp | noCombo
//  FD_LATE_MS: >0時輸入延後該毫秒才送達(呼叫端先返回)——非缺陷之時序變異
//以mk.init/sc.init注入, 無法還原, 故只供獨立之mocha行程使用, 不得於一般測試行程載入.
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

if (/mocha/.test(process.argv[1] || '')) {
    let toolsDir = path.dirname(fileURLToPath(import.meta.url))
    let tree = process.env.FD_TREE || path.resolve(toolsDir, '..', '..')
    let mut = process.env.FD_MUT || 'none'
    let late = Number(process.env.FD_LATE_MS || 0)
    let mk = (await import(pathToFileURL(path.join(tree, 'src', 'mousekey.mjs')).href)).default
    let sc = (await import(pathToFileURL(path.join(tree, 'src', 'screen.mjs')).href)).default
    let { chromium } = await import('playwright')
    let sharp = (await import('sharp')).default

    //以無頭Chrome取代有頭, 並記下頁面供截圖與輸入使用
    let origLaunch = chromium.launch.bind(chromium)
    chromium.launch = async (opts = {}) => {
        let browser = await origLaunch({ ...opts, headless: true })
        let origNewPage = browser.newPage.bind(browser)
        browser.newPage = async (...a) => {
            let p = await origNewPage(...a)
            globalThis.__fdPage = p
            return p
        }
        return browser
    }

    //桌面為1000x600灰底, 頁面視窗置於(screenX, screenY)(無頭Chrome為(10,10)), 故桌面座標=視窗內座標+(screenX, screenY)
    let DW = 1000
    let DH = 600
    let desk = () => sharp({ create: { width: DW, height: DH, channels: 3, background: { r: 200, g: 200, b: 200 } } })
    sc.init({
        screenshot: async () => {
            let p = globalThis.__fdPage
            if (p && !p.isClosed()) {
                let [sx, sy] = await p.evaluate(() => [window.screenX, window.screenY])
                let shot = await p.screenshot({ type: 'png' })
                return desk().composite([{ input: shot, left: sx, top: sy }]).png().toBuffer()
            }
            return desk().png().toBuffer()
        },
    })

    //桌面座標轉視窗內座標
    let toPage = async (p, x, y) => {
        let [sx, sy] = await p.evaluate(() => [window.screenX, window.screenY])
        return [x - sx, y - sy]
    }

    let deliver = async (action, args) => {
        let p = globalThis.__fdPage
        switch (action) {
        case 'click': {
            let [x0, y0, btn, count] = args
            let [x, y] = await toPage(p, x0, y0)
            if (mut === 'rightAsLeft' && btn === 'right') {
                btn = 'left'
            }
            if (mut === 'dbl1' && count === 2) {
                count = 1
            }
            if (count === 2) {
                await p.mouse.dblclick(x, y, { button: btn })
            }
            else {
                await p.mouse.click(x, y, { button: btn })
            }
            break
        }
        case 'drag': {
            let [x1, y1, x2, y2, btn] = args
            let [px1, py1] = await toPage(p, x1, y1)
            let [px2, py2] = await toPage(p, x2, y2)
            await p.mouse.move(px1, py1)
            await p.mouse.down({ button: btn })
            await p.mouse.move(px2, py2)
            await p.mouse.up({ button: btn })
            break
        }
        case 'scroll': {
            let [x0, y0, dir, amount] = args
            let [x, y] = await toPage(p, x0, y0)
            if (mut === 'scrollUp') {
                dir = dir === 'down' ? 'up' : dir
            }
            let d = 100 * amount
            await p.mouse.move(x, y)
            await p.mouse.wheel(dir === 'right' ? d : (dir === 'left' ? -d : 0), dir === 'down' ? d : (dir === 'up' ? -d : 0))
            break
        }
        case 'sendChar':
        case 'sendString': {
            let s = String(args[0])
            if (mut === 'wrongchar') {
                s = s.slice(0, -1) + 'p'
            }
            await p.keyboard.type(s)
            break
        }
        case 'sendCombo': {
            if (mut === 'noCombo') {
                break
            }
            await p.keyboard.press(String(args[0]).replace(/^ctrl\+/i, 'Control+'))
            break
        }
        default:
            throw new Error(`unknown action: ${action}`)
        }
    }

    mk.init({
        moukey: async (action, args) => {
            if (mut === 'drop') {
                return
            }
            if (late > 0) {
                setTimeout(() => {
                    deliver(action, args).catch(() => {})
                }, late)
                return
            }
            await deliver(action, args)
        },
    })
}
