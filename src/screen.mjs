import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import screenshot from 'screenshot-desktop'
import sharp from 'sharp'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'


const execFileP = promisify(execFile)


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


//取得截圖exe路徑, 比照getAhk作法: 開發時於套件根目錄, 被安裝為相依套件時於node_modules/w-mousekey/下
function getScreenCaptureExe() {
    let fdSrv = path.resolve()
    let fnExe = 'screenCapture_1.3.2.exe'
    let fpExeSrc = `${fdSrv}/_screenCapture/${fnExe}`
    let fpExeNM = `${fdSrv}/node_modules/w-mousekey/_screenCapture/${fnExe}`
    if (fsIsFile(fpExeSrc)) {
        return fpExeSrc
    }
    else if (fsIsFile(fpExeNM)) {
        return fpExeNM
    }
    else {
        throw new Error('can not find screenCapture exe')
    }
}

//Windows特化截圖: 直接以「完整路徑」spawn套件自帶的exe
//why: 當環境變數NoDefaultCurrentDirectoryInExePath=1時, screenshot-desktop的.bat最後一行
//     以裸檔名(%~n0.exe)執行exe, cmd不會在當前目錄搜尋裸檔名而報「不是內部或外部命令」;
//     exe本身功能正常(完整路徑可正常截圖), 故改以完整路徑直接執行即可繞過此限制
async function getScreenWin32() {

    //resolve exe
    let fpExe = getScreenCaptureExe()

    //output, 放在系統temp
    _shotSeq += 1
    let fpOut = path.join(os.tmpdir(), `w-mousekey-shot-${process.pid}-${_shotSeq}.png`)

    //以完整路徑直接執行exe, 截全螢幕存成png (windowsHide避免閃出console視窗)
    await execFileP(fpExe, [fpOut], { windowsHide: true })

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
