import fs from 'fs'
import path from 'path'
import defManifest from './binManifest.mjs'
import { mkErr, withHint, getCacheDir, getCacheRoot, locateGroup, ensureGroup } from './binEnsure.mjs'


//自行指定AutoHotkey資料夾之環境變數, 資料夾內須有AutoHotkey64.exe與六個z*.ahk
let ENV_DIR = 'WMOUSEKEY_AHK_DIR'


function toPaths(dir) {
    let fd = path.resolve(dir)
    return {
        ahkExePath: path.join(fd, 'AutoHotkey64.exe'),
        ahkScriptPathClick: path.join(fd, 'zclick.ahk'),
        ahkScriptPathDrag: path.join(fd, 'zdrag.ahk'),
        ahkScriptPathSend: path.join(fd, 'zsend.ahk'),
        ahkScriptPathSendCombo: path.join(fd, 'zsendcombo.ahk'),
        ahkScriptPathWheel: path.join(fd, 'zwheel.ahk'),
        ahkScriptPathRecord: path.join(fd, 'zrecord.ahk'),
    }
}


function getHint(opt = {}) {
    let m = opt.manifest || defManifest
    let names = Object.keys(m.groups.ahk.files).join(', ')
    let s1 = `To use your own copy instead of downloading (offline or restricted environments), set the environment variable ${ENV_DIR} to a folder that contains ${names} `
    let s2 = `(the "${m.groups.ahk.dir}" folder of https://github.com/${m.repo}/tree/${m.commit}); files taken from ${ENV_DIR} are used as they are, without SHA-256 verification. `
    let s3 = `Downloaded files are cached in ${getCacheDir('ahk', opt)} (change the cache root with WMOUSEKEY_CACHE_DIR, currently ${getCacheRoot(opt)}).`
    return s1 + s2 + s3
}


//使用者自行指定之資料夾, 有設定就必須完整, 不退回下載(設定錯誤應直接讓使用者知道)
function getOverrideDir(opt = {}) {
    let m = opt.manifest || defManifest
    let env = opt.env || process.env
    let dir = env[ENV_DIR]
    if (!dir) {
        return ''
    }
    let missing = Object.keys(m.groups.ahk.files).filter((name) => {
        try {
            return !fs.statSync(path.join(dir, name)).isFile()
        }
        catch (err) {
            return true
        }
    })
    if (missing.length > 0) {
        throw mkErr('E_OVERRIDE', `w-mousekey: ${ENV_DIR}="${dir}" is missing or has no regular file named: ${missing.join(', ')}`)
    }
    return dir
}


/**
 * 取得AutoHotkey執行檔與腳本檔路徑(同步, 不下載)
 *
 * 查找順序: 環境變數WMOUSEKEY_AHK_DIR指定之資料夾 > 開發本repo時cwd下之_autoHotkey/ > 使用者快取目錄內SHA-256相符之檔.
 * 快取目錄內內容不符之檔會被刪除, 不會被使用. 檔案尚未下載時拋錯, 請先呼叫ensureAhk, 或直接使用mousekey各函數(其內會自動呼叫ensureAhk).
 *
 * @param {Object} [opt={}] 內部參數(供測試注入env,cwd,manifest), 一般使用不需提供
 * @returns {Object} 回傳物件，包含ahkExePath,ahkScriptPathClick,ahkScriptPathDrag,ahkScriptPathSend,ahkScriptPathSendCombo,ahkScriptPathWheel,ahkScriptPathRecord
 * @example
 *
 * import getAhk from 'w-mousekey/src/getAhk.mjs'
 *
 * let ak = getAhk()
 * console.log(ak.ahkExePath)
 */
function getAhk(opt = {}) {

    //override
    let dirOverride = getOverrideDir(opt)
    if (dirOverride) {
        return toPaths(dirOverride)
    }

    //dev or cache
    let r = null
    try {
        r = locateGroup('ahk', opt)
    }
    catch (err) {
        throw withHint(err, getHint(opt))
    }
    if (r.missing.length > 0) {
        throw mkErr('E_NOT_READY', `w-mousekey: AutoHotkey files are not downloaded yet (missing or invalid in ${r.dir}: ${r.missing.join(', ')}). They are downloaded on first use, call "await ensureAhk()" first or use the mouse and keyboard functions. ${getHint(opt)}`)
    }

    return toPaths(r.dir)
}


/**
 * 確保AutoHotkey執行檔與腳本檔可用(非同步)
 *
 * 查找順序同getAhk, 快取目錄內缺漏或內容不符者,自GitHub釘選提交下載至暫存檔,驗證SHA-256相符後才更名為正式檔名;
 * 驗證不符即刪除並拋錯,不會被使用. 下載失敗拋錯,訊息含網址與如何自行指定路徑.
 *
 * @param {Object} [opt={}] 內部參數(供測試注入env,cwd,manifest,fetch等), 一般使用不需提供
 * @returns {Promise<Object>} 回傳Promise，resolve回傳物件同getAhk
 * @example
 *
 * import { ensureAhk } from 'w-mousekey/src/getAhk.mjs'
 *
 * let ak = await ensureAhk()
 * console.log(ak.ahkExePath)
 */
async function ensureAhk(opt = {}) {

    //override
    let dirOverride = getOverrideDir(opt)
    if (dirOverride) {
        return toPaths(dirOverride)
    }

    //dev or cache or download
    let r = await ensureGroup('ahk', opt, getHint(opt))

    return toPaths(r.dir)
}


export { ensureAhk }
export default getAhk
