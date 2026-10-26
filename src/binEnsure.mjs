import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import defManifest from './binManifest.mjs'


//同行程內同一目的檔之下載只做一次(並行呼叫共用同一個promise)
let _inflight = new Map()


function mkErr(code, msg, extra = {}) {
    let err = new Error(msg)
    err.code = code
    Object.assign(err, extra)
    return err
}


function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}


function sha256File(fp) {
    return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex')
}


//以新錯誤物件包裝, 不就地修改原錯誤(原生逾時之DOMException.message唯讀; 並行呼叫共用同一個錯誤物件), 原錯誤放cause, 並帶出code與status
function wrapErr(err, msg) {
    let errNew = new Error(msg, { cause: err })
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        errNew.code = 'E_TIMEOUT'
    }
    else if (err && typeof err.code === 'string') {
        errNew.code = err.code
    }
    if (err && err.status !== undefined) {
        errNew.status = err.status
    }
    if (err && err.cleanupError) {
        errNew.cleanupError = err.cleanupError
    }
    return errNew
}


function withHint(err, hint) {
    if (!hint) {
        return err
    }
    return wrapErr(err, `${err.message}\n${hint}`)
}


function sameIdentity(a, b) {
    return a.size === b.size && a.mtimeMs === b.mtimeMs && a.ino === b.ino
}


//檔案狀態: ok(大小與SHA-256皆相符), missing(不存在), mismatch(存在但內容不符或非一般檔案), 並帶出檢查時之檔案身分
function inspectFile(fp, spec) {
    let st
    try {
        st = fs.statSync(fp)
    }
    catch (err) {
        return { state: 'missing', stat: null }
    }
    if (!st.isFile() || st.size !== spec.size) {
        return { state: 'mismatch', stat: st }
    }
    try {
        return { state: sha256File(fp) === spec.sha256 ? 'ok' : 'mismatch', stat: st }
    }
    catch (err) {
        return { state: 'mismatch', stat: st }
    }
}


function checkFile(fp, spec) {
    return inspectFile(fp, spec).state
}


//檢查並處置檔案: 內容不符者刪除, 回傳最終狀態ok或missing, 刪不掉即拋錯(不得留著被使用)
//刪除前再取一次檔案身分: 與檢查時不同(別的行程在檢查後剛換了檔)就不刪, 重新檢查,
//避免依過期的檢查結果刪掉別的行程剛下載完成的好檔(縮小而非完全消除檢查與刪除之間的窗口)
function settleFile(fp, spec) {
    for (let i = 0; i < 3; i++) {
        let r = inspectFile(fp, spec)
        if (r.state !== 'mismatch') {
            return r.state
        }
        let st2 = null
        try {
            st2 = fs.statSync(fp)
        }
        catch (err) {
            return 'missing'
        }
        if (!sameIdentity(r.stat, st2)) {
            continue
        }
        try {
            fs.rmSync(fp, { force: true })
        }
        catch (err) {
            throw mkErr('E_BAD_FILE', `w-mousekey: "${fp}" does not match the expected SHA-256 and can not be removed (${err.message}), remove it manually`)
        }
        return 'missing'
    }
    throw mkErr('E_BAD_FILE', `w-mousekey: "${fp}" keeps changing while it is being checked, another process may be writing it`)
}


//下載目的地: 使用者快取目錄(非套件目錄)
//why: 套件目錄(node_modules/w-mousekey, 全域安裝, 容器映像)可能唯讀, 重裝套件時會被清掉而須重新下載, 且各專案各存一份;
//     使用者快取目錄則可寫, 跨專案共用, 重裝套件後仍在. 子目錄帶提交雜湊, 升版後新舊檔不互相覆蓋.
function getCacheRoot(opt = {}) {
    let env = opt.env || process.env
    if (env.WMOUSEKEY_CACHE_DIR) {
        return path.resolve(env.WMOUSEKEY_CACHE_DIR)
    }
    let base
    if (process.platform === 'win32') {
        base = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    }
    else {
        base = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache')
    }
    return path.join(base, 'w-mousekey')
}


function getCacheDir(groupName, opt = {}) {
    let m = opt.manifest || defManifest
    return path.join(getCacheRoot(opt), m.commit.slice(0, 12), m.groups[groupName].dir)
}


function getUrl(groupName, name, opt = {}) {
    let m = opt.manifest || defManifest
    return `${m.rawBase}${m.groups[groupName].dir}/${name}`
}


