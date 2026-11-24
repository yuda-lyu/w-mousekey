import wpw from 'w-playwright'


//測試用: 集中取得Playwright受管瀏覽器(headless shell, 約130MB; 規則R08), 供需要它之測試於before一次取得, 不在it內取得
//(it受全域--timeout 180000約束, 慢網路下載逾時即案失敗; 取得失敗即失敗, 不靜默略過, 乾淨環境才不會悄悄不跑)


//安裝預算(毫秒): 取得時以ensureChromium之timeout給之上限, 逾時由w-playwright結束安裝子行程樹並reject
//取值依據: headless shell壓縮檔約129.8MB(chrome-headless-shell-win64.zip)+ffmpeg約1.7MB+winldd約0.13MB=約131MB;
//900000ms(15分鐘)可容忍持續頻寬約0.146MB/s(約1.2Mbit/s)以上; 全域案時限180000ms(舊寫法於it內取得所受之限制)僅容忍約0.73MB/s(約5.8Mbit/s)以上
export const PW_INSTALL_BUDGET_MS = 900000

//取得所在before之時限一律寫成this.timeout(PW_INSTALL_BUDGET_MS + 60000): 預算+60秒之收尾餘裕(安裝逾時之收尾最多再等10秒結束子行程樹)

//離線旗標: 沿用本套件既有之W_BIN_OFFLINE(wsemi之fsEnsureBins所讀, 值為1或true不分大小寫)
export const OFFLINE_ENV = 'W_BIN_OFFLINE'


//isOffline, 是否為明確宣告之離線環境
export function isOffline(env) {
    let v = env && typeof env[OFFLINE_ENV] === 'string' ? env[OFFLINE_ENV].trim().toLowerCase() : ''
    return v === '1' || v === 'true'
}


//模組載入時讀取離線旗標: 載入發生於任何測試改動環境變數之前(setBinEnv於測試內才設W_BIN_OFFLINE=1並於測後還原), 故不受其影響
export const OFFLINE_AT_LOAD = isOffline(process.env)


//安裝子行程之輸出末段上限(字元)
const TAIL_MAX = 2000


//去除終端機控制碼(ESC序列; 以字元碼組正則, 免於正則字面值含控制字元)
const ANSI_RE = new RegExp(String.fromCharCode(27) + '\\[[0-9;?]*[A-Za-z]', 'g')
function stripAnsi(s) {
    return String(s).replace(ANSI_RE, '')
}

//遮罩網址整串(診斷輸出與遮罩規格D3: 對外錯誤值只遮憑證, 網址整串含其中之帳密與內網鏡像位址; 下載主機可由PLAYWRIGHT_DOWNLOAD_HOST指向內網)
function maskUrls(s) {
    return String(s).replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
}


/**
 * 建立取得工具(deps供測試注入: ensure、offline、log、now)
 *
 * @param {Object} [deps] 內部: 測試注入{ ensure, offline, log, now }
 * @returns {Object} 回傳{ ensurePwBrowser, ensurePwBrowserOrSkip }
 */
export function createPwBrowserTool(deps = {}) {
    let ensure = deps.ensure || ((o) => wpw.ensureChromium(o))
    let offline = typeof deps.offline === 'boolean' ? deps.offline : OFFLINE_AT_LOAD
    let log = deps.log || ((s) => console.log(s))
    let now = deps.now || (() => Date.now())

    let memo = null

    //ensurePwBrowser, 取得受管瀏覽器(同行程只做一次, 成功與失敗皆記憶: 失敗後同行程之後續呼叫立即得同一錯誤, 不各再等滿預算)
    //失敗時拋錯, 訊息附安裝子行程輸出末段(去色碼), 原錯誤放cause與code
    function ensurePwBrowser() {
        if (memo) {
            return memo
        }
        memo = (async () => {
            let kind = 'headless-shell'
            let t0 = now()
            let starts = 0
            let downloads = 0
            let tail = ''
            let onTrace = (ev) => {
                if (ev && ev.type === 'install-start') {
                    starts++
                }
            }
            let funLog = (label, safe, detail) => {
                if (label === 'install-output' || label === 'install-error') {
                    let s = stripAnsi(label === 'install-error' && detail && detail.message ? detail.message : detail)
                    //依Playwright輸出計: npm_config_loglevel為silent/error/warn時Playwright不印Downloading行, 計數恆為0(以鏡像紀錄或瀏覽器目錄之產物為準)
                    downloads += (s.match(/^\s*Downloading\b/gm) || []).length
                    tail = (tail + maskUrls(s)).slice(-TAIL_MAX)
                }
            }
            try {
                await ensure({ kind, timeout: PW_INSTALL_BUDGET_MS, onTrace, funLog })
            }
            catch (err) {
                let msg = `[pw-browser] 取得Playwright受管瀏覽器(${kind})失敗(預算${PW_INSTALL_BUDGET_MS}ms, 已用${now() - t0}ms; ${err && err.code ? err.code + ': ' : ''}${err && err.message}); 安裝輸出末段: ${tail.trim() || '(無)'}`
                let e = new Error(msg, { cause: err })
                if (err && err.code) {
                    e.code = err.code
                }
                throw e
            }
            log(`[pw-browser] Playwright受管瀏覽器(${kind})已備妥: 安裝程序${starts}次, 下載動作${downloads}次(依Playwright輸出計), 用時${now() - t0}ms`)
            return { kind, starts, downloads, ms: now() - t0 }
        })()
        return memo
    }

    //ensurePwBrowserOrSkip, 測試之before用: 成功回null; 失敗時, 僅明確離線環境(W_BIN_OFFLINE為1或true)回略過原因字串(並輸出原因), 其餘一律拋錯(不略過)
    async function ensurePwBrowserOrSkip() {
        try {
            await ensurePwBrowser()
            return null
        }
        catch (err) {
            if (!offline) {
                throw err
            }
            let reason = `[pw-browser] 略過需受管瀏覽器之測試: 已宣告離線環境(${OFFLINE_ENV}=1)且無法取得受管瀏覽器(請於可連網之機器取得後以PLAYWRIGHT_BROWSERS_PATH帶入, 見README); 原因: ${err.message}`
            log(reason)
            return reason
        }
    }

    return { ensurePwBrowser, ensurePwBrowserOrSkip }
}


const tool = createPwBrowserTool()
export const ensurePwBrowser = tool.ensurePwBrowser
export const ensurePwBrowserOrSkip = tool.ensurePwBrowserOrSkip
