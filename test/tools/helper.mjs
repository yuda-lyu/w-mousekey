import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import mk from '../../src/mousekey.mjs'
import ensureBins from '../../src/ensureBins.mjs'
import sc from '../../src/screen.mjs'
import cp from '../../src/compare.mjs'

export const toolsDir = path.dirname(fileURLToPath(import.meta.url))
export const testDir = path.resolve(toolsDir, '..')
export const imgsDir = path.join(testDir, 'imgs')

export function fileUrl(file) {
    return 'file:///' + path.join(testDir, 'htmls', file).replace(/\\/g, '/')
}

//須先以binEnv.mjs之setBinEnv設好本機鏡像(W_BIN_*), 否則會連網下載; 取得失敗(鏡像或清單有誤)直接拋錯而非略過測試, 以免掩蓋缺陷
export async function checkAhk() {
    let bins = await ensureBins({ names: 'AutoHotkey64.exe' })
    return fs.existsSync(bins['AutoHotkey64.exe'])
}

export async function checkScreen() {
    //Windows須先取得截圖exe: 鏡像或清單有誤時直接拋錯, 不當成無桌面而略過(下方catch只吞截圖本身之失敗)
    if (process.platform === 'win32') {
        await ensureBins({ names: 'screenCapture_1.3.2.exe' })
    }
    try {
        await sc.screenFull()
        return true
    }
    catch {
        return false
    }
}

//assertDesktopVisible, 需真實桌面之測試之前置: 桌面截圖全黑代表遠端桌面工作階段未繪製(已鎖定、中斷連線, 或視窗縮小而使用者端未設登錄RemoteDesktop_SuppressWhenMinimized=2), 此時模擬之滑鼠鍵盤送不到視窗
//(2026-10-29 實驗: 縮小遠端桌面視窗後, 截圖1920x1080全黑, 輸入、點擊、滾輪等9案皆落空; 10-26、10-27兩次全套之9 failing同此;
// 同日使用者端設該登錄為2後, 縮小視窗桌面仍繪製, 4個需真實桌面之測試檔12 passing)
//以明確訊息失敗而非略過, 免出現多案看不出原因之失敗
export async function assertDesktopVisible() {
    if (process.platform !== 'win32') {
        return
    }
    await ensureBins({ names: 'screenCapture_1.3.2.exe' })
    let img = await sc.screenFull()
    let { channels } = await sharp(img).stats()
    let max = Math.max(...channels.slice(0, 3).map((c) => c.max))
    if (max === 0) {
        throw new Error('桌面截圖全黑: 遠端桌面工作階段未繪製(已鎖定、中斷連線, 或視窗縮小而使用者端未設登錄RemoteDesktop_SuppressWhenMinimized=2), 模擬之滑鼠鍵盤送不到視窗; 請確認工作階段未鎖定且未中斷連線(縮小視窗須已設該登錄)後再執行需真實桌面之測試')
    }
}

//頁面內之事件紀錄器(page.addInitScript, 每次載入新文件即重置): 以window.__mkEv記錄輸入事件, 供測試以「已送達之事件」而非固定延時同步
function recorderScript() {
    window.__mkEv = []
    for (let type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'wheel', 'keydown', 'input']) {
        window.addEventListener(type, (e) => {
            window.__mkEv.push({ type, key: e.key || null })
        }, true)
    }
}

export async function launchBrowser() {
    let browser = await chromium.launch({ headless: false, channel: 'chrome' })
    let page = await browser.newPage({
        viewport: { width: 800, height: 400 },
        deviceScaleFactor: 1,
    })
    await page.addInitScript(recorderScript)
    return { browser, page }
}


//以下為需真實桌面之測試所用之條件式同步: 等可觀察之結果(DOM值、文字、事件、桌面截圖見到目標), 不以固定延時作同步手段;
//WATCHDOG_MS僅為防懸置之上限(條件成立即返回, 逾時才拋錯), 不表達規格; 看門狗用模組載入時保存之真實計時器
const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout
export const WATCHDOG_MS = 15000
const POLL_MS = 50 //頁面內條件輪詢週期(取樣頻率, 非等待時間)
const SHOT_POLL_MS = 200 //桌面截圖輪詢週期(兩次截圖間隔)