//開發本repo時(cwd為w-mousekey之repo根, 且該資料夾內群組之每個檔都是一般檔案)直接用repo內檔案, 不驗證雜湊(開發者會改z*.ahk)
function findDevDir(groupName, opt = {}) {
    let m = opt.manifest || defManifest
    let g = m.groups[groupName]
    let cwd = opt.cwd || process.cwd()
    let name = ''
    try {
        name = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name
    }
    catch (err) {
        //ignore
    }
    if (name !== 'w-mousekey') {
        return ''
    }
    let dir = path.join(cwd, g.dir)
    for (let n of Object.keys(g.files)) {
        try {
            if (!fs.statSync(path.join(dir, n)).isFile()) {
                return ''
            }
        }
        catch (err) {
            return ''
        }
    }
    return dir
}


/**
 * 取得群組(ahk或screen)之本機目錄, 不下載
 *
 * @private
 * @param {String} groupName 群組名稱, 可為'ahk'或'screen'
 * @param {Object} [opt={}] 內部參數(測試傳入), 可含env,cwd,manifest
 * @returns {Object} 回傳物件{dir,source,missing}, source為'dev'(repo內)或'cache'(快取目錄), missing為快取目錄內缺漏或內容不符(已刪除)之檔名陣列
 */
function locateGroup(groupName, opt = {}) {
    let m = opt.manifest || defManifest
    let g = m.groups[groupName]

    //dev
    let dirDev = findDevDir(groupName, opt)
    if (dirDev) {
        return { dir: dirDev, source: 'dev', missing: [] }
    }

    //cache
    let dir = getCacheDir(groupName, opt)
    let missing = []
    for (let [name, spec] of Object.entries(g.files)) {
        let st = settleFile(path.join(dir, name), spec)
        if (st !== 'ok') {
            missing.push(name)
        }
    }

    return { dir, source: 'cache', missing }
}


//取得檔案內容, 暫時性失敗(網路例外,逾時,5xx,429)重試, 其餘直接拋錯
async function fetchBuffer(url, opt = {}) {
    let fetchFn = opt.fetch || globalThis.fetch
    if (typeof fetchFn !== 'function') {
        throw mkErr('E_NO_FETCH', 'global fetch is not available, Node.js 18 or later is required')
    }
    let attempts = opt.attempts ?? 3
    let timeoutMs = opt.timeoutMs ?? 60000
    let retryDelayMs = opt.retryDelayMs ?? 500
    let lastErr = null
    for (let i = 1; i <= attempts; i++) {
        try {
            let res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) })
            if (!res.ok) {
                let retry = res.status >= 500 || res.status === 429
                throw mkErr('E_HTTP', `HTTP ${res.status} ${res.statusText || ''}`.trim(), { status: res.status, noRetry: !retry })
            }
            return Buffer.from(await res.arrayBuffer())
        }
        catch (err) {
            lastErr = err
            if (err.noRetry || i >= attempts) {
                break
            }
            await sleep(retryDelayMs * i)
        }
    }
    throw lastErr
}


//更名, Windows下剛寫入之exe偶遭防毒掃描占用而更名失敗, 故重試; 仍失敗但目的檔已是正確內容(別的行程已完成)視為成功
async function renameToFinal(fpTmp, fp, spec, opt = {}) {
    let retryDelayMs = opt.retryDelayMs ?? 500
    let lastErr = null
    for (let i = 1; i <= 5; i++) {
        try {
            fs.renameSync(fpTmp, fp)
            return
        }
        catch (err) {
            lastErr = err
            if (checkFile(fp, spec) === 'ok') {
                return
            }
            if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
                break
            }
            await sleep(Math.min(retryDelayMs, 200) * i)
        }
    }
    if (checkFile(fp, spec) === 'ok') {
        return
    }
    throw lastErr
}


