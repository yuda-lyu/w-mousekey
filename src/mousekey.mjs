import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import genPm from 'wsemi/src/genPm.mjs'


//execFileAsync
let execFileAsync = promisify(execFile)

//fdSrv
let fdSrv = path.resolve()

//fnExe
let fnExe = 'AutoHotkey64.exe'
let fdExe = ''
if (true) {
    let fdExeSrc = `${fdSrv}/AutoHotkey_2.0.19/`
    let fdExeNM = `${fdSrv}/node_modules/w-mousekey/AutoHotkey_2.0.19/`
    if (fsIsFile(`${fdExeSrc}${fnExe}`)) {
        fdExe = fdExeSrc
    }
    else if (fsIsFile(`${fdExeNM}${fnExe}`)) {
        fdExe = fdExeNM
    }
    else {
        throw new Error('can not find folder for AutoHotkey')
    }
}
// console.log('fdExe', fdExe)

//AutoHotkey, 於windows直接下載免安裝檔調用
//https://www.autohotkey.com/download/
let ahkExePath = `${fdExe}/AutoHotkey64.exe` //path.resolve('./AutoHotkey_2.0.19/AutoHotkey64.exe')
let ahkScriptPathClick = `${fdExe}/zclick.ahk` //path.resolve('./AutoHotkey_2.0.19/zclick.ahk')
let ahkScriptPathDrag = `${fdExe}/zdrag.ahk` //path.resolve('./AutoHotkey_2.0.19/zclick.ahk')
let ahkScriptPathSend = `${fdExe}/zsend.ahk` //path.resolve('./AutoHotkey_2.0.19/zsend.ahk')

async function runAhkScript(ahkExePath, ahkScriptPath, args = []) {
    let pm = genPm()

    try {
        let { stdout, stderr } = await execFileAsync(ahkExePath, ['/force', ahkScriptPath, ...args])
        if (stderr) {
            // console.error('AHK error', stderr);
            pm.reject(stderr)
        }
        else {
            // console.log('AHK success', stdout);
            pm.resolve(stdout)
        }
    }
    catch (err) {
        // console.error('AHK error', err);
        pm.reject(err)
    }

    return pm
}

async function mouseClick(x, y) {
    await runAhkScript(ahkExePath, ahkScriptPathClick, [x, y])
}

async function mouseDrag(x1, y1, x2, y2) {
    await runAhkScript(ahkExePath, ahkScriptPathDrag, [x1, y1, x2, y2])
}

// async function mouseDown(x, y) {
// }

// async function mouseUp(x, y) {
// }

// async function keyDown(char) {
// }

// async function keyUp(char) {
// }

async function sendKey(char) {
    await runAhkScript(ahkExePath, ahkScriptPathSend, [`${char}`])
}

async function sendString(str) {
    await runAhkScript(ahkExePath, ahkScriptPathSend, [`${str}`])
}

let obj = {
    // mouseDown,
    // mouseUp,
    mouseClick,
    mouseDrag,
    // keyDown,
    // keyUp,
    sendKey,
    sendString,
}


export default obj
