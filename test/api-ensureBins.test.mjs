import fs from 'fs'
import os from 'os'
import http from 'http'
import path from 'path'
import assert from 'assert'
import cp from 'child_process'
import { syncBuiltinESMExports } from 'module'
import fsEnsureBins from 'wsemi/src/fsEnsureBins.mjs'
import ensureBins from '../src/ensureBins.mjs'
import mk from '../src/mousekey.mjs'
import sc from '../src/screen.mjs'
import recScp from '../src/recScp.mjs'
import WMousekey from '../src/WMousekey.mjs'
import { repoDir, toolsDir, tmpRoot, readManifest, sha256Of, buildMirror, setBinEnv, AHK_EXE, AHK_SCRIPTS, SCREEN_EXE } from './tools/binEnv.mjs'


let manifest = readManifest()
let entOf = (name) => manifest.files.find((v) => v.name === name)
let bytesOf = (name) => fs.readFileSync(path.join(repoDir, entOf(name).path))
let listFiles = (fd) => {
    if (!fs.existsSync(fd)) {
        return []
    }
    return fs.readdirSync(fd, { recursive: true, withFileTypes: true }).filter((v) => v.isFile()).map((v) => path.join(v.parentPath, v.name))
}
let rmTmp = () => {
    try {
        fs.rmdirSync(tmpRoot) //尚有其他測試之暫存時非空, 略過
    }
    catch (err) {
        //ignore
    }
}
let keys = ['W_BIN_MIRROR', 'W_BIN_CACHE', 'W_BIN_OFFLINE']