//刪除暫存檔, 暫時性占用(防毒掃描)重試, 回傳最後的錯誤(成功回傳null), 由呼叫端決定如何呈現
async function removeTemp(fpTmp, opt = {}) {
    let retryDelayMs = opt.retryDelayMs ?? 500
    let lastErr = null
    for (let i = 1; i <= 3; i++) {
        try {
            fs.rmSync(fpTmp, { force: true })
            return null
        }
        catch (err) {
            lastErr = err
            if (!['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
                break
            }
            await sleep(Math.min(retryDelayMs, 200) * i)
        }
    }
    return lastErr
}


async function downloadFile(groupName, name, opt = {}) {
    let m = opt.manifest || defManifest
    let spec = m.groups[groupName].files[name]
    let dir = getCacheDir(groupName, opt)
    let fp = path.join(dir, name)
    let url = getUrl(groupName, name, opt)

    //別的行程可能剛下載完; 若有同名但內容不符之檔則先刪除
    if (settleFile(fp, spec) === 'ok') {
        return fp
    }

    //暫存名帶pid與亂數, 並行之兩次下載(同行程或跨行程)各寫各的暫存檔, 驗證後才更名為正式檔名
    let fpTmp = `${fp}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.part`
    let errMain = null
    try {
        fs.mkdirSync(dir, { recursive: true })
        let buf = await fetchBuffer(url, opt)
        fs.writeFileSync(fpTmp, buf)
        if (checkFile(fpTmp, spec) !== 'ok') {
            let got = 'unreadable'
            try {
                got = sha256File(fpTmp)
            }
            catch (err) {
                //ignore
            }
            throw mkErr('E_HASH_MISMATCH', `SHA-256 mismatch, expected ${spec.sha256} (${spec.size} bytes), got ${got} (${buf.length} bytes), the download is rejected`)
        }
        await renameToFinal(fpTmp, fp, spec, opt)
    }
    catch (err) {
        errMain = err
    }

    //不論成敗皆清暫存檔; 清不掉要讓使用者看到, 不可謊稱已丟棄
    let errClean = await removeTemp(fpTmp, opt)
    if (errMain) {
        let cause = errMain.cause ? ` (${errMain.cause.code || errMain.cause.message})` : ''
        let note = errClean ? ` (the temporary file "${fpTmp}" could not be removed: ${errClean.message})` : ''
        let errNew = wrapErr(errMain, `w-mousekey: failed to download "${name}" from ${url}: ${errMain.message}${cause}${note}`)
        if (errClean) {
            errNew.cleanupError = errClean
        }
        throw errNew
    }

    return fp
}


//下載缺漏者, 全部結束後才回報錯誤(避免回報錯誤時仍有下載在背景進行)
async function downloadMissing(groupName, dir, missing, opt) {
    let rs = await Promise.allSettled(missing.map((name) => {
        let fp = path.join(dir, name)
        if (!_inflight.has(fp)) {
            _inflight.set(fp, downloadFile(groupName, name, opt).finally(() => {
                _inflight.delete(fp)
            }))
        }
        return _inflight.get(fp)
    }))
    let bad = rs.find((v) => v.status === 'rejected')
    if (bad) {
        throw bad.reason
    }
}


/**
 * 確保群組(ahk或screen)之檔案可用: 開發repo內有則用, 否則快取目錄內雜湊相符者用, 缺漏或不符者自釘選提交下載並驗證
 *
 * 補下載期間先前已通過檢查之檔可能被別的行程改動, 故補完後重新驗證整個群組, 最多補兩輪.
 *
 * @private
 * @param {String} groupName 群組名稱, 可為'ahk'或'screen'
 * @param {Object} [opt={}] 內部參數(測試傳入), 可含env,cwd,manifest,fetch,attempts,timeoutMs,retryDelayMs
 * @param {String} [hint=''] 失敗時附加於錯誤訊息之說明(如何自行指定路徑)
 * @returns {Promise<Object>} 回傳Promise, resolve為{dir,source}
 */
async function ensureGroup(groupName, opt = {}, hint = '') {
    let r = null
    try {
        r = locateGroup(groupName, opt)
        for (let pass = 0; pass < 2 && r.missing.length > 0; pass++) {
            await downloadMissing(groupName, r.dir, r.missing, opt)
            r = locateGroup(groupName, opt)
        }
    }
    catch (err) {
        throw withHint(err, hint)
    }
    if (r.missing.length > 0) {
        throw withHint(mkErr('E_NOT_READY', `w-mousekey: files in ${r.dir} are not valid after download: ${r.missing.join(', ')}, another process may be modifying them`), hint)
    }

    return { dir: r.dir, source: r.source }
}


export {
    mkErr,
    withHint,
    sha256File,
    checkFile,
    getCacheRoot,
    getCacheDir,
    getUrl,
    locateGroup,
    ensureGroup
}
