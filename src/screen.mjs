import fs from 'fs'
import os from 'os'
import path from 'path'
import sharp from 'sharp'
import screenshot from 'screenshot-desktop'
import execProcess from 'wsemi/src/execProcess.mjs'
import { ensureScreenCapture } from './getScreenCapture.mjs'


let _initialized = false
let _externalScreenshot = null
let _shotSeq = 0


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


//Windows特化截圖: 直接以「完整路徑」spawn截圖exe(首次使用時自GitHub下載並驗證, 見getScreenCapture)
//why: 當環境變數NoDefaultCurrentDirectoryInExePath=1時, screenshot-desktop的.bat最後一行
//     以裸檔名(%~n0.exe)執行exe, cmd不會在當前目錄搜尋裸檔名而報「不是內部或外部命令」;
//     exe本身功能正常(完整路徑可正常截圖), 故改以完整路徑直接執行即可繞過此限制
async function getScreenWin32() {

    //resolve exe
    let fpExe = await ensureScreenCapture()

    //output, 放在系統temp
    _shotSeq += 1
    let fpOut = path.join(os.tmpdir(), `w-mousekey-shot-${process.pid}-${_shotSeq}.png`)

    //以完整路徑直接執行exe, 截全螢幕存成png (execProcess的windowsHide已內建, 避免閃出console視窗)
    await execProcess(fpExe, [fpOut], { mode: 'execFile' })

    //read & cleanup
    let img = fs.readFileSync(fpOut)
    try {
        fs.unlinkSync(fpOut)
    }
    catch (err) {
        //ignore
    }

    return img
}

async function getScreen() {

    let img

    if (_initialized && _externalScreenshot) {
        //使用外部注入的截圖函數
        img = await _externalScreenshot()
    }
    else if (process.platform === 'win32') {
        //Windows特化處理: 繞過screenshot-desktop的.bat裸檔名執行限制
        img = await getScreenWin32()
    }
    else {
        //其他平台: 使用內建screenshot-desktop
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