//規格: 外部執行檔之存放下載校驗與離線(制式規格) D1、D3、D4、O1、O2、O3、E2、E3、§8 T3~T7(T8為主幹模式, 本套件為釘選模式, 不適用)
//以本機HTTP伺服器扮raw.githubusercontent.com(自有檔網址為<repo>/<commit>/<path>), 以本地資料夾扮鏡像, 全程不連外網; 供檔之內容為repo內bin/之實檔
describe(`ensureBins (T3~T7)`, function() {
    this.timeout(180000)

    let port = 8944
    let fdt = path.join(tmpRoot, 'ensureBins')
    let bkEnv = {}

    let ent = entOf('zclick.ahk') //小檔(腳本)
    let exe = entOf(AHK_EXE) //大檔(1.2MB之exe)
    let urlPathOf = (e) => `/${manifest.repo}/${manifest.commit}/${e.path}`

    let bodies = {} //伺服器目前回傳之內容: 網址路徑 -> Buffer
    let urls = [] //伺服器收到之請求路徑
    let server = null
    let seq = 0
    let cacheDir = ''

    //fetchLocal, 僅放行raw.githubusercontent.com之網址並改指本機伺服器, 其餘一律拒絕(確保測試不連外網)
    let fetchLocal = (url, init) => {
        let u = String(url)
        if (!u.startsWith('https://raw.githubusercontent.com/')) {
            return Promise.reject(new Error(`unexpected url[${u}]`))
        }
        return globalThis.fetch(u.replace('https://raw.githubusercontent.com', `http://127.0.0.1:${port}`), init)
    }

    //noNet, 被呼叫即代表連網
    let nNet = 0
    let noNet = () => {
        nNet++
        return Promise.reject(new Error('network must not be used'))
    }

    let putMirror = (fdMirror, e, buf) => {
        let fd = path.join(fdMirror, manifest.pkg, e.sha256)
        fs.mkdirSync(fd, { recursive: true })
        fs.writeFileSync(path.join(fd, e.name), buf)
        return path.join(fd, e.name)
    }

    //bad, 與實檔同大小而內容不同
    let badOf = (e) => {
        let b = Buffer.from(bytesOf(e.name))
        b[10] = b[10] ^ 0xff
        return b
    }

    before(async function() {
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.mkdirSync(fdt, { recursive: true })
        server = http.createServer((req, res) => {
            urls.push(req.url)
            if (req.url in bodies) {
                res.writeHead(200, { 'content-length': String(bodies[req.url].length) })
                res.end(bodies[req.url])
            }
            else {
                res.writeHead(404)
                res.end()
            }
        })
        await new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, '127.0.0.1', resolve)
        })
    })

    after(async function() {
        await new Promise((resolve) => {
            server.close(resolve)
        })
        fs.rmSync(fdt, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
        rmTmp()
    })

    beforeEach(function() {
        for (let k of keys) {
            bkEnv[k] = process.env[k]
            delete process.env[k]
        }
        bodies = {}
        for (let f of manifest.files) {
            bodies[urlPathOf(f)] = bytesOf(f.name)
        }
        urls.length = 0
        nNet = 0
        seq++
        cacheDir = path.join(fdt, `cache${seq}`)
    })

    afterEach(function() {
        for (let k of keys) {
            if (bkEnv[k] === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = bkEnv[k]
            }
        }
    })

    it(`T3: first call downloads every file from the pinned-commit url of GitHub, verifies and caches; second call hits the verified cache without network (D3, D4, O2)`, async function() {
        //規格D3: 快取位置<快取>/<sha256>/<name>; O2: 快取未命中時自GitHub(釘選提交)取得
        let r1 = await ensureBins({ fetch: fetchLocal, cacheDir, mirror: '', offline: false })
        assert.strict.deepStrictEqual(Object.keys(r1).sort(), manifest.files.map((v) => v.name).sort())
        let fps = []
        for (let f of manifest.files) {
            let fp = path.join(cacheDir, f.sha256, f.name)
            fps.push(fp)
            assert.strict.equal(r1[f.name], fp)
            assert.strict.equal(sha256Of(fp), f.sha256, f.name)
            assert.strict.equal(fs.statSync(fp).size, f.size, f.name)
        }
        //M2: 每個網址之ref皆為清單之40碼提交
        assert.strict.deepStrictEqual([...urls].sort(), manifest.files.map(urlPathOf).sort())
        assert.strict.deepStrictEqual(listFiles(cacheDir).sort(), fps.sort()) //只存最終檔, 無暫存殘留

        //規格D4: 第二次不連網(快取命中並校驗)
        let r2 = await ensureBins({ fetch: noNet, cacheDir, mirror: '', offline: false })
        assert.strict.deepStrictEqual(r2, r1)
        assert.strict.equal(nNet, 0)
        assert.strict.equal(urls.length, manifest.files.length)
    })

    it(`T3: names fetches only the files asked for (E2: callers take only what the function needs)`, async function() {
        let r = await ensureBins({ names: [AHK_EXE, 'zsend.ahk'], fetch: fetchLocal, cacheDir, mirror: '', offline: false })
        assert.strict.deepStrictEqual(Object.keys(r).sort(), [AHK_EXE, 'zsend.ahk'].sort())
        assert.strict.deepStrictEqual([...urls].sort(), [urlPathOf(exe), urlPathOf(entOf('zsend.ahk'))].sort())
    })

    it(`T3: concurrent calls share one download (E2)`, async function() {
        let rs = await Promise.all([1, 2, 3].map(() => ensureBins({ names: 'zclick.ahk', fetch: fetchLocal, cacheDir, mirror: '', offline: false })))
        assert.strict.deepStrictEqual(rs.map((r) => r['zclick.ahk']), [1, 2, 3].map(() => path.join(cacheDir, ent.sha256, 'zclick.ahk')))
        assert.strict.equal(urls.length, 1)
    })

    it(`T4: content or size not matching the manifest is refused and leaves no file (D2, E3)`, async function() {
        for (let e of [ent, exe]) {
            let bytes = bytesOf(e.name)
            for (let [label, b, code] of [
                ['same size, different content', badOf(e), 'E_HASH_MISMATCH'],
                ['truncated', bytes.subarray(0, bytes.length - 10), 'E_SIZE_MISMATCH'],
                ['longer', Buffer.concat([bytes, Buffer.from('x')]), 'E_SIZE_MISMATCH'],
            ]) {
                bodies[urlPathOf(e)] = b
                let err = await ensureBins({ names: e.name, fetch: fetchLocal, cacheDir, mirror: '', offline: false, maxAttempts: 1, retryDelayMs: 0 })
                    .then(() => null)
                    .catch((x) => x)
                assert.strict.equal(err instanceof Error, true, `${e.name} ${label}`)
                assert.strict.equal(err.code, code, `${e.name} ${label}: ${err && err.message}`)
                assert.strict.deepStrictEqual(listFiles(cacheDir), [], `${e.name} ${label}`)
            }
        }
    })

    it(`T4: a file the pinned commit does not have (HTTP 404) is refused and leaves no file (E3)`, async function() {
        delete bodies[urlPathOf(ent)]
        let err = await ensureBins({ names: ent.name, fetch: fetchLocal, cacheDir, mirror: '', offline: false, maxAttempts: 1, retryDelayMs: 0 })
            .then(() => null)
            .catch((x) => x)
        assert.strict.equal(err instanceof Error, true)
        assert.strict.equal(err.code, 'E_HTTP', err.message)
        assert.strict.deepStrictEqual(listFiles(cacheDir), [])
    })

    it(`T5: W_BIN_MIRROR (local folder) is used before GitHub, and the mirror copy is verified (O1, O2)`, async function() {
        let fdMirror = path.join(fdt, `mirror${seq}`)
        buildMirror(fdMirror)
        process.env.W_BIN_MIRROR = fdMirror

        //鏡像命中: 不連網
        let r = await ensureBins({ fetch: noNet, cacheDir, offline: false })
        for (let f of manifest.files) {
            assert.strict.equal(r[f.name], path.join(cacheDir, f.sha256, f.name))
            assert.strict.equal(sha256Of(r[f.name]), f.sha256, f.name)
        }
        assert.strict.equal(nNet, 0)
        assert.strict.deepStrictEqual(urls, [])
    })

    it(`T5: a tampered mirror copy is refused; online it falls back to GitHub, offline it is E_OFFLINE_MISSING (O2, O3)`, async function() {
        let fdMirror = path.join(fdt, `mirror${seq}`)
        putMirror(fdMirror, ent, badOf(ent))
        process.env.W_BIN_MIRROR = fdMirror

        //連網時: 拒用鏡像, 改自GitHub取得正確之檔
        let r = await ensureBins({ names: ent.name, fetch: fetchLocal, cacheDir, offline: false })
        assert.strict.equal(sha256Of(r[ent.name]), ent.sha256)
        assert.strict.deepStrictEqual(urls, [urlPathOf(ent)])

        //離線時: 鏡像是唯一來源, 其不符即視為缺檔, 不留檔
        let cacheDir2 = path.join(fdt, `cache${seq}b`)
        let err = await ensureBins({ names: ent.name, fetch: noNet, cacheDir: cacheDir2, offline: true })
            .then(() => null)
            .catch((x) => x)
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.equal(nNet, 0)
        assert.strict.deepStrictEqual(listFiles(cacheDir2), [])
    })

    it(`T6: W_BIN_OFFLINE=1 without cache or mirror is E_OFFLINE_MISSING naming the file, sha256, size and the path to place it (O3, D3)`, async function() {
        process.env.W_BIN_OFFLINE = '1'
        process.env.W_BIN_CACHE = path.join(fdt, `shared${seq}`)
        let err = await ensureBins({ names: ent.name, fetch: noNet })
            .then(() => null)
            .catch((x) => x)
        assert.strict.equal(err instanceof Error, true)
        assert.strict.equal(err.code, 'E_OFFLINE_MISSING', err.message)
        assert.strict.equal(nNet, 0)
        assert.strict.equal(urls.length, 0)

        //D3: 共用快取之結構為<W_BIN_CACHE>/<套件>/<sha256>/<name>
        let m = err.missing[0]
        assert.strict.equal(m.name, ent.name)
        assert.strict.equal(m.sha256, ent.sha256)
        assert.strict.equal(m.size, ent.size)
        assert.strict.equal(m.cachePath, path.join(process.env.W_BIN_CACHE, manifest.pkg, ent.sha256, ent.name))
        for (let s of [ent.name, ent.sha256, String(ent.size), m.cachePath]) {
            assert.strict.equal(err.message.includes(s), true, `message should include [${s}]`)
        }
    })

    it(`T6: with an offline mirror configured, the error also names the mirror path (O3, O1)`, async function() {
        let fdMirror = path.join(fdt, `mirror${seq}`) //不存在之鏡像
        let err = await ensureBins({ names: ent.name, fetch: noNet, cacheDir, mirror: fdMirror, offline: true })
            .then(() => null)
            .catch((x) => x)
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        let fpMirror = path.join(fdMirror, manifest.pkg, ent.sha256, ent.name)
        assert.strict.equal(err.missing[0].mirrorPath, fpMirror)
        assert.strict.equal(err.message.includes(fpMirror), true)
    })

    it(`T7: a tampered cache file is refused and fetched again (D4)`, async function() {
        let r = await ensureBins({ names: ent.name, fetch: fetchLocal, cacheDir, mirror: '', offline: false })
        let fp = r[ent.name]
        assert.strict.equal(urls.length, 1)

        //同大小而內容不同
        fs.writeFileSync(fp, badOf(ent))
        fs.utimesSync(fp, 1, 1)
        let r2 = await ensureBins({ names: ent.name, fetch: fetchLocal, cacheDir, mirror: '', offline: false })
        assert.strict.equal(r2[ent.name], fp)
        assert.strict.equal(sha256Of(fp), ent.sha256)
        assert.strict.equal(urls.length, 2)

        //被截斷(大小不同)
        fs.writeFileSync(fp, bytesOf(ent.name).subarray(0, 100))
        fs.utimesSync(fp, 1, 1)
        let r3 = await ensureBins({ names: ent.name, fetch: fetchLocal, cacheDir, mirror: '', offline: false })
        assert.strict.equal(sha256Of(r3[ent.name]), ent.sha256)
        assert.strict.equal(urls.length, 3)
    })

    it(`T7: offline, a tampered cache file is never returned (D4, O3)`, async function() {
        let r = await ensureBins({ names: ent.name, fetch: fetchLocal, cacheDir, mirror: '', offline: false })
        fs.writeFileSync(r[ent.name], badOf(ent))
        fs.utimesSync(r[ent.name], 1, 1)
        let err = await ensureBins({ names: ent.name, fetch: noNet, cacheDir, mirror: '', offline: true })
            .then(() => null)
            .catch((x) => x)
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.equal(nNet, 0)
    })

})


