import { chromium } from 'playwright'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import mk from '../src/mousekey.mjs'
import getAhk from '../src/getAhk.mjs'
import sc from '../src/screen.mjs'

export const testDir = path.dirname(fileURLToPath(import.meta.url))
export const imgsDir = path.join(testDir, 'imgs')

export function fileUrl(file) {
    return 'file:///' + path.join(testDir, 'htmls', file).replace(/\\/g, '/')
}

export function checkAhk() {
    try {
        let ak = getAhk()
        return fs.existsSync(ak.ahkExePath)
    }
    catch {
        return false
    }
}

export async function checkScreen() {
    try {
        await sc.screenFull()
        return true
    }
    catch {
        return false
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