function watchdog(pm, ms, msg) {
    let t = null
    let limit = new Promise((resolve, reject) => {
        t = realSetTimeout(() => reject(new Error(`${msg}(看門狗${ms}ms)`)), ms)
    })
    return Promise.race([pm, limit]).finally(() => realClearTimeout(t))
}

//等頁面內條件fn(arg)成立; 逾時拋錯並附describe()讀得之當下狀態
async function waitInPage(page, label, fn, arg, describe) {
    try {
        await page.waitForFunction(fn, arg, { timeout: WATCHDOG_MS, polling: POLL_MS })
    }
    catch (err) {
        let now = ''
        if (describe) {
            try {
                now = `; 當下: ${await describe()}`
            }
            catch (e) {
                now = '; 當下狀態讀取失敗'
            }
        }
        throw new Error(`等待條件逾時: ${label}${now}(${String(err.message).split('\n')[0]})`)
    }
}

//頁面就緒: 已載入、可見、圖片已解碼並至少產生兩個畫面框(桌面截圖才見得到); 取代goto後固定等待
export async function waitPageReady(page) {
    await page.waitForLoadState('load')
    await page.bringToFront()
    await waitInPage(page, '頁面載入完成且可見', () => {
        return document.readyState === 'complete' && document.visibilityState === 'visible' && Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)
    }, null, () => page.evaluate(() => `readyState=${document.readyState} visibility=${document.visibilityState}`))
    await watchdog(page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))), WATCHDOG_MS, '等待頁面產生畫面框逾時')
}

//頁面內已記錄type事件之數量
export async function countEvents(page, type) {
    return page.evaluate((t) => window.__mkEv.filter((e) => e.type === t).length, type)
}

//等頁面收到至少n個type事件(n為累計值, 通常為動作前之countEvents加預期新增數)
export async function waitEvents(page, type, n) {
    await waitInPage(page, `${type}事件累計達${n}個`, ({ type, n }) => window.__mkEv.filter((e) => e.type === type).length >= n, { type, n },
        async () => `${type}事件${await countEvents(page, type)}個`)
}

//等元素文字等於expected(已重置之新文件其初始文字為空, 故不會誤認舊結果), 回傳當下文字
export async function waitText(page, selector, expected) {
    await waitInPage(page, `${selector}文字為'${expected}'`, ({ selector, expected }) => document.querySelector(selector).textContent === expected, { selector, expected },
        async () => `${selector}文字為'${await page.textContent(selector)}'`)
    return page.textContent(selector)
}

//等輸入框值等於expected(輸入逐字送達, 值逐事件更新; 送錯或漏字元則值永不等於expected, 於看門狗上限報出當下值), 回傳當下值供斷言
export async function waitTyped(page, selector, expected) {
    await waitInPage(page, `${selector}值為'${expected}'`, ({ selector, expected }) => document.querySelector(selector).value === expected, { selector, expected },
        async () => `${selector}值為'${await page.$eval(selector, (el) => el.value)}', input事件${await countEvents(page, 'input')}個`)
    return page.$eval(selector, (el) => el.value)
}

//等輸入框內容全選(sendCombo ctrl+a之可觀察結果)
export async function waitSelectAll(page, selector) {
    await waitInPage(page, `${selector}內容全選`, ({ selector }) => {
        let el = document.querySelector(selector)
        return el.value.length > 0 && el.selectionStart === 0 && el.selectionEnd === el.value.length
    }, { selector }, () => page.$eval(selector, (el) => `值'${el.value}'選取[${el.selectionStart},${el.selectionEnd}]`))
}

//以AHK物理點擊視窗中央使OS焦點在瀏覽器, 再以Playwright聚焦selector之輸入框; 皆等可觀察結果(實體點擊已送達頁面、頁面取得焦點、輸入框為作用元素)
export async function focusInputByPhysicalClick(page, selector, mk) {
    let center = await page.evaluate(() => ({
        x: Math.round(window.screenX + window.outerWidth / 2),
        y: Math.round(window.screenY + window.outerHeight / 2),
    }))
    let n0 = await countEvents(page, 'mousedown')
    await mk.mouseClick(center.x, center.y)
    await waitEvents(page, 'mousedown', n0 + 1)
    await waitInPage(page, '頁面取得系統焦點', () => document.hasFocus(), null, () => page.evaluate(() => `hasFocus=${document.hasFocus()}`))
    await page.click(selector)
    await waitInPage(page, `${selector}為作用元素`, ({ selector }) => document.activeElement === document.querySelector(selector), { selector },
        () => page.evaluate(() => `activeElement=${document.activeElement && document.activeElement.tagName}`))
}

