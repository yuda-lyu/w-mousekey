import assert from 'assert'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import manifest from '../src/binManifest.mjs'
import getAhk, { ensureAhk } from '../src/getAhk.mjs'
import getScreenCapture, { ensureScreenCapture } from '../src/getScreenCapture.mjs'
import { toolsDir, tmpRoot, makeSandbox, removeDir, listDir, cacheDirOf } from './tools/binFake.mjs'

//【需網路】自真實GitHub釘選網址下載(不注入fetch), 以獨立計算之SHA-256比對, 並實際執行
//離線環境以 WMOUSEKEY_TEST_OFFLINE=1 略過本檔
describe('binEnsure: 真實GitHub釘選網址下載 [需網路]', function () {
    this.timeout(180000)

    let sandboxes = []
    let sb = () => {
        let s = makeSandbox('ghDownload')
        sandboxes.push(s)
        return s
    }
    let shaOf = (fp) => crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex')

    before(function () {
        if (process.env.WMOUSEKEY_TEST_OFFLINE === '1') {
            this.skip()
        }
    })

    after(function () {
        sandboxes.forEach((s) => removeDir(s.root))
        try {
            fs.rmdirSync(path.join(tmpRoot, 'ghDownload'))
        }
        catch (err) {
            //ignore
        }
    })

    let shared = null
    let getShared = async () => {
        if (!shared) {
            let s = sb()
            let opt = { env: s.env, cwd: s.cwd }
            let ak = await ensureAhk(opt)
            let fpScreen = await ensureScreenCapture(opt)
            shared = { s, opt, ak, fpScreen }
        }
        return shared
    }

    it('AutoHotkey: 七個檔皆自釘選網址下載, 獨立計算之SHA-256與清單相符, 同步getAhk得到同樣路徑', async function () {
        let { s, opt, ak } = await getShared()
        let dir = cacheDirOf(s, { manifest }, 'ahk')
        assert.deepStrictEqual(listDir(dir), Object.keys(manifest.groups.ahk.files).sort())
        for (let [name, spec] of Object.entries(manifest.groups.ahk.files)) {
            let fp = path.join(dir, name)
            assert.strictEqual(shaOf(fp), spec.sha256, name)
            assert.strictEqual(fs.statSync(fp).size, spec.size, name)
        }
        assert.deepStrictEqual(getAhk(opt), ak)
    })

    it('截圖exe: 自釘選網址下載, 獨立計算之SHA-256與清單相符', async function () {
        let { opt, fpScreen } = await getShared()
        let spec = Object.values(manifest.groups.screen.files)[0]
        assert.strictEqual(shaOf(fpScreen), spec.sha256)
        assert.strictEqual(getScreenCapture(opt), fpScreen)
    })

    it('AutoHotkey可執行: /ErrorStdOut執行只有ExitApp之腳本 -> 結束碼0; 有語法錯誤之腳本 -> 結束碼2且輸出錯誤', async function () {
        if (process.platform !== 'win32') {
            this.skip()
        }
        let { s, ak } = await getShared()
        let fpOk = path.join(s.root, 'ok.ahk')
        let fpBad = path.join(s.root, 'bad.ahk')
        fs.writeFileSync(fpOk, 'ExitApp(0)\n')
        fs.writeFileSync(fpBad, 'this is ( not valid\n')
        let r = spawnSync(ak.ahkExePath, ['/ErrorStdOut', fpOk], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
        assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}${r.error || ''}`)
        let rb = spawnSync(ak.ahkExePath, ['/ErrorStdOut', fpBad], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
        assert.strictEqual(rb.status, 2, '語法錯誤之腳本AutoHotkey結束碼應為2')
        assert.ok(`${rb.stdout}${rb.stderr}`.includes('Missing'), `/ErrorStdOut應輸出錯誤(v2寫於stderr): ${rb.stdout}${rb.stderr}`)
    })

    it('截圖exe可執行: 產出一張PNG', async function () {
        if (process.platform !== 'win32') {
            this.skip()
        }
        if (process.env.WMOUSEKEY_TEST_NO_DESKTOP === '1') {
            this.skip() //沒有桌面工作階段(服務/CI)時, 明確以環境變數略過; 未設定時截圖失敗就是測試失敗
        }
        let { s, fpScreen } = await getShared()
        let fpOut = path.join(s.root, 'shot.png')
        let r = spawnSync(fpScreen, [fpOut], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
        assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}${r.error || ''}`)
        assert.ok(fs.existsSync(fpOut), '應產出圖檔')
        let head = fs.readFileSync(fpOut).subarray(0, 8)
        assert.ok(head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), '應為PNG')
    })

    //接線: 經公開入口(mousekey,screen,recScp,WMousekey)走完首次使用下載, 而不只是直接呼叫取得函數
    it('接線: 非開發repo之cwd下, mousekey.sendString("")與screen.screenFullSave經ensure自動下載並可用, recScp匯入不拋錯, WMousekey匯出新舊鍵', async function () {
        if (process.platform !== 'win32') {
            this.skip()
        }
        let s = sb()
        let fpOut = path.join(s.root, 'wiring.png')
        let r = spawnSync(process.execPath, [path.join(toolsDir, 'binWiring.mjs'), fpOut], {
            cwd: s.cwd,
            env: { ...process.env, WMOUSEKEY_CACHE_DIR: s.cache },
            windowsHide: true,
            encoding: 'utf8',
            timeout: 120000,
        })
        assert.strictEqual(r.status, 0, `${r.stdout}${r.stderr}${r.error || ''}`)
        let j = JSON.parse(r.stdout.trim().split('\n').pop())
        assert.strictEqual(j.ok, true)
        assert.strictEqual(j.recScp, 'function')
        for (let k of ['mousekey', 'screen', 'compare', 'action', 'ckPic', 'ckPics', 'waitPics', 'keySyntax', 'getAhk', 'getSettings', 'recScp', 'runScp', 'ensureAhk', 'getScreenCapture', 'ensureScreenCapture']) {
            assert.ok(j.keys.includes(k), `WMousekey缺少 ${k}`)
        }
        if (process.env.WMOUSEKEY_TEST_NO_DESKTOP !== '1') {
            assert.ok(j.bytes > 1000 && fs.existsSync(fpOut))
        }
        let dirs = [cacheDirOf(s, { manifest }, 'ahk'), cacheDirOf(s, { manifest }, 'screen')]
        assert.deepStrictEqual(listDir(dirs[0]), Object.keys(manifest.groups.ahk.files).sort(), '應下載至測試用快取目錄(而非使用開發repo內檔案)')
        assert.deepStrictEqual(listDir(dirs[1]), Object.keys(manifest.groups.screen.files))
    })

    it('真實內容與清單雜湊不符(清單被改) -> 拋E_HASH_MISMATCH, 不留檔, 不被使用', async function () {
        let s = sb()
        let m = JSON.parse(JSON.stringify(manifest))
        Object.values(m.groups.screen.files)[0].sha256 = '0'.repeat(64)
        let opt = { env: s.env, cwd: s.cwd, manifest: m }
        await assert.rejects(() => ensureScreenCapture(opt), (err) => err.code === 'E_HASH_MISMATCH')
        assert.deepStrictEqual(listDir(cacheDirOf(s, { manifest: m }, 'screen')), [])
        assert.throws(() => getScreenCapture(opt), (err) => err.code === 'E_NOT_READY')
    })

    it('真實HTTP 404(釘選提交內無此檔) -> 錯誤訊息含網址與自行指定路徑說明', async function () {
        let s = sb()
        let m = JSON.parse(JSON.stringify(manifest))
        m.groups.screen.files['no-such-file.exe'] = m.groups.screen.files[Object.keys(m.groups.screen.files)[0]]
        delete m.groups.screen.files[Object.keys(m.groups.screen.files)[0]]
        let opt = { env: s.env, cwd: s.cwd, manifest: m }
        await assert.rejects(() => ensureScreenCapture(opt), (err) => {
            assert.ok(err.message.includes(`${manifest.rawBase}_screenCapture/no-such-file.exe`), err.message)
            assert.ok(err.message.includes('404'))
            assert.ok(err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
            return true
        })
    })

})
