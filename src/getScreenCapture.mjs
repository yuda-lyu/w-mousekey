import fs from 'fs'
import path from 'path'
import defManifest from './binManifest.mjs'
import { mkErr, withHint, getCacheDir, getCacheRoot, locateGroup, ensureGroup } from './binEnsure.mjs'


//自行指定截圖exe之環境變數, 值為exe檔案路徑
let ENV_EXE = 'WMOUSEKEY_SCREENCAPTURE_EXE'


function getFileName(opt = {}) {
    let m = opt.manifest || defManifest
    return Object.keys(m.groups.screen.files)[0]
}


function getHint(opt = {}) {
    let m = opt.manifest || defManifest
    let name = getFileName(opt)
    let s1 = `To use your own copy instead of downloading (offline or restricted environments), set the environment variable ${ENV_EXE} to the path of a screen capture exe `
    let s2 = `(${name}, from https://github.com/${m.repo}/tree/${m.commit}/${m.groups.screen.dir}); the file taken from ${ENV_EXE} is used as it is, without SHA-256 verification. `
    let s3 = `Downloaded files are cached in ${getCacheDir('screen', opt)} (change the cache root with WMOUSEKEY_CACHE_DIR, currently ${getCacheRoot(opt)}).`
    return s1 + s2 + s3
}


//使用者自行指定之exe, 有設定就必須存在, 不退回下載(設定錯誤應直接讓使用者知道)
function getOverrideExe(opt = {}) {
    let env = opt.env || process.env
    let fp = env[ENV_EXE]
    if (!fp) {
        return ''
    }
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
        throw mkErr('E_OVERRIDE', `w-mousekey: ${ENV_EXE}="${fp}" is not an existing file`)
    }
    return path.resolve(fp)
}


/**
 * 取得截圖exe路徑(同步, 不下載)
 *
 * 查找順序: 環境變數WMOUSEKEY_SCREENCAPTURE_EXE指定之檔案 > 開發本repo時cwd下之_screenCapture/ > 使用者快取目錄內SHA-256相符之檔.
 * 快取目錄內內容不符之檔會被刪除, 不會被使用. 檔案尚未下載時拋錯, 請先呼叫ensureScreenCapture, 或直接使用screen各函數(其內會自動呼叫ensureScreenCapture).
 *
 * @param {Object} [opt={}] 內部參數(供測試注入env,cwd,manifest), 一般使用不需提供
 * @returns {String} 回傳截圖exe路徑
 * @example
 *
 * import getScreenCapture from 'w-mousekey/src/getScreenCapture.mjs'
 *
 * let fpExe = getScreenCapture()
 * console.log(fpExe)
 */
function getScreenCapture(opt = {}) {

    //override
    let fpOverride = getOverrideExe(opt)
    if (fpOverride) {
        return fpOverride
    }

    //dev or cache
    let r = null
    try {
        r = locateGroup('screen', opt)
    }
    catch (err) {
        throw withHint(err, getHint(opt))
    }
    if (r.missing.length > 0) {
        throw mkErr('E_NOT_READY', `w-mousekey: screen capture exe is not downloaded yet (missing or invalid in ${r.dir}: ${r.missing.join(', ')}). It is downloaded on first use, call "await ensureScreenCapture()" first or use the screen functions. ${getHint(opt)}`)
    }

    return path.join(r.dir, getFileName(opt))
}


/**
 * 確保截圖exe可用(非同步)
 *
 * 查找順序同getScreenCapture, 快取目錄內缺漏或內容不符者,自GitHub釘選提交下載至暫存檔,驗證SHA-256相符後才更名為正式檔名;
 * 驗證不符即刪除並拋錯,不會被使用. 下載失敗拋錯,訊息含網址與如何自行指定路徑.
 *
 * @param {Object} [opt={}] 內部參數(供測試注入env,cwd,manifest,fetch等), 一般使用不需提供
 * @returns {Promise<String>} 回傳Promise，resolve回傳截圖exe路徑
 * @example
 *
 * import { ensureScreenCapture } from 'w-mousekey/src/getScreenCapture.mjs'
 *
 * let fpExe = await ensureScreenCapture()
 * console.log(fpExe)
 */
async function ensureScreenCapture(opt = {}) {

    //override
    let fpOverride = getOverrideExe(opt)
    if (fpOverride) {
        return fpOverride
    }

    //dev or cache or download
    let r = await ensureGroup('screen', opt, getHint(opt))

    return path.join(r.dir, getFileName(opt))
}


export { ensureScreenCapture }
export default getScreenCapture
