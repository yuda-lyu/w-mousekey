import fs from 'fs'
import screenshot from 'screenshot-desktop'
import sharp from 'sharp'


let _initialized = false
let _externalScreenshot = null


/**
 * @param {Object} opt
 * @param {Function} opt.screenshot - async () => Buffer(png), 回傳整個畫面的PNG Buffer
 */
function init(opt = {}) {
    if (typeof opt.screenshot === 'function') {
        _externalScreenshot = opt.screenshot
        _initialized = true
    }
}


async function getScreen() {

    let img

    if (_initialized && _externalScreenshot) {
        //使用外部注入的截圖函數
        img = await _externalScreenshot()
    }
    else {
        //未初始化, 使用內建screenshot-desktop
        img = await screenshot({ format: 'png' })
    }

    //check
    if (!img || img.length === 0) {
        console.log('img', img)
        throw new Error(`can not get the screenshot`)
    }

    return img
}

async function screenFull() {

    //screenshot
    let img = await getScreen()

    return img
}

async function screen(x, y, width, height) {

    //screenshot
    let img = await getScreen()

    //cut
    let buffer = await sharp(img)
        .extract({ left: x, top: y, width, height })
        .toBuffer()

    return buffer
}

async function screenFullSave(fp) {

    //screenshot
    let img = await getScreen()

    //writeFileSync
    fs.writeFileSync(fp, img)

    return img
}

async function screenSave(x, y, width, height, fp) {

    //screenshot
    let img = await getScreen()

    //cut
    let buffer = await sharp(img)
        .extract({ left: x, top: y, width, height })
        .toBuffer()

    //writeFileSync
    fs.writeFileSync(fp, buffer)

    return buffer
}

let obj = {
    init,
    screenFull,
    screen,
    screenFullSave,
    screenSave,
}


export default obj