//規格: E2(套件端只做提供清單、呼叫fsEnsureBins、匯出ensureBins; 主檔為default匯出, 以屬性匯出)、D1(不得於安裝時下載)、§9第122行(主函數類入口之接線)
//經公開入口(mousekey、screen、recScp)走完取得流程: 攔截全域fetch斷言未被呼叫, 攔截child_process.execFile與spawn斷言所啟動者為清單校驗後之快取路徑
//(舊路徑檔與快取檔位元相同時, 只驗功能輸出之測試對「先取得卻仍用舊路徑」盲)
describe(`ensureBins wiring in w-mousekey`, function() {
    this.timeout(180000)

    let restoreEnv = null
    let fdCache = ''
    let fetchCalls = []
    let origFetch = null
    let origExecFile = null
    let origSpawn = null
    let calls = [] //被攔截之啟動: { fn, prog, args }
    let stubChildren = []
    let stubPath = path.join(toolsDir, 'stubExe.mjs')
    let stubIdlePath = path.join(toolsDir, 'stubIdle.mjs')

    //expected, 清單校驗後應在之路徑(由W_BIN_CACHE之結構獨立算出, 不經ensureBins)
    let expected = (name) => path.join(fdCache, manifest.pkg, entOf(name).sha256, name)

    before(function() {
        restoreEnv = setBinEnv('ensureBins-wiring')
        fdCache = process.env.W_BIN_CACHE
    })

    after(function() {
        restoreEnv()
    })

    beforeEach(function() {
        fetchCalls = []
        calls = []
        stubChildren = []
        origFetch = globalThis.fetch
        globalThis.fetch = (...a) => {
            fetchCalls.push(String(a[0]))
            return Promise.reject(new Error('global fetch must not be used'))
        }
        origExecFile = cp.execFile
        origSpawn = cp.spawn
        //替身: 記錄呼叫後改以node執行stubExe.mjs(不動桌面)
        cp.execFile = (prog, args, opts, cb) => {
            calls.push({ fn: 'execFile', prog, args })
            return origExecFile(process.execPath, [stubPath, ...args], opts, cb)
        }
        cp.spawn = (prog, args, opts) => {
            calls.push({ fn: 'spawn', prog, args })
            let child = origSpawn(process.execPath, [stubIdlePath], { windowsHide: true, stdio: 'pipe' })
            stubChildren.push(child)
            return child
        }
        syncBuiltinESMExports() //recScp與fsEnsureBins以具名匯入取spawn
    })

    afterEach(function() {
        cp.execFile = origExecFile
        cp.spawn = origSpawn
        syncBuiltinESMExports()
        globalThis.fetch = origFetch
        for (let c of stubChildren) {
            c.kill()
        }
    })

    it(`mousekey actions start AutoHotkey64.exe and the action's script by the verified cache paths (absolute), never the repo's bin/ files, without global fetch (E2)`, async function() {
        let table = [
            ['mouseClick', () => mk.mouseClick(1, 2), 'zclick.ahk', ['1', '2', 'left', '1']],
            ['mouseDblClick', () => mk.mouseDblClick(3, 4), 'zclick.ahk', ['3', '4', 'left', '2']],
            ['mouseDrag', () => mk.mouseDrag(1, 2, 3, 4), 'zdrag.ahk', ['1', '2', '3', '4', 'left']],
            ['mouseScroll', () => mk.mouseScroll(5, 6, 'down', 2), 'zwheel.ahk', ['5', '6', 'down', '2']],
            ['sendChar', () => mk.sendChar('Z'), 'zsend.ahk', ['Z']],
            ['sendString', () => mk.sendString('hi'), 'zsend.ahk', ['hi']],
            ['sendCombo', () => mk.sendCombo('ctrl+v'), 'zsendcombo.ahk', ['^v']],
        ]
        for (let [label, run, script, tail] of table) {
            calls.length = 0
            await run()
            assert.strict.equal(calls.length, 1, label)
            let c = calls[0]
            assert.strict.equal(c.fn, 'execFile', label)
            assert.strict.equal(c.prog, expected(AHK_EXE), `${label}: executable`)
            assert.strict.deepStrictEqual(c.args, ['/force', expected(script), ...tail], label)
            for (let p of [c.prog, c.args[1]]) {
                assert.strict.equal(path.isAbsolute(p), true, `${label}: ${p}`)
                assert.strict.equal(path.resolve(p).startsWith(path.join(repoDir, 'bin') + path.sep), false, `${label}: ${p} must not be a file of bin/`)
                assert.strict.equal(sha256Of(p), entOf(path.basename(p)).sha256, `${label}: ${p} is the verified file`)
            }
        }
        assert.strict.deepStrictEqual(fetchCalls, [])
    })

    //fetchedNames, 在全新之快取夾執行run, 回傳其中取得之檔名(檢核各功能只取所需之檔, 不取清單內其餘之檔)
    let fetchedNames = async (tag, run) => {
        let fdSolo = path.join(tmpRoot, `ensureBins-wiring-${tag}`)
        let bk = process.env.W_BIN_CACHE
        process.env.W_BIN_CACHE = fdSolo
        try {
            await run()
            return listFiles(fdSolo).map((v) => path.basename(v)).sort()
        }
        finally {
            process.env.W_BIN_CACHE = bk
            fs.rmSync(fdSolo, { recursive: true, force: true })
        }
    }

    //startRec, 啟動recScp(永不結束, 須process.exit, 故不等待)並等到它啟動AutoHotkey; 移除它登記之Ctrl+C處理(測試中不得留下)
    let startRec = async () => {
        let before = process.listeners('SIGINT')
        let n = calls.length
        recScp(path.join(tmpRoot, 'ensureBins-wiring-rec.json'))
        let t0 = Date.now()
        while (calls.length === n && Date.now() - t0 < 20000) {
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        for (let f of process.listeners('SIGINT')) {
            if (!before.includes(f)) {
                process.removeListener('SIGINT', f)
            }
        }
    }

    it(`each entry point fetches only the files its function needs (not every file of the manifest)`, async function() {
        assert.strict.deepStrictEqual(await fetchedNames('solo-mk', () => mk.mouseScroll(1, 1, 'up', 1)), [AHK_EXE, 'zwheel.ahk'].sort())
        assert.strict.deepStrictEqual(await fetchedNames('solo-rec', () => startRec()), [AHK_EXE, 'zrecord.ahk'].sort())
        if (process.platform === 'win32') {
            assert.strict.deepStrictEqual(await fetchedNames('solo-sc', () => sc.screenFull()), [SCREEN_EXE])
        }
    })

    it(`screen starts the verified screen capture exe by its cache path and writes the exchange file under os.tmpdir(), not beside the exe (E2, §9 exchange files)`, async function() {
        if (process.platform !== 'win32') {
            this.skip()
        }
        let img = await sc.screenFull()
        assert.strict.equal(img.toString(), 'stub-screen-capture')
        assert.strict.equal(calls.length, 1)
        let c = calls[0]
        assert.strict.equal(c.fn, 'execFile')
        assert.strict.equal(c.prog, expected(SCREEN_EXE))
        assert.strict.equal(sha256Of(c.prog), entOf(SCREEN_EXE).sha256)
        assert.strict.equal(c.args.length, 1)
        assert.strict.equal(path.dirname(c.args[0]), os.tmpdir())
        assert.strict.equal(fs.existsSync(c.args[0]), false) //用畢即刪
        assert.strict.deepStrictEqual(fetchCalls, [])
    })

    it(`recScp starts AutoHotkey64.exe with zrecord.ahk by the verified cache paths (E2)`, async function() {
        await startRec()
        assert.strict.equal(calls.length, 1)
        let c = calls[0]
        assert.strict.equal(c.fn, 'spawn')
        assert.strict.equal(c.prog, expected(AHK_EXE))
        assert.strict.deepStrictEqual(c.args, ['/force', expected('zrecord.ahk')])
        assert.strict.deepStrictEqual(fetchCalls, [])
    })

    it(`WMousekey exposes ensureBins as a property of the default export (E2) and no longer the removed getAhk, ensureAhk, getScreenCapture, ensureScreenCapture (project principle 14)`, function() {
        assert.strict.equal(WMousekey.ensureBins, ensureBins)
        for (let k of ['getAhk', 'ensureAhk', 'getScreenCapture', 'ensureScreenCapture']) {
            assert.strict.equal(k in WMousekey, false, k)
        }
    })

    it(`the package root does not depend on the working directory: from another cwd the default cache is <package root>/bin-cache (E2)`, function() {
        let fdCwd = path.join(tmpRoot, 'ensureBins-cwd')
        let fdMirror = path.join(tmpRoot, 'ensureBins-cwd-mirror')
        let fdCache = path.join(repoDir, 'bin-cache')
        let existed = fs.existsSync(fdCache)
        let ent = entOf('zclick.ahk')
        let fdSha = path.join(fdCache, ent.sha256)
        let shaExisted = fs.existsSync(fdSha)
        fs.rmSync(fdCwd, { recursive: true, force: true })
        fs.mkdirSync(fdCwd, { recursive: true })
        buildMirror(fdMirror)
        try {
            let env = { ...process.env, W_BIN_MIRROR: fdMirror, W_BIN_OFFLINE: '1' }
            delete env.W_BIN_CACHE
            let r = cp.spawnSync(process.execPath, [path.join(toolsDir, 'ensureChild.mjs'), JSON.stringify({ names: 'zclick.ahk' })], {
                cwd: fdCwd, env, encoding: 'utf8', windowsHide: true, timeout: 120000,
            })
            assert.strict.equal(r.status, 0, `${r.stdout}${r.stderr}${r.error || ''}`)
            let j = JSON.parse(r.stdout.trim().split('\n').pop())
            assert.strict.equal(j.ok, true)
            assert.strict.deepStrictEqual(j.bins, { 'zclick.ahk': path.join(fdSha, 'zclick.ahk') })
            assert.strict.equal(sha256Of(j.bins['zclick.ahk']), ent.sha256)
            assert.strict.equal(fs.existsSync(path.join(fdCwd, 'bin-cache')), false) //不落在cwd
        }
        finally {
            if (!shaExisted) {
                fs.rmSync(fdSha, { recursive: true, force: true })
            }
            if (!existed) {
                try {
                    fs.rmdirSync(fdCache)
                }
                catch (err) {
                    //ignore
                }
            }
            fs.rmSync(fdCwd, { recursive: true, force: true })
            fs.rmSync(fdMirror, { recursive: true, force: true })
        }
    })

    it(`floatingManifestUrl is not forwarded: a value fsEnsureBins would refuse (not https) still succeeds, because the manifest is pinned (E2)`, async function() {
        //fsEnsureBins於任何模式皆檢核該選項(非https即E_ARG); 轉傳時會拒絕, 不轉傳時成功(注意: 另一個https網址在釘選模式下不被檢核, 無法分辨是否轉傳)
        let direct = await fsEnsureBins('bin/manifest.json', { pkgRoot: repoDir, names: 'zclick.ahk', floatingManifestUrl: 'http://evil.invalid/other/repo/master/bin/manifest.json' })
            .then(() => null)
            .catch((x) => x)
        assert.strict.equal(direct && direct.code, 'E_ARG', 'precondition: fsEnsureBins refuses this value itself')
        let r = await ensureBins({ names: 'zclick.ahk', floatingManifestUrl: 'http://evil.invalid/other/repo/master/bin/manifest.json' })
        assert.strict.equal(r['zclick.ahk'], expected('zclick.ahk'))
        assert.strict.deepStrictEqual(fetchCalls, [])
    })

    it(`options reach fsEnsureBins: names limits the result, an unknown name is refused (E1)`, async function() {
        let r = await ensureBins({ names: AHK_SCRIPTS })
        assert.strict.deepStrictEqual(Object.keys(r).sort(), [...AHK_SCRIPTS].sort())
        let err = await ensureBins({ names: 'no-such-file.exe' }).then(() => null).catch((x) => x)
        assert.strict.equal(err instanceof Error, true)
        assert.strict.equal(typeof err.code, 'string')
    })

})


//規格: D4(經清單校驗後之快取內檔即為實際使用者)、E2; 真實執行檔自本機鏡像取得後確實可執行(取代原需網路之真實下載測試, 不連外網)
//AutoHotkey只執行測試自建之腳本(ExitApp與語法錯誤), 不動滑鼠鍵盤; 截圖exe只截全螢幕存成圖檔, 無桌面工作階段(服務/CI)時以WMOUSEKEY_TEST_NO_DESKTOP=1略過, 未設定時失敗即測試失敗
describe(`real executables obtained into the verified cache`, function() {
    this.timeout(180000)

    let restoreEnv = null
    let fdReal = path.join(tmpRoot, 'ensureBins-real')

    before(function() {
        restoreEnv = setBinEnv('ensureBins-real')
    })

    after(function() {
        restoreEnv()
    })

    it(`AutoHotkey64.exe from the cache: a script with only ExitApp exits 0, a script with a syntax error exits 2 and reports it (/ErrorStdOut)`, async function() {
        if (process.platform !== 'win32') {
            this.skip()
        }
        let bins = await ensureBins({ names: AHK_EXE })
        let fpOk = path.join(fdReal, 'ok.ahk')
        let fpBad = path.join(fdReal, 'bad.ahk')
        fs.writeFileSync(fpOk, 'ExitApp(0)\n')
        fs.writeFileSync(fpBad, 'this is ( not valid\n')
        let r = cp.spawnSync(bins[AHK_EXE], ['/ErrorStdOut', fpOk], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
        assert.strict.equal(r.status, 0, `${r.stdout}${r.stderr}${r.error || ''}`)
        let rb = cp.spawnSync(bins[AHK_EXE], ['/ErrorStdOut', fpBad], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
        assert.strict.equal(rb.status, 2, 'the exit code of AutoHotkey for a script with a syntax error should be 2')
        assert.strict.equal(`${rb.stdout}${rb.stderr}`.includes('Missing'), true, `${rb.stdout}${rb.stderr}`)
    })

    it(`the six scripts from the cache are the ones AutoHotkey is given, each in its own content-addressed folder (M6 is not needed: no #Include between them)`, async function() {
        let bins = await ensureBins({ names: AHK_SCRIPTS })
        let dirs = new Set(AHK_SCRIPTS.map((n) => path.dirname(bins[n])))
        assert.strict.equal(dirs.size, new Set(AHK_SCRIPTS.map((n) => entOf(n).sha256)).size) //內容相異之檔各在不同夾
        for (let n of AHK_SCRIPTS) {
            let txt = bytesOf(n).toString('utf8')
            assert.strict.equal(/^\s*#Include/im.test(txt), false, `${n} must not depend on a sibling file`)
            assert.strict.equal(/A_ScriptDir|A_ScriptFullPath/i.test(txt), false, `${n} must not depend on its own folder`)
        }
    })

    it(`the screen capture exe from the cache writes a PNG`, async function() {
        if (process.platform !== 'win32') {
            this.skip()
        }
        if (process.env.WMOUSEKEY_TEST_NO_DESKTOP === '1') {
            this.skip() //沒有桌面工作階段(服務/CI)時明確以環境變數略過; 未設定時截圖失敗就是測試失敗
        }
        let bins = await ensureBins({ names: SCREEN_EXE })
        let fpOut = path.join(fdReal, 'shot.png')
        let r = cp.spawnSync(bins[SCREEN_EXE], [fpOut], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
        assert.strict.equal(r.status, 0, `${r.stdout}${r.stderr}${r.error || ''}`)
        let head = fs.readFileSync(fpOut).subarray(0, 8)
        assert.strict.equal(head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true, 'should be a PNG')
    })

})
