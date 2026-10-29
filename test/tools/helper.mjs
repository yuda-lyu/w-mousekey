import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import mk from '../../src/mousekey.mjs'
import ensureBins from '../../src/ensureBins.mjs'
import sc from '../../src/screen.mjs'

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

//assertDesktopVisible, 需真實桌面之測試之前置: 桌面截圖全黑代表遠端桌面視窗已縮小、鎖定或工作階段未顯示, 此時模擬之滑鼠鍵盤送不到視窗
//(2026-10-29 實驗: 縮小遠端桌面視窗後, 截圖1920x1080全黑, 輸入、點擊、滾輪等9案皆落空; 10-26、10-27兩次全套之9 failing同此)
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
        throw new Error('桌面截圖全黑: 遠端桌面視窗已縮小、鎖定或工作階段未顯示, 模擬之滑鼠鍵盤送不到視窗; 請保持遠端桌面視窗顯示(勿縮小)後再執行需真實桌面之測試')
    }
}

export async function launchBrowser() {
    let browser = await chromium.launch({ headless: false, channel: 'chrome' })
    let page = await browser.newPage({
        viewport: { width: 800, height: 400 },
        deviceScaleFactor: 1,
    })
    return { browser, page }
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
