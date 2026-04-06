import fs from 'fs'
import sharp from 'sharp'
import cvModule from '@techstark/opencv-js'
import get from 'lodash-es/get.js'
import isbol from 'wsemi/src/isbol.mjs'
import ispint from 'wsemi/src/ispint.mjs'
import isestr from 'wsemi/src/isestr.mjs'
import oc from 'wsemi/src/color.mjs'
import sc from './screen.mjs'


async function getCv() {
    let cv
    if (cvModule instanceof Promise) {
        cv = await cvModule
    }
    else if (cvModule.Mat) {
        //WASM已初始化完成, 直接使用
        cv = cvModule
    }
    else {
        await new Promise((resolve) => {
            cvModule.onRuntimeInitialized = () => resolve()
        })
        cv = cvModule
    }
    return { cv }
}

async function readImage(fp) {
    let { cv } = await getCv()

    //readFileSync, 使用readFileSync可支援中文路徑與中文檔名
    let buffer = fs.readFileSync(fp)

    //sharp decode to raw RGB
    let { data, info } = await sharp(buffer)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

    //create Mat from raw RGB data
    let mat = new cv.Mat(info.height, info.width, cv.CV_8UC3)
    mat.data.set(new Uint8Array(data))

    return mat
}

async function writeImage(fp, img) {

    //sharp encode to png
    let buffer = await sharp(Buffer.from(img.data), {
        raw: {
            width: img.cols,
            height: img.rows,
            channels: 3,
        }
    }).png().toBuffer()

    //writeFileSync, 使用writeFileSync可支援中文路徑與中文檔名
    fs.writeFileSync(fp, buffer)

}

async function calcSimilarityCore(imgTar, imgScreen, scale, opt = {}) {
    let { cv } = await getCv()

    //useToGray
    let useToGray = get(opt, 'useToGray')
    if (!isbol(useToGray)) {
        useToGray = false
    }

    //resize
    let imgTarResize = new cv.Mat()
    let newRows = Math.floor(imgTar.rows * scale)
    let newCols = Math.floor(imgTar.cols * scale)
    cv.resize(imgTar, imgTarResize, new cv.Size(newCols, newRows))

    //check
    if (imgTarResize.rows < 5 || imgTarResize.cols < 5) {
        let msg = `縮放後檢測尺寸過小: [imgTarResize:${imgTarResize.cols}x${imgTarResize.rows}]`
        imgTarResize.delete()
        throw new Error(msg)
    }

    //check
    if (imgTarResize.rows > imgScreen.rows || imgTarResize.cols > imgScreen.cols) {
        let msg = `縮放後檢測>截圖尺寸: [imgScreen:${imgScreen.cols}x${imgScreen.rows}] > [imgTarResize:${imgTarResize.cols}x${imgTarResize.rows}]`
        imgTarResize.delete()
        throw new Error(msg)
    }

    //useToGray
    let srcImg = imgScreen
    let tmplImg = imgTarResize
    let needDeleteSrc = false
    let needDeleteTmpl = false
    if (useToGray) {
        srcImg = new cv.Mat()
        cv.cvtColor(imgScreen, srcImg, cv.COLOR_RGB2GRAY)
        tmplImg = new cv.Mat()
        cv.cvtColor(imgTarResize, tmplImg, cv.COLOR_RGB2GRAY)
        needDeleteSrc = true
        needDeleteTmpl = true
    }

    //matchTemplate
    let result = new cv.Mat()
    if (useToGray) {
        cv.matchTemplate(srcImg, tmplImg, result, cv.TM_CCOEFF_NORMED) //標準化相關係數, 比較的是結構形狀, 代表相似度, 越大越像
    }
    else {
        cv.matchTemplate(srcImg, tmplImg, result, cv.TM_SQDIFF_NORMED) //標準化平方差, 對亮度與顏色敏感, 代表誤差度, 越小越像
    }

    //minMaxLoc
    let { maxVal, minVal, maxLoc, minLoc } = cv.minMaxLoc(result)

    //params
    let similarity = null
    let loc = null
    if (useToGray) {
        similarity = maxVal
        loc = maxLoc
    }
    else {
        similarity = 1 - minVal
        loc = minLoc
    }
    let x = loc.x
    let y = loc.y
    let width = imgTarResize.cols
    let height = imgTarResize.rows

    //cleanup
    result.delete()
    if (needDeleteSrc) srcImg.delete()
    if (needDeleteTmpl) tmplImg.delete()
    imgTarResize.delete()

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
    try {
        let match = await calcSimilarityCore(imgTar, imgScreen, scale, opt)
        return match
    }
    finally {
        imgScreen.delete()
        imgTar.delete()
    }

}

async function calcSimilarityAndDraw(fpTar, fpScreen, scale, fp, opt = {}) {
    let { cv } = await getCv()

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

    try {

        //calcSimilarityCore
        let m = await calcSimilarityCore(imgTar, imgScreen, scale, opt)
        // console.log('m',m)

        //topLeft, bottomRight
        let topLeft = new cv.Point(m.x, m.y)
        let bottomRight = new cv.Point(m.x + m.width, m.y + m.height)
        // console.log('topLeft',topLeft)
        // console.log('bottomRight',bottomRight)

        //rectangle
        cv.rectangle(
            imgScreen,
            topLeft,
            bottomRight,
            new cv.Scalar(drawBorderColor.r, drawBorderColor.g, drawBorderColor.b, 255),
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
    finally {
        imgScreen.delete()
        imgTar.delete()
    }

}

async function screenAndDrawCircle(x, y, width, height, px, py, fp, opt = {}) {
    let { cv } = await getCv()

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

    try {

        //center
        let center = new cv.Point(px, py)

        //circle
        cv.circle(
            imgScreen,
            center,
            drawCircleRadius,
            new cv.Scalar(drawBorderColor.r, drawBorderColor.g, drawBorderColor.b, 255),
            drawBorderWidth,
            cv.LINE_8 //8-connected線, 效果銳利清楚
        )

        //writeImage
        await writeImage(fp, imgScreen)

    }
    finally {
        imgScreen.delete()
    }

}

let obj = {
    calcSimilarity,
    calcSimilarityAndDraw,
    screenAndDrawCircle,
}


export default obj