//輪詢桌面截圖直到辨識到target.png(相似度達threshold)為止, 回傳該張截圖之比對結果; 桌面截圖須見到目標才可進行點擊, 取代開啟頁面後固定等待
export async function waitTargetOnScreen(fpShot, threshold = 0.9) {
    let rawTarget = path.join(imgsDir, 'target.png')
    let t0 = Date.now()
    let match = null
    for (;;) {
        await sc.screenFullSave(fpShot)
        match = await cp.calcSimilarity(rawTarget, fpShot, 1)
        if (match.similarity >= threshold) {
            return match
        }
        if (Date.now() - t0 > WATCHDOG_MS) {
            throw new Error(`桌面截圖逾時未見到目標圖(最後相似度${match.similarity.toFixed(4)}<${threshold}, 看門狗${WATCHDOG_MS}ms): 請確認遠端桌面工作階段仍繪製且瀏覽器視窗在畫面內`)
        }
        await new Promise((resolve) => realSetTimeout(resolve, SHOT_POLL_MS))
    }
}

// 校正viewport在螢幕上的實際座標
// 原理: 點擊視窗中央, 比對螢幕座標與頁面收到的座標, 算出精確offset
export async function calibrateViewport(page) {
    await page.bringToFront()
    await page.waitForTimeout(500)

    for (let attempt = 0; attempt < 3; attempt++) {
        await page.evaluate(() => {
            window._calClick = null
            document.addEventListener('mousedown', (e) => {
                window._calClick = { x: e.clientX, y: e.clientY }
            }, { once: true })
        })

        let center = await page.evaluate(() => ({
            x: Math.round(window.screenX + window.outerWidth / 2),
            y: Math.round(window.screenY + window.outerHeight / 2),
        }))

        await mk.mouseClick(center.x, center.y)
        await page.waitForTimeout(500)

        let pos = await page.evaluate(() => window._calClick)
        if (pos) {
            return {
                x: center.x - pos.x,
                y: center.y - pos.y,
                width: await page.evaluate(() => window.innerWidth),
                height: await page.evaluate(() => window.innerHeight),
            }
        }

        await page.bringToFront()
        await page.waitForTimeout(500)
    }

    throw new Error('校正點擊未命中頁面(3次重試)')
}

// 頁面座標轉螢幕座標
export function toScreen(vp, box) {
    return {
        x: Math.round(vp.x + box.x + box.width / 2),
        y: Math.round(vp.y + box.y + box.height / 2),
    }
}

// 從全螢幕截圖裁切指定元素作為target(與ckPic同座標系)
export async function extractTargetFromScreen(page, vp, selector, outputPath, tmpDir) {
    let fullPath = path.join(tmpDir, '_fullscreen.png')
    await sc.screenFullSave(fullPath)
    let box = await page.locator(selector).boundingBox()
    await sharp(fullPath)
        .extract({
            left: Math.round(vp.x + box.x),
            top: Math.round(vp.y + box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
        })
        .toFile(outputPath)
    let meta = await sharp(fullPath).metadata()
    return { screenWidth: meta.width, screenHeight: meta.height }
}

// 確保測試圖片存在
const SIZE = 80
function fillRect(buf, x1, y1, x2, y2, r, g, b) {
    for (let y = Math.max(0, y1); y <= Math.min(SIZE - 1, y2); y++) {
        for (let x = Math.max(0, x1); x <= Math.min(SIZE - 1, x2); x++) {
            let idx = (y * SIZE + x) * 3
            buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b
        }
    }
}
export async function ensureImages() {
    if (fs.existsSync(path.join(imgsDir, 'target.png'))) return
    fs.mkdirSync(imgsDir, { recursive: true })
    let buf = Buffer.alloc(SIZE * SIZE * 3)
    fillRect(buf, 0, 0, 79, 79, 30, 100, 200)
    fillRect(buf, 35, 10, 44, 69, 255, 255, 255)
    fillRect(buf, 10, 35, 69, 44, 255, 255, 255)
    await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .png().toFile(path.join(imgsDir, 'target.png'))
    fs.copyFileSync(path.join(imgsDir, 'target.png'), path.join(imgsDir, 'btn_a.png'))
}
