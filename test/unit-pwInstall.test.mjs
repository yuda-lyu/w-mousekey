//R08(規則帳本): 需Playwright受管瀏覽器之測試, 集中於before取得(時限對齊安裝預算), 取得失敗即失敗(不靜默略過), 僅明確離線環境才略過並輸出原因
//規格(全域測試規範之取得工具集中於before, 缺工具不得靜默略過): ①取得移至before並以PW_INSTALL_BUDGET_MS(900000)為ensureChromium之timeout; ②預設取得失敗即失敗, 只有明確離線(W_BIN_OFFLINE)才略過且輸出原因
//不需桌面、不啟動瀏覽器; 單元案以注入之替身ensure驗政策, 真路徑案(PI-8,PI-8b,PI-9)於獨立子行程以真w-playwright、空瀏覽器夾與不通之下載主機驗(不連外網、不動使用者層級之瀏覽器快取)
//跑法: npx mocha --no-parallel test/unit-pwInstall.test.mjs --timeout 180000
import assert from 'assert'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import wpw from 'w-playwright'
import { PW_INSTALL_BUDGET_MS, OFFLINE_AT_LOAD, isOffline, createPwBrowserTool } from './tools/pwInstall.mjs'
import { tmpRoot } from './tools/binEnv.mjs'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const childFile = path.join(testDir, 'tools', 'pwInstallChild.mjs')
const fdWork = path.join(tmpRoot, 'pwInstall')

//去註解(區塊註解與行註解; 行註解之//前一字元為冒號者視為網址(如https://)而保留)
function stripComments(s) {
    return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '')
}

function listMjs(dir, acc = []) {
    for (let ent of fs.readdirSync(dir, { withFileTypes: true })) {
        let fp = path.join(dir, ent.name)
        if (ent.isDirectory()) {
            if (ent.name !== '_tmp') {
                listMjs(fp, acc)
            }
        }
        else if (ent.name.endsWith('.mjs')) {
            acc.push(fp)
        }
    }
    return acc
}

//取一個未被占用之本機埠(listen(0)後關閉), 作為連線被拒之下載主機
function freePort() {
    return new Promise((resolve, reject) => {
        let srv = net.createServer()
        srv.on('error', reject)
        srv.listen(0, '127.0.0.1', () => {
            let { port } = srv.address()
            srv.close(() => resolve(port))
        })
    })
}

//子行程之看門狗上限(毫秒; 僅防懸置, 不表達規格: 正常約2秒內結束)
const CHILD_WATCHDOG_MS = 120000
const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout

