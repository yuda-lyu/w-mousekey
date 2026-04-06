import { chromium } from 'playwright'
import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import cp from '../src/compare.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imgsDir = path.join(__dirname, 'imgs')
const targetPath = path.join(imgsDir, 'target.png')
const screenshotPath = path.join(imgsDir, 'screenshot.png')


// ========== 圖片生成 ==========

const SIZE = 80

function createBuf() {
    return Buffer.alloc(SIZE * SIZE * 3)
}

function fillRect(buf, x1, y1, x2, y2, r, g, b) {
    for (let y = Math.max(0, y1); y <= Math.min(SIZE - 1, y2); y++) {
        for (let x = Math.max(0, x1); x <= Math.min(SIZE - 1, x2); x++) {
            let idx = (y * SIZE + x) * 3
            buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b
        }
    }
}

// function drawDiamond(buf, cx, cy, radius, r, g, b) {
//     for (let y = 0; y < SIZE; y++) {
//         for (let x = 0; x < SIZE; x++) {
//             if (Math.abs(x - cx) + Math.abs(y - cy) <= radius) {
//                 let idx = (y * SIZE + x) * 3
//                 buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b
//             }
//         }
//     }
// }

async function saveImg(buf, fp) {
    await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .png().toFile(fp)
}

async function generateImages() {
    fs.mkdirSync(imgsDir, { recursive: true })

    // target & btn_a: 藍底白十字
    let target = createBuf()
    fillRect(target, 0, 0, 79, 79, 30, 100, 200) // 藍色背景
    fillRect(target, 35, 10, 44, 69, 255, 255, 255) // 垂直白條 (10px寬)
    fillRect(target, 10, 35, 69, 44, 255, 255, 255) // 水平白條 (10px高)
    await saveImg(target, targetPath)
    await saveImg(target, path.join(imgsDir, 'btn_a.png'))

    // btn_b: 混淆圖 - 相似但有差異(色偏+位移+厚度), 目標相似度0.8~0.85
    let similar = createBuf()
    fillRect(similar, 0, 0, 79, 79, 75, 140, 160) // 偏移藍(+45,+40,-40)
    fillRect(similar, 40, 16, 47, 74, 200, 208, 218) // 垂直條: 右移5, 下移6, 寬8px, 偏灰白
    fillRect(similar, 16, 40, 74, 47, 200, 208, 218) // 水平條: 右移6, 下移5, 高8px, 偏灰白
    await saveImg(similar, path.join(imgsDir, 'btn_b.png'))

    // btn_c: 完全不同 - 紅底白橫條紋
    let different = createBuf()
    fillRect(different, 0, 0, 79, 79, 200, 50, 50) // 紅色背景
    for (let sy = 10; sy < 70; sy += 15) {
        fillRect(different, 10, sy, 69, sy + 5, 255, 255, 255) // 白色橫條
    }
    await saveImg(different, path.join(imgsDir, 'btn_c.png'))
}


// ========== 測試 ==========

describe('compare - 圖片辨識與點擊', function () {
    this.timeout(60000)

    let browser, page
    let htmlUrl = 'file:///' + path.join(__dirname, 'htmls', 'test_compare.html').replace(/\\/g, '/')

    before(async function () {

        //generateImages
        await generateImages()

        //browser, 使用本機Chrome直接開啟本機html
        browser = await chromium.launch({ headless: false, channel: 'chrome' })
        page = await browser.newPage({
            viewport: { width: 800, height: 400 },
            deviceScaleFactor: 1,
        })

        //navigate & screenshot
        await page.goto(htmlUrl)
        await page.waitForLoadState('load')
        await page.screenshot({ path: screenshotPath })
    })

    after(async function () {
        if (browser) await browser.close()
    })

    it('辨識: 找到目標圖(btn_a)且相似度 > 0.9', async function () {
        let match = await cp.calcSimilarity(targetPath, screenshotPath, 1)
        console.log('      target similarity:', match.similarity.toFixed(4))
        console.log('      match position: x=%d y=%d', match.x, match.y)
        assert(match.similarity > 0.9, `預期 > 0.9, 實際 ${match.similarity.toFixed(4)}`)
    })

    it('點擊: 用辨識座標點擊後結果文字為"A"', async function () {
        //reload
        await page.goto(htmlUrl)
        await page.waitForLoadState('networkidle')
        await page.screenshot({ path: screenshotPath })

        let match = await cp.calcSimilarity(targetPath, screenshotPath, 1)
        let clickX = match.x + match.width / 2
        let clickY = match.y + match.height / 2
        console.log('      click: (%d, %d)', clickX, clickY)
        await page.mouse.click(clickX, clickY)

        let text = await page.textContent('#result')
        console.log('      result text:', JSON.stringify(text))
        assert.strictEqual(text, 'A', `預期點擊A, 實際結果 "${text}"`)
    })

    it('鑑別: 混淆圖(btn_b)相似度在0.8~0.85之間', async function () {
        let box = await page.locator('.buttons img:nth-child(2)').boundingBox()
        let croppedPath = path.join(imgsDir, 'cropped_b.png')
        await sharp(screenshotPath)
            .extract({ left: Math.round(box.x), top: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) })
            .toFile(croppedPath)

        let match = await cp.calcSimilarity(targetPath, croppedPath, 1)
        console.log('      btn_b similarity:', match.similarity.toFixed(4))
        assert(match.similarity >= 0.80, `預期 >= 0.80, 實際 ${match.similarity.toFixed(4)}`)
        assert(match.similarity <= 0.85, `預期 <= 0.85, 實際 ${match.similarity.toFixed(4)}`)
    })

    it('鑑別: 不同圖(btn_c)相似度 < 0.5', async function () {
        let box = await page.locator('.buttons img:nth-child(3)').boundingBox()
        let croppedPath = path.join(imgsDir, 'cropped_c.png')
        await sharp(screenshotPath)
            .extract({ left: Math.round(box.x), top: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) })
            .toFile(croppedPath)

        let match = await cp.calcSimilarity(targetPath, croppedPath, 1)
        console.log('      btn_c similarity:', match.similarity.toFixed(4))
        assert(match.similarity < 0.5, `預期 < 0.5, 實際 ${match.similarity.toFixed(4)}`)
    })

})
