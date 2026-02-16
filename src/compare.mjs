import fs from 'fs'
import cv from '@u4/opencv4nodejs'
import get from 'lodash-es/get.js'
import isbol from 'wsemi/src/isbol.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import oc from 'wsemi/src/color.mjs'
import sc from './screen.mjs'


async function readImage(fp) {

    //readFileSync, 使用readFileSync可支援中文路徑與中文檔名
    let buffer = fs.readFileSync(fp)

    return cv.imdecode(buffer)
}

async function writeImage(fp, img) {

    //imencode, 轉成png格式
    let buffer = cv.imencode('.png', img) // 可用 .jpg, .bmp, .webp

    //writeFileSync, 使用writeFileSync可支援中文路徑與中文檔名
    fs.writeFileSync(fp, buffer)

}

async function calcSimilarityCore(imgTar, imgScreen, scale, opt = {}) {

    //useToGray
    let useToGray = get(opt, 'useToGray')
    if (!isbol(useToGray)) {
        useToGray = false
    }

    //resize
    let imgTarResize = imgTar.resize(
        Math.floor(imgTar.rows * scale),
        Math.floor(imgTar.cols * scale)
    )

    //check
    if (imgTarResize.rows < 5 || imgTarResize.cols < 5) {
        throw new Error(`縮放後檢測尺寸過小: [imgTarResize:${imgTarResize.cols}x${imgTarResize.rows}]`)
    }

    //check
    if (imgTarResize.rows > imgScreen.rows || imgTarResize.cols > imgScreen.cols) {
        throw new Error(`縮放後檢測>截圖尺寸: [imgScreen:${imgScreen.cols}x${imgScreen.rows}] > [imgTarResize:${imgTarResize.cols}x${imgTarResize.rows}]`)
    }

    //useToGray
    if (useToGray) {
        imgScreen = imgScreen.bgrToGray()
        imgTarResize = imgTarResize.bgrToGray()
    }

    //matchTemplate
    let result = null
    if (useToGray) {
        result = imgScreen.matchTemplate(imgTarResize, cv.TM_CCOEFF_NORMED) //標準化相關係數, 比較的是結構形狀, 代表相似度, 越大越像
    }
    else {
        result = imgScreen.matchTemplate(imgTarResize, cv.TM_SQDIFF_NORMED) //標準化平方差, 對亮度與顏色敏感, 代表誤差度, 越小越像
    }

    //minMaxLoc
    let { maxVal, minVal, maxLoc } = result.minMaxLoc()

    //params
    let similarity = null
    if (useToGray) {
        similarity = maxVal
    }
    else {
        similarity = 1 - minVal
    }
    let x = maxLoc.x
    let y = maxLoc.y
    let width = imgTarResize.cols
    let height = imgTarResize.rows

    //r
    let r = {
        similarity,
        x,
        y,
        width,
        height,
        scale,
    }

    return r
}

async function calcSimilarity(fpTar, fpScreen, scale, opt = {}) {

    //readImage
    let imgScreen = await readImage(fpScreen)
    let imgTar = await readImage(fpTar)

    //calcSimilarityCore
    let match = await calcSimilarityCore(imgTar, imgScreen, scale, opt)

    return match
}

async function calcSimilarityAndDraw(fpTar, fpScreen, scale, fp, opt = {}) {

    //drawBorderWidth
    let drawBorderWidth = get(opt, 'drawBorderWidth')
    if (!ispint(drawBorderWidth)) {
        drawBorderWidth = 2
    }
    // console.log('drawBorderWidth',drawBorderWidth)

    //drawBorderColor
    let drawBorderColor = get(opt, 'drawBorderColor')
    if (!isestr(drawBorderColor)) {
        drawBorderColor = '#f00'
    }
    drawBorderColor = oc.toRgb(drawBorderColor)
    // console.log('drawBorderColor',drawBorderColor)

    //readImage
    let imgScreen = await readImage(fpScreen)
    let imgTar = await readImage(fpTar)

    //calcSimilarityCore
    let m = await calcSimilarityCore(imgTar, imgScreen, scale, opt)
    // console.log('m',m)

    //topLeft, bottomRight
    let topLeft = new cv.Point2(m.x, m.y)
    let bottomRight = new cv.Point2(m.x + m.width, m.y + m.height)
    // console.log('topLeft',topLeft)
    // console.log('bottomRight',bottomRight)

    //drawRectangle
    imgScreen.drawRectangle(
        topLeft,
        bottomRight,
        new cv.Vec3(drawBorderColor.b, drawBorderColor.g, drawBorderColor.r),
        drawBorderWidth,
        cv.LINE_8 //8-connected線, 效果銳利清楚
    )

    //writeImage
    await writeImage(fp, imgScreen)

    //r
    let r = {
        ...m,
        fp,
    }

    return r
}

async function screenAndDrawCircle(x, y, width, height, px, py, fp, opt = {}) {

    //drawCircleRadius
    let drawCircleRadius = get(opt, 'drawCircleRadius')
    if (!ispint(drawCircleRadius)) {
        drawCircleRadius = 5
    }

    //drawBorderWidth
    let drawBorderWidth = get(opt, 'drawBorderWidth')
    if (!ispint(drawBorderWidth)) {
        drawBorderWidth = 2
    }

    //drawBorderColor
    let drawBorderColor = get(opt, 'drawBorderColor')
    if (!isestr(drawBorderColor)) {
        drawBorderColor = '#f00'
    }
    drawBorderColor = oc.toRgb(drawBorderColor)
    // console.log('drawBorderColor',drawBorderColor)

    //screenSave
    await sc.screenSave(x, y, width, height, fp)

    //readImage
    let imgScreen = await readImage(fp)

    //center
    let center = new cv.Point2(px, py)

    //drawCircle
    imgScreen.drawCircle(
        center,
        drawCircleRadius,
        new cv.Vec3(drawBorderColor.b, drawBorderColor.g, drawBorderColor.r),
        drawBorderWidth,
        cv.LINE_8 //8-connected線, 效果銳利清楚
    )

    //writeImage
    await writeImage(fp, imgScreen)

}

let obj = {
    calcSimilarity,
    calcSimilarityAndDraw,
    screenAndDrawCircle,
}


export default obj
