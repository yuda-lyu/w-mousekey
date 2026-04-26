import path from 'path'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'


function getAhk() {

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
    let ahkExePath = `${fdExe}/AutoHotkey64.exe`
    let ahkScriptPathClick = `${fdExe}/zclick.ahk`
    let ahkScriptPathDrag = `${fdExe}/zdrag.ahk`
    let ahkScriptPathSend = `${fdExe}/zsend.ahk`
    let ahkScriptPathSendCombo = `${fdExe}/zsendcombo.ahk`
    let ahkScriptPathWheel = `${fdExe}/zwheel.ahk`
    let ahkScriptPathRecord = `${fdExe}/zrecord.ahk`

    return {
        ahkExePath,
        ahkScriptPathClick,
        ahkScriptPathDrag,
        ahkScriptPathSend,
        ahkScriptPathSendCombo,
        ahkScriptPathWheel,
        ahkScriptPathRecord,
    }
}


export default getAhk