//於子行程以真w-playwright呼叫ensurePwBrowserOrSkip; env為完整環境(不繼承父行程之W_BIN_OFFLINE與Playwright相關變數)
function runChild(env) {
    return new Promise((resolve, reject) => {
        let cp = spawn(process.execPath, [childFile], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
        let out = ''
        let err = ''
        //看門狗: 逾時結束子行程樹(其下之安裝子行程一併結束), 避免與after刪除目錄競爭
        let wd = realSetTimeout(() => {
            spawn('taskkill', ['/pid', String(cp.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
            reject(new Error(`子行程逾${CHILD_WATCHDOG_MS}ms未結束(看門狗): ${out.slice(-300)} ${err.slice(-300)}`))
        }, CHILD_WATCHDOG_MS)
        cp.stdout.on('data', (d) => {
            out += d
        })
        cp.stderr.on('data', (d) => {
            err += d
        })
        cp.on('error', (e) => {
            realClearTimeout(wd)
            reject(e)
        })
        cp.on('close', (code) => {
            realClearTimeout(wd)
            let m = /^RESULT (.*)$/m.exec(out)
            if (!m) {
                reject(new Error(`子行程無RESULT行(離開碼${code}): ${out.slice(-500)} ${err.slice(-500)}`))
                return
            }
            resolve({ code, result: JSON.parse(m[1]), out })
        })
    })
}

function cleanEnv(extra) {
    let env = { ...process.env }
    for (let k of Object.keys(env)) {
        //不繼承離線旗標、Playwright相關變數與代理(代理存在時對本機位址之請求可能改走代理)
        if (/^(W_BIN_OFFLINE|PLAYWRIGHT_|https?_proxy$|all_proxy$|no_proxy$)/i.test(k)) {
            delete env[k]
        }
    }
    return { ...env, ...extra }
}


describe('R08: 受管瀏覽器之集中取得(時限對齊安裝預算, 失敗不靜默略過)', function () {
    this.timeout(180000)

    after(function () {
        fs.rmSync(fdWork, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
        try {
            fs.rmdirSync(tmpRoot) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {
            //ignore
        }
    })

    it('PI-1 預算為900000ms(15分鐘), 大於全域案時限180000ms; 呼叫ensure時帶kind、timeout=預算、onTrace與funLog', async function () {
        //spec: ①以PW_INSTALL_BUDGET_MS(900000)為ensureChromium之timeout
        assert.strictEqual(PW_INSTALL_BUDGET_MS, 900000)
        assert.ok(PW_INSTALL_BUDGET_MS > 180000, '預算須大於全域案時限(舊寫法於it內取得受其約束)')
        let calls = []
        let ensure = async (o) => {
            calls.push(o)
            return { kind: o.kind }
        }
        let t = createPwBrowserTool({ ensure, offline: false, log: () => {} })
        await t.ensurePwBrowser()
        assert.strictEqual(calls.length, 1)
        assert.strictEqual(calls[0].kind, 'headless-shell')
        assert.strictEqual(calls[0].timeout, PW_INSTALL_BUDGET_MS)
        assert.strictEqual(typeof calls[0].onTrace, 'function')
        assert.strictEqual(typeof calls[0].funLog, 'function')
        assert.deepStrictEqual(Object.keys(calls[0]).sort(), ['funLog', 'kind', 'onTrace', 'timeout'], '不多傳其他選項(如installDeps)')
    })

    it('PI-1b 預設接線(未注入ensure): 經wpw.ensureChromium取得, 引數原樣轉交(kind、timeout=預算、onTrace、funLog)', async function () {
        //spec: ①預算須實際傳進w-playwright之ensureChromium; 本案以替身取代wpw.ensureChromium(不安裝、不下載), 驗預設接線不丟選項
        let calls = []
        let orig = wpw.ensureChromium
        wpw.ensureChromium = async (o) => {
            calls.push(o)
            return { kind: o.kind }
        }
        try {
            let t = createPwBrowserTool({ offline: false, log: () => {} })
            await t.ensurePwBrowser()
        }
        finally {
            wpw.ensureChromium = orig
        }
        assert.strictEqual(wpw.ensureChromium, orig, '須還原wpw.ensureChromium')
        assert.strictEqual(calls.length, 1)
        assert.strictEqual(calls[0].kind, 'headless-shell')
        assert.strictEqual(calls[0].timeout, PW_INSTALL_BUDGET_MS)
        assert.strictEqual(typeof calls[0].onTrace, 'function')
        assert.strictEqual(typeof calls[0].funLog, 'function')
    })

    it('PI-2 同行程只取得一次(循序與並行之呼叫共用同一結果)', async function () {
        //spec: 集中取得(一次); 日後新增之取得點不得重複下載
        let n = 0
        let ensure = async () => {
            n++
            return { kind: 'headless-shell' }
        }
        let t = createPwBrowserTool({ ensure, offline: false, log: () => {} })
        let [a, b] = await Promise.all([t.ensurePwBrowser(), t.ensurePwBrowser()])
        let c = await t.ensurePwBrowser()
        assert.strictEqual(n, 1)
        assert.strictEqual(a, b)
        assert.strictEqual(a, c)
    })

    it('PI-3 取得失敗即拋錯(非離線不略過): 訊息附原錯誤與安裝輸出末段(去色碼、有長度上限), 帶cause與code, 同行程之後續呼叫立即得同一錯誤而不重試', async function () {
        //spec: ②預設取得失敗即失敗(不靜默略過)
        let n = 0
        let ensure = async (o) => {
            n++
            o.funLog('install-output', { kind: o.kind }, '\u001b[32mDownloading Chrome Headless Shell 159.0.8154.6 from https://example.invalid/a.zip\u001b[0m\n')
            o.funLog('install-output', { kind: o.kind }, 'Error: getaddrinfo ENOTFOUND example.invalid\n' + 'x'.repeat(5000) + '\u001b[31mTAIL-MARK\u001b[0m from http://user:secret@mirror.invalid:8080/a.zip retry') //色碼與網址(含帳密)在末段內(去色碼與遮罩須實際生效)
            let err = new Error('browser installation failed with exit code 1')
            err.code = 'E_INSTALL'
            throw err
        }
        let t = createPwBrowserTool({ ensure, offline: false, log: () => {} })
        await assert.rejects(t.ensurePwBrowserOrSkip(), (err) => {
            assert.strictEqual(err.code, 'E_INSTALL')
            assert.ok(err.cause && err.cause.message === 'browser installation failed with exit code 1', '須帶cause')
            assert.ok(err.message.includes('E_INSTALL') && err.message.includes('exit code 1'), err.message)
            assert.ok(err.message.includes('TAIL-MARK'), '須含輸出末段')
            assert.ok(!err.message.includes(String.fromCharCode(27)), '須去色碼')
            //診斷輸出與遮罩規格D3: 網址整串(含帳密、內網鏡像位址)不得出現於對外錯誤訊息; 其餘文字(如retry)保留
            assert.ok(!err.message.includes('secret') && !err.message.includes('mirror.invalid') && err.message.includes('<url> retry'), err.message.slice(-200))
            assert.ok(err.message.length < 2600, `輸出末段須有上限: ${err.message.length}`)
            return true
        })
        await assert.rejects(t.ensurePwBrowserOrSkip())
        assert.strictEqual(n, 1, '失敗亦記憶, 不重試')
    })

    it('PI-3b 安裝子行程啟動失敗(install-error)之錯誤內容亦附於訊息', async function () {
        //spec: ②取得失敗之診斷; w-playwright於子行程啟動失敗時以funLog(install-error, {kind, exitCode}, err)交出原錯誤
        let ensure = async (o) => {
            o.funLog('install-error', { kind: o.kind, exitCode: -1 }, new Error('spawn EACCES-MARK'))
            let err = new Error('browser installation failed to start')
            err.code = 'E_INSTALL'
            throw err
        }
        let t = createPwBrowserTool({ ensure, offline: false, log: () => {} })
        await assert.rejects(t.ensurePwBrowserOrSkip(), (err) => {
            assert.ok(err.message.includes('EACCES-MARK') && err.message.includes('failed to start'), err.message)
            return true
        })
    })

    it('PI-4 離線政策: 僅離線環境才略過(回原因並輸出); 離線而取得成功不略過', async function () {
        //spec: ②只有明確之離線環境才允許略過, 且略過時輸出原因
        let logs = []
        let fail = async () => {
            throw new Error('boom')
        }
        let off = createPwBrowserTool({ ensure: fail, offline: true, log: (s) => logs.push(s) })
        let reason = await off.ensurePwBrowserOrSkip()
        assert.strictEqual(typeof reason, 'string')
        assert.ok(reason.includes('W_BIN_OFFLINE') && reason.includes('boom'), reason)
        assert.ok(logs.some((s) => s.includes('略過') && s.includes('boom')), '略過時須輸出原因')

        let on = createPwBrowserTool({ ensure: fail, offline: false, log: () => {} })
        await assert.rejects(on.ensurePwBrowserOrSkip(), /boom/)

        let okLogs = []
        let offOk = createPwBrowserTool({ ensure: async () => ({ kind: 'headless-shell' }), offline: true, log: (s) => okLogs.push(s) })
        assert.strictEqual(await offOk.ensurePwBrowserOrSkip(), null)
        assert.ok(!okLogs.some((s) => s.includes('略過')))
    })

    it('PI-5 離線旗標之判定(1或true不分大小寫, 空白忽略; 其餘為非離線); 預設工具以載入時之旗標為準而不受測試中途改動之環境變數影響', async function () {
        //spec: 沿用本套件既有離線旗標W_BIN_OFFLINE(wsemi fsEnsureBins: 1或true不分大小寫); setBinEnv於測試內設W_BIN_OFFLINE=1, 不得使取得失敗被靜默略過
        for (let v of ['1', 'true', 'TRUE', ' True ']) {
            assert.strictEqual(isOffline({ W_BIN_OFFLINE: v }), true, v)
        }
        for (let v of ['', '0', 'false', 'yes', 'on', undefined, null, 1]) {
            assert.strictEqual(isOffline({ W_BIN_OFFLINE: v }), false, String(v))
        }
        assert.strictEqual(isOffline({}), false)
        assert.strictEqual(isOffline(null), false)

        let old = process.env.W_BIN_OFFLINE
        try {
            for (let v of ['1', '0']) {
                process.env.W_BIN_OFFLINE = v
                let ensure = async () => {
                    throw new Error('boom')
                }
                let t = createPwBrowserTool({ ensure, log: () => {} }) //不給offline: 用載入時之旗標
                let r = null
                let thrown = null
                try {
                    r = await t.ensurePwBrowserOrSkip()
                }
                catch (err) {
                    thrown = err
                }
                assert.strictEqual(typeof r === 'string', OFFLINE_AT_LOAD, `執行期設W_BIN_OFFLINE=${v}不得改變判定(載入時離線=${OFFLINE_AT_LOAD})`)
                assert.strictEqual(thrown === null, OFFLINE_AT_LOAD)
            }
        }
        finally {
            if (old === undefined) {
                delete process.env.W_BIN_OFFLINE
            }
            else {
                process.env.W_BIN_OFFLINE = old
            }
        }
    })

    it('PI-6 完成時輸出一行紀錄(安裝程序次數、下載動作次數、用時), 次數取自onTrace與Playwright輸出', async function () {
        //spec: 驗收須能由紀錄判讀「安裝恰1次」與「是否真下載」(npm_config_loglevel為silent/error/warn時Playwright不印Downloading, 下載次數為0, 以瀏覽器目錄產物為準)
        let logs = []
        let tick = 1000
        let ensure = async (o) => {
            o.onTrace({ type: 'install-start', kind: o.kind })
            o.funLog('install-output', { kind: o.kind }, 'Downloading Chrome Headless Shell 159.0.8154.6 (playwright chromium-headless-shell v1255) from https://x.invalid/1\n')
            o.funLog('install-output', { kind: o.kind }, '|■■■■| 100% of 123.8 MiB\nDownloading FFmpeg v1013 from https://x.invalid/2\n')
            o.funLog('install-output', { kind: o.kind }, '\u001b[1mDownloading Winldd v1007 from https://x.invalid/3\u001b[0m\n')
            o.onTrace({ type: 'install-done', kind: o.kind })
            return { kind: o.kind }
        }
        let t = createPwBrowserTool({ ensure, offline: false, log: (s) => logs.push(s), now: () => (tick += 250) })
        let r = await t.ensurePwBrowser()
        assert.strictEqual(r.starts, 1)
        assert.strictEqual(r.downloads, 3)
        assert.strictEqual(logs.length, 1)
        assert.ok(/安裝程序1次, 下載動作3次/.test(logs[0]) && /用時\d+ms/.test(logs[0]), logs[0])

        //已備妥者(Playwright不重複下載)仍為安裝程序1次、下載動作0次
        let logs2 = []
        let ensure2 = async (o) => {
            o.onTrace({ type: 'install-start' })
            o.onTrace({ type: 'install-done' })
            return {}
        }
        let t2 = createPwBrowserTool({ ensure: ensure2, offline: false, log: (s) => logs2.push(s) })
        await t2.ensurePwBrowser()
        assert.ok(/安裝程序1次, 下載動作0次/.test(logs2[0]), logs2[0])

        //安裝程序次數計install-start(2次start、1次done為2次; 計done者為1)
        let logs3 = []
        let ensure3 = async (o) => {
            o.onTrace({ type: 'install-start' })
            o.onTrace({ type: 'install-start' })
            o.onTrace({ type: 'install-done' })
            return {}
        }
        let t3 = createPwBrowserTool({ ensure: ensure3, offline: false, log: (s) => logs3.push(s) })
        await t3.ensurePwBrowser()
        assert.ok(/安裝程序2次, 下載動作0次/.test(logs3[0]), logs3[0])
    })

    it('PI-7 接線(結構): 取得只在unit-pwWiring之子describe之before(this.timeout(預算+60000)在await之前), it內不取得; 無捕捉錯誤後略過之寫法; 全庫只有tools/pwInstall.mjs直接呼叫ensureChromium', function () {
        //spec: ①取得移到before且時限對齊安裝預算; ②取得失敗不得靜默略過(舊寫法: try { await wpw.ensureChromium() } catch { this.skip() } 於it內)
        let fp = path.join(testDir, 'unit-pwWiring.test.mjs')
        let src = stripComments(fs.readFileSync(fp, 'utf8'))

        //版面: R07-5在子describe之外(取得失敗不連累它), 取得用before在子describe內且先於R07-6之it
        let iSub = src.indexOf('describe(\'R07-6')
        let iIt5 = src.indexOf('it(\'R07-5')
        let iIt6 = src.indexOf('it(\'R07-6')
        assert.ok(iSub > 0 && iIt5 > 0 && iIt6 > 0, '缺R07-6子describe或R07-5/R07-6之it')
        assert.ok(iIt5 < iSub, 'R07-5須在R07-6子describe之外')

        //hook本體: 以大括號配對取before(...)之函數本體
        let i = src.indexOf('before(')
        assert.ok(i >= 0, '缺before')
        assert.strictEqual(src.indexOf('before(', i + 1), -1, '應只有一個取得用before')
        assert.ok(iSub < i && i < iIt6, 'before須在R07-6子describe內且先於R07-6之it')
        let open = src.indexOf('{', i)
        let depth = 0
        let end = -1
        for (let k = open; k < src.length; k++) {
            if (src[k] === '{') {
                depth++
            }
            else if (src[k] === '}') {
                depth--
                if (depth === 0) {
                    end = k
                    break
                }
            }
        }
        assert.ok(end > open)
        let body = src.slice(open, end + 1)
        let iT = body.indexOf('this.timeout(PW_INSTALL_BUDGET_MS + 60000)')
        let iA = body.indexOf('await ensurePwBrowserOrSkip()')
        assert.ok(iT >= 0, 'before須設this.timeout(PW_INSTALL_BUDGET_MS + 60000)')
        assert.ok(iA >= 0, 'before須await ensurePwBrowserOrSkip()')
        assert.ok(iT < iA, 'this.timeout須在await之前(之後設之, 計時器已以預設時限起算)')
        assert.ok(/let reason = await ensurePwBrowserOrSkip\(\)\s*\n/.test(body), '取得結果須直接賦給reason(不得接.catch等吞錯之鏈)')
        assert.ok(!/\bcatch\b/.test(src), 'unit-pwWiring不得有catch(取得失敗不得被吞)')

        //取得識別字只出現於(import與)該before一處: it內不得取得
        let ids = src.match(/\bensurePwBrowser(OrSkip)?\b/g) || []
        assert.strictEqual(ids.length, 2, 'import一處+before一處; 實際' + ids.length)

        //略過僅有一處且受reason判斷(離線)限制; 無catch後略過
        assert.strictEqual((src.match(/this\.skip\(\)/g) || []).length, 1)
        assert.ok(/if\s*\(\s*reason\s*\)\s*\{\s*this\.skip\(\)\s*\}/.test(src), '略過須以離線之reason為條件')
        assert.ok(!/describe\.(skip|only)|\bit\.(skip|only)/.test(src), '不得describe/it.skip或only')
        assert.ok(!/\bwpw\s*\.\s*ensureChromium\b/.test(src), 'unit-pwWiring不得直接呼叫wpw.ensureChromium')

        //test/下(.mjs, 不含自身與test/_tmp)程式碼(去註解)出現ensureChromium識別字者只有tools/pwInstall.mjs(含別名、解構匯入、方括號取用)
        let re = new RegExp('\\bensure' + 'Chromium\\b')
        let hits = []
        for (let f of listMjs(testDir)) {
            if (path.basename(f) === 'unit-pwInstall.test.mjs') {
                continue
            }
            if (re.test(stripComments(fs.readFileSync(f, 'utf8')))) {
                hits.push(path.relative(testDir, f).replace(/\\/g, '/'))
            }
        }
        assert.deepStrictEqual(hits, ['tools/pwInstall.mjs'])
        assert.ok(re.test('import { ensureChromium } from \'x\'') && re.test('wpw[\'ensureChromium\']()'), '防空集合: 正則須能命中別名與方括號取用之正例')
    })

    it('PI-7b test/下之測試與工具不得以autoInstall啟動(任何形式之autoInstall一律不出現; 啟動時缺檔須立即E_BROWSER_MISSING, 不得於案內靜默安裝而回到受案時限約束之舊問題)', function () {
        //spec: ①取得集中於before; 啟動端不再安裝(w-playwright之autoInstall預設false, 其自動安裝路徑不受預算控制)
        let re = new RegExp('\\bauto' + 'Install\\b')
        let hits = []
        for (let f of listMjs(testDir)) {
            if (path.basename(f) === 'unit-pwInstall.test.mjs') {
                continue
            }
            if (re.test(stripComments(fs.readFileSync(f, 'utf8')))) {
                hits.push(path.relative(testDir, f).replace(/\\/g, '/'))
            }
        }
        assert.deepStrictEqual(hits, [])
        for (let s of ['launch({ autoInstall: true })', 'o.autoInstall = true', '{ \'autoInstall\': !0 }']) {
            assert.ok(re.test(s), '防空集合: 正則須能命中正例 ' + s)
        }
    })

    it('PI-8 真路徑(不用替身): 空瀏覽器夾+不通之下載主機+非離線 → 取得失敗即拋錯而非略過, 瀏覽器夾無任何完成之安裝產物', async function () {
        //spec: ②取得失敗(下載主機不通+空夾)⇒失敗而非略過; 子行程以真w-playwright, 不連外網(下載主機為本機已關閉之埠), 不動使用者層級之瀏覽器快取
        let dir = path.join(fdWork, 'pw-empty-fail')
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(dir, { recursive: true })
        let host = `http://127.0.0.1:${await freePort()}`
        let env = cleanEnv({ PLAYWRIGHT_BROWSERS_PATH: dir, PLAYWRIGHT_DOWNLOAD_HOST: host, PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: host })
        let { result } = await runChild(env)
        assert.strictEqual(result.skip, null, '非離線時不得略過')
        assert.ok(result.error, '取得失敗須拋錯')
        assert.ok(result.error.message.includes('[pw-browser]') && /E_INSTALL/.test(result.error.message), result.error.message)
        assert.ok(result.error.message.includes(`預算${PW_INSTALL_BUDGET_MS}ms`), result.error.message)
        //安裝輸出末段(真w-playwright經funLog交出之子行程輸出)須在訊息內: 證明真接線之funLog有效
        assert.ok(/ECONNREFUSED/.test(result.error.message), '訊息須附安裝輸出末段(含連線被拒): ' + result.error.message.slice(0, 600))
        assert.strictEqual(result.error.hasCause, true)
        let done = fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, 'INSTALLATION_COMPLETE')))
        assert.deepStrictEqual(done, [], '失敗不得留下完成之安裝產物')
    })

    it('PI-8b 真路徑(不用替身): W_BIN_OFFLINE為0或false(非離線值)時取得失敗仍拋錯, 不略過', async function () {
        //spec: ②只有明確之離線環境才允許略過(0、false不是離線宣告)
        for (let v of ['0', 'false']) {
            let dir = path.join(fdWork, `pw-empty-off${v}`)
            fs.rmSync(dir, { recursive: true, force: true })
            fs.mkdirSync(dir, { recursive: true })
            let host = `http://127.0.0.1:${await freePort()}`
            let env = cleanEnv({ PLAYWRIGHT_BROWSERS_PATH: dir, PLAYWRIGHT_DOWNLOAD_HOST: host, PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: host, W_BIN_OFFLINE: v })
            let { result } = await runChild(env)
            assert.strictEqual(result.skip, null, `W_BIN_OFFLINE=${v}不得略過`)
            assert.ok(result.error && /E_INSTALL/.test(result.error.message), `W_BIN_OFFLINE=${v}須拋錯`)
        }
    })

    it('PI-9 真路徑(不用替身): 同PI-8但宣告離線(W_BIN_OFFLINE=1) → 回略過原因而非拋錯', async function () {
        //spec: ②只有明確離線環境才允許略過; 略過時輸出原因(子行程之stdout須含之)
        let dir = path.join(fdWork, 'pw-empty-offline')
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(dir, { recursive: true })
        let host = `http://127.0.0.1:${await freePort()}`
        let env = cleanEnv({ PLAYWRIGHT_BROWSERS_PATH: dir, PLAYWRIGHT_DOWNLOAD_HOST: host, PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST: host, W_BIN_OFFLINE: '1' })
        let { result, out } = await runChild(env)
        assert.strictEqual(result.error, null)
        assert.strictEqual(typeof result.skip, 'string')
        assert.ok(result.skip.includes('W_BIN_OFFLINE') && result.skip.includes('E_INSTALL'), result.skip)
        assert.ok(out.includes('略過需受管瀏覽器之測試'), '略過時須輸出原因')
    })

})
