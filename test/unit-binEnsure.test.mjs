import assert from 'assert'
import fs from 'fs'
import path from 'path'
import getAhk, { ensureAhk } from '../src/getAhk.mjs'
import getScreenCapture, { ensureScreenCapture } from '../src/getScreenCapture.mjs'
import { getCacheDir, getCacheRoot } from '../src/binEnsure.mjs'
import { AHK_NAMES, SCREEN_NAME, repoDir, tmpRoot, makeFake, makeFetch, makeSandbox, removeDir, seedCache, cacheDirOf, listDir } from './tools/binFake.mjs'

//規格(任務書範圍2/3): 本機已有且雜湊相符即用 > 否則自釘選網址下載並驗證 > 失敗給明確錯誤(含如何自行指定路徑); 開發repo直接用_autoHotkey/
describe('binEnsure: 執行檔取得(假fetch, 不連網)', function () {
    this.timeout(30000)

    let fake = makeFake()
    let sandboxes = []
    let sb = () => {
        let s = makeSandbox('binEnsure')
        sandboxes.push(s)
        return s
    }
    let urlOf = (g, name) => `${fake.manifest.rawBase}${fake.manifest.groups[g].dir}/${name}`
    let optOf = (s, extra = {}) => ({ env: s.env, cwd: s.cwd, manifest: fake.manifest, retryDelayMs: 1, ...extra })

    after(function () {
        sandboxes.forEach((s) => removeDir(s.root))
        try {
            fs.rmdirSync(path.join(tmpRoot, 'binEnsure'))
        }
        catch (err) {
            //ignore
        }
    })

    describe('雜湊相符即用', function () {

        it('P1 AutoHotkey: 快取目錄內七個檔雜湊皆相符 -> 直接使用, 不呼叫fetch', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'ahk')
            let fetch = makeFetch(fake.contents)
            let ak = await ensureAhk(optOf(s, { fetch }))
            assert.strictEqual(ak.ahkExePath, path.join(dir, 'AutoHotkey64.exe'))
            assert.strictEqual(ak.ahkScriptPathClick, path.join(dir, 'zclick.ahk'))
            assert.strictEqual(fetch.calls.length, 0, '不應下載')
        })

        it('P1 截圖exe: 快取目錄內雜湊相符 -> 直接使用, 不呼叫fetch', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'screen')
            let fetch = makeFetch(fake.contents)
            let fp = await ensureScreenCapture(optOf(s, { fetch }))
            assert.strictEqual(fp, path.join(dir, SCREEN_NAME))
            assert.strictEqual(fetch.calls.length, 0, '不應下載')
        })

        it('P1 同步getAhk/getScreenCapture: 快取目錄內雜湊相符 -> 回傳同樣路徑', async function () {
            let s = sb()
            let dirA = seedCache(s, fake, 'ahk')
            let dirS = seedCache(s, fake, 'screen')
            assert.strictEqual(getAhk(optOf(s)).ahkExePath, path.join(dirA, 'AutoHotkey64.exe'))
            assert.strictEqual(getScreenCapture(optOf(s)), path.join(dirS, SCREEN_NAME))
        })

        it('P1 getAhk回傳物件之鍵與既有API一致(七個路徑)', function () {
            let s = sb()
            seedCache(s, fake, 'ahk')
            let ak = getAhk(optOf(s))
            assert.deepStrictEqual(Object.keys(ak).sort(), [
                'ahkExePath', 'ahkScriptPathClick', 'ahkScriptPathDrag', 'ahkScriptPathSend',
                'ahkScriptPathSendCombo', 'ahkScriptPathWheel', 'ahkScriptPathRecord',
            ].sort())
        })

    })

    describe('下載並驗證', function () {

        it('P3 快取目錄不存在 -> 每個檔各自釘選網址下載一次, 內容雜湊相符, 無殘留暫存檔', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents)
            let ak = await ensureAhk(optOf(s, { fetch }))
            assert.deepStrictEqual([...fetch.calls].sort(), AHK_NAMES.map((n) => urlOf('ahk', n)).sort())
            let dir = cacheDirOf(s, fake, 'ahk')
            assert.strictEqual(ak.ahkExePath, path.join(dir, 'AutoHotkey64.exe'))
            for (let name of AHK_NAMES) {
                assert.ok(fake.contents[urlOf('ahk', name)].equals(fs.readFileSync(path.join(dir, name))), name)
            }
            assert.deepStrictEqual(listDir(dir), [...AHK_NAMES].sort(), '資料夾內只應有七個正式檔')
        })

        it('P3 截圖exe: 下載後驗證並落地', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents)
            let fp = await ensureScreenCapture(optOf(s, { fetch }))
            assert.deepStrictEqual(fetch.calls, [urlOf('screen', SCREEN_NAME)])
            assert.ok(fake.contents[urlOf('screen', SCREEN_NAME)].equals(fs.readFileSync(fp)))
        })

        it('P3 只缺一個檔 -> 只下載缺的那個', async function () {
            let s = sb()
            seedCache(s, fake, 'ahk', AHK_NAMES.filter((n) => n !== 'zwheel.ahk'))
            let fetch = makeFetch(fake.contents)
            await ensureAhk(optOf(s, { fetch }))
            assert.deepStrictEqual(fetch.calls, [urlOf('ahk', 'zwheel.ahk')])
        })

        it('P3 暫時性失敗(503)後重試成功', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents, {
                handler: (url, n) => {
                    if (url.endsWith('zsend.ahk') && n === 1) {
                        return new Response(null, { status: 503, statusText: 'Service Unavailable' })
                    }
                },
            })
            await ensureAhk(optOf(s, { fetch }))
            assert.strictEqual(fetch.calls.filter((c) => c.endsWith('zsend.ahk')).length, 2)
            assert.ok(fs.existsSync(path.join(cacheDirOf(s, fake, 'ahk'), 'zsend.ahk')))
        })

        it('P3 下載內容雜湊不符(大小相同) -> 拋錯, 正式檔與暫存檔皆不存在, 不重試', async function () {
            let s = sb()
            let good = fake.contents[urlOf('ahk', 'zclick.ahk')]
            let evil = Buffer.alloc(good.length, 0x41)
            let fetch = makeFetch(fake.contents, {
                handler: (url) => {
                    if (url.endsWith('zclick.ahk')) {
                        return new Response(evil, { status: 200 })
                    }
                },
            })
            await assert.rejects(() => ensureAhk(optOf(s, { fetch })), (err) => {
                assert.strictEqual(err.code, 'E_HASH_MISMATCH')
                assert.ok(err.message.includes(fake.manifest.groups.ahk.files['zclick.ahk'].sha256), '訊息應含期望雜湊')
                assert.ok(err.message.includes(urlOf('ahk', 'zclick.ahk')), '訊息應含網址')
                return true
            })
            let dir = cacheDirOf(s, fake, 'ahk')
            assert.ok(!listDir(dir).includes('zclick.ahk'), '內容不符之檔不得留在正式檔名')
            assert.ok(!listDir(dir).some((f) => f.endsWith('.part')), '暫存檔應已刪除')
            assert.strictEqual(fetch.calls.filter((c) => c.endsWith('zclick.ahk')).length, 1, '雜湊不符不重試')
            assert.throws(() => getAhk(optOf(s)), (err) => err.code === 'E_NOT_READY', '不符之檔不得被同步getAhk使用')
        })

        it('P3 下載內容大小不符 -> 拋錯且不留檔', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents, {
                handler: (url) => {
                    if (url.endsWith(SCREEN_NAME)) {
                        return new Response(Buffer.from('short'), { status: 200 })
                    }
                },
            })
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch })), (err) => err.code === 'E_HASH_MISMATCH')
            assert.deepStrictEqual(listDir(cacheDirOf(s, fake, 'screen')), [])
        })

    })

    describe('內容不符之本機檔', function () {

        it('P2 本機檔雜湊不符(大小相同) -> 刪除並重新下載正確內容', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'ahk')
            let good = fake.contents[urlOf('ahk', 'AutoHotkey64.exe')]
            fs.writeFileSync(path.join(dir, 'AutoHotkey64.exe'), Buffer.alloc(good.length, 0x42))
            let fetch = makeFetch(fake.contents)
            let ak = await ensureAhk(optOf(s, { fetch }))
            assert.deepStrictEqual(fetch.calls, [urlOf('ahk', 'AutoHotkey64.exe')], '只重下載壞的那個')
            assert.ok(good.equals(fs.readFileSync(ak.ahkExePath)))
        })

        it('P2 本機檔雜湊不符(大小不同)且下載失敗 -> 拋錯, 壞檔已被刪除, 不被使用', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'screen')
            fs.writeFileSync(path.join(dir, SCREEN_NAME), Buffer.from('tampered'))
            let fetch = makeFetch({}, {})
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch, attempts: 1 })), (err) => err.code === 'E_HTTP')
            assert.ok(!fs.existsSync(path.join(dir, SCREEN_NAME)), '壞檔應已刪除')
            assert.throws(() => getScreenCapture(optOf(s)), (err) => err.code === 'E_NOT_READY')
        })

        it('P2 同步getAhk遇雜湊不符之檔 -> 刪除並拋E_NOT_READY, 不回傳該路徑', function () {
            let s = sb()
            let dir = seedCache(s, fake, 'ahk')
            fs.writeFileSync(path.join(dir, 'zdrag.ahk'), 'tampered')
            assert.throws(() => getAhk(optOf(s)), (err) => err.code === 'E_NOT_READY' && err.message.includes('zdrag.ahk'))
            assert.ok(!fs.existsSync(path.join(dir, 'zdrag.ahk')))
        })

    })

    describe('下載失敗之錯誤訊息', function () {

        let cases = [
            ['HTTP 404', { handler: () => new Response(null, { status: 404, statusText: 'Not Found' }) }, 1],
            ['HTTP 500(重試後仍失敗)', { handler: () => new Response(null, { status: 500, statusText: 'Server Error' }) }, 2],
            ['網路例外', {
                handler: () => {
                    let err = new TypeError('fetch failed')
                    err.cause = { code: 'ENOTFOUND' }
                    throw err
                },
            }, 2],
        ]
        for (let [title, fopt, expectCalls] of cases) {
            it(`P4 ${title} -> 訊息含網址, 自行指定路徑之環境變數與快取目錄說明`, async function () {
                let s = sb()
                let fetch = makeFetch(fake.contents, fopt)
                await assert.rejects(() => ensureAhk(optOf(s, { fetch, attempts: 2 })), (err) => {
                    assert.ok(err.message.includes(fake.manifest.rawBase), `應含網址: ${err.message}`)
                    assert.ok(err.message.includes('WMOUSEKEY_AHK_DIR'), '應說明如何自行指定路徑')
                    assert.ok(err.message.includes('zclick.ahk'), '應列出須有之檔案')
                    assert.ok(err.message.includes('WMOUSEKEY_CACHE_DIR'), '應說明快取目錄')
                    assert.ok(err.message.includes(getCacheDir('ahk', optOf(s))), '應含快取目錄')
                    return true
                })
                let counts = {}
                fetch.calls.forEach((u) => {
                    counts[u] = (counts[u] || 0) + 1
                })
                assert.deepStrictEqual(counts, Object.fromEntries(AHK_NAMES.map((n) => [urlOf('ahk', n), expectCalls])), '每個網址應恰好嘗試指定次數(404不重試, 5xx/網路例外重試至attempts)')
                assert.ok(!listDir(cacheDirOf(s, fake, 'ahk')).some((f) => f.endsWith('.part')), '失敗後不留暫存檔')
            })
        }

        it('P4 截圖exe下載失敗 -> 訊息含網址與WMOUSEKEY_SCREENCAPTURE_EXE', async function () {
            let s = sb()
            let fetch = makeFetch({})
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch, attempts: 1 })), (err) => {
                assert.ok(err.message.includes(urlOf('screen', SCREEN_NAME)))
                assert.ok(err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
                return true
            })
        })

        it('P8 同步getAhk尚未下載 -> E_NOT_READY, 訊息指引ensureAhk與WMOUSEKEY_AHK_DIR', function () {
            let s = sb()
            assert.throws(() => getAhk(optOf(s)), (err) => {
                assert.strictEqual(err.code, 'E_NOT_READY')
                assert.ok(err.message.includes('ensureAhk'))
                assert.ok(err.message.includes('WMOUSEKEY_AHK_DIR'))
                return true
            })
            assert.throws(() => getScreenCapture(optOf(s)), (err) => err.code === 'E_NOT_READY' && err.message.includes('ensureScreenCapture'))
        })

    })

    describe('自行指定路徑(離線/企業環境)', function () {

        let makeUserDir = (s, names) => {
            let fd = path.join(s.root, 'mine')
            fs.mkdirSync(fd, { recursive: true })
            for (let n of names) {
                fs.writeFileSync(path.join(fd, n), `user-own-${n}`) //雜湊與清單不同, 證明不驗證
            }
            return fd
        }

        it('P6 WMOUSEKEY_AHK_DIR優先於快取與下載, 不呼叫fetch, 不建立快取目錄', async function () {
            let s = sb()
            let fd = makeUserDir(s, AHK_NAMES)
            seedCache(s, fake, 'ahk') //快取內有正確檔, 仍應優先用指定的
            let fetch = makeFetch(fake.contents)
            let ak = await ensureAhk(optOf(s, { fetch, env: { ...s.env, WMOUSEKEY_AHK_DIR: fd } }))
            assert.strictEqual(ak.ahkExePath, path.join(path.resolve(fd), 'AutoHotkey64.exe'))
            assert.strictEqual(ak.ahkScriptPathRecord, path.join(path.resolve(fd), 'zrecord.ahk'))
            assert.strictEqual(fetch.calls.length, 0)
            assert.strictEqual(getAhk(optOf(s, { env: { ...s.env, WMOUSEKEY_AHK_DIR: fd } })).ahkExePath, ak.ahkExePath)
        })

        it('P6 兩個環境變數都設定時不要求也不建立快取目錄(快取根指向不存在之位置, 同步/非同步皆成功且未被建立)', async function () {
            let s = sb()
            let fd = makeUserDir(s, AHK_NAMES)
            let fpShot = path.join(fd, 'my-shot.exe')
            fs.writeFileSync(fpShot, 'own')
            let cacheRoot = path.join(s.root, 'never-created')
            let env = { WMOUSEKEY_CACHE_DIR: cacheRoot, WMOUSEKEY_AHK_DIR: fd, WMOUSEKEY_SCREENCAPTURE_EXE: fpShot }
            let fetch = makeFetch(fake.contents)
            await ensureAhk(optOf(s, { fetch, env }))
            await ensureScreenCapture(optOf(s, { fetch, env }))
            getAhk(optOf(s, { env }))
            getScreenCapture(optOf(s, { env }))
            assert.strictEqual(fetch.calls.length, 0)
            assert.ok(!fs.existsSync(cacheRoot), '免下載途徑不得碰快取目錄')
        })

        it('P6 WMOUSEKEY_AHK_DIR內名稱存在但是資料夾而非檔案 -> 拋E_OVERRIDE(同步/非同步), 不退回下載', async function () {
            let s = sb()
            let fd = path.join(s.root, 'mine-dirs')
            for (let n of AHK_NAMES) {
                fs.mkdirSync(path.join(fd, n), { recursive: true })
            }
            let env = { ...s.env, WMOUSEKEY_AHK_DIR: fd }
            let fetch = makeFetch(fake.contents)
            assert.throws(() => getAhk(optOf(s, { env })), (err) => err.code === 'E_OVERRIDE')
            await assert.rejects(() => ensureAhk(optOf(s, { fetch, env })), (err) => err.code === 'E_OVERRIDE')
            assert.strictEqual(fetch.calls.length, 0)
        })

        it('P6 WMOUSEKEY_SCREENCAPTURE_EXE指向資料夾 -> 拋E_OVERRIDE', async function () {
            let s = sb()
            let env = { ...s.env, WMOUSEKEY_SCREENCAPTURE_EXE: s.root }
            assert.throws(() => getScreenCapture(optOf(s, { env })), (err) => err.code === 'E_OVERRIDE')
            await assert.rejects(() => ensureScreenCapture(optOf(s, { env })), (err) => err.code === 'E_OVERRIDE')
        })

        it('P6 WMOUSEKEY_AHK_DIR不完整 -> 拋E_OVERRIDE並列出缺的檔, 不退回下載', async function () {
            let s = sb()
            let fd = makeUserDir(s, AHK_NAMES.filter((n) => n !== 'zwheel.ahk'))
            let fetch = makeFetch(fake.contents)
            await assert.rejects(() => ensureAhk(optOf(s, { fetch, env: { ...s.env, WMOUSEKEY_AHK_DIR: fd } })), (err) => {
                return err.code === 'E_OVERRIDE' && err.message.includes('zwheel.ahk')
            })
            assert.strictEqual(fetch.calls.length, 0)
        })

        it('P6 WMOUSEKEY_SCREENCAPTURE_EXE優先, 不呼叫fetch', async function () {
            let s = sb()
            let fd = makeUserDir(s, ['my-shot.exe'])
            let fp = path.join(fd, 'my-shot.exe')
            let fetch = makeFetch(fake.contents)
            let env = { ...s.env, WMOUSEKEY_SCREENCAPTURE_EXE: fp }
            assert.strictEqual(await ensureScreenCapture(optOf(s, { fetch, env })), path.resolve(fp))
            assert.strictEqual(getScreenCapture(optOf(s, { env })), path.resolve(fp))
            assert.strictEqual(fetch.calls.length, 0)
        })

        it('P6 WMOUSEKEY_SCREENCAPTURE_EXE指向不存在之檔 -> 拋E_OVERRIDE, 不退回下載', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents)
            let env = { ...s.env, WMOUSEKEY_SCREENCAPTURE_EXE: path.join(s.root, 'nope.exe') }
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch, env })), (err) => err.code === 'E_OVERRIDE')
            assert.strictEqual(fetch.calls.length, 0)
        })

    })

    describe('開發本repo', function () {

        let makeRepo = (s, pkgName, names, fdName) => {
            let cwd = path.join(s.root, 'repo')
            fs.mkdirSync(path.join(cwd, fdName), { recursive: true })
            if (pkgName) {
                fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: pkgName }))
            }
            for (let n of names) {
                fs.writeFileSync(path.join(cwd, fdName, n), `dev-${n}`) //開發者會改z*.ahk, 不驗雜湊
            }
            return cwd
        }

        it('P7 cwd為w-mousekey之repo且有_autoHotkey/ -> 直接用, 不驗雜湊, 不呼叫fetch', async function () {
            let s = sb()
            let cwd = makeRepo(s, 'w-mousekey', AHK_NAMES, '_autoHotkey')
            let fetch = makeFetch(fake.contents)
            let ak = await ensureAhk(optOf(s, { fetch, cwd }))
            assert.strictEqual(ak.ahkExePath, path.join(cwd, '_autoHotkey', 'AutoHotkey64.exe'))
            assert.strictEqual(fetch.calls.length, 0)
            assert.strictEqual(getAhk(optOf(s, { cwd })).ahkScriptPathClick, path.join(cwd, '_autoHotkey', 'zclick.ahk'))
        })

        it('P7 cwd為w-mousekey之repo且有_screenCapture/ -> 直接用', async function () {
            let s = sb()
            let cwd = makeRepo(s, 'w-mousekey', [SCREEN_NAME], '_screenCapture')
            let fetch = makeFetch(fake.contents)
            assert.strictEqual(await ensureScreenCapture(optOf(s, { fetch, cwd })), path.join(cwd, '_screenCapture', SCREEN_NAME))
            assert.strictEqual(fetch.calls.length, 0)
        })

        it('P7 其他專案cwd下恰有_autoHotkey/(package.json名稱不符或無package.json) -> 不信任, 改走下載', async function () {
            for (let pkgName of ['other-project', '']) {
                let s = sb()
                let cwd = makeRepo(s, pkgName, AHK_NAMES, '_autoHotkey')
                let fetch = makeFetch(fake.contents)
                let ak = await ensureAhk(optOf(s, { fetch, cwd }))
                assert.strictEqual(fetch.calls.length, AHK_NAMES.length, '應下載')
                assert.strictEqual(ak.ahkExePath, path.join(cacheDirOf(s, fake, 'ahk'), 'AutoHotkey64.exe'))
            }
        })

        it('P7 開發repo只有AutoHotkey主檔、缺腳本檔 -> 不當作可用的開發repo, 改走下載(不回傳不存在之路徑)', async function () {
            let s = sb()
            let cwd = makeRepo(s, 'w-mousekey', ['AutoHotkey64.exe'], '_autoHotkey')
            let fetch = makeFetch(fake.contents)
            let ak = await ensureAhk(optOf(s, { fetch, cwd }))
            assert.strictEqual(ak.ahkExePath, path.join(cacheDirOf(s, fake, 'ahk'), 'AutoHotkey64.exe'))
            assert.ok(fs.existsSync(ak.ahkScriptPathClick))
            assert.strictEqual(getAhk(optOf(s, { cwd })).ahkExePath, ak.ahkExePath, '同步版同樣不把殘缺的repo視為可用')
        })

        it('P7 開發repo的截圖主檔名稱其實是資料夾 -> 不當作可用, 改走下載', async function () {
            let s = sb()
            let cwd = path.join(s.root, 'repo')
            fs.mkdirSync(path.join(cwd, '_screenCapture', SCREEN_NAME), { recursive: true })
            fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'w-mousekey' }))
            let fetch = makeFetch(fake.contents)
            let fp = await ensureScreenCapture(optOf(s, { fetch, cwd }))
            assert.strictEqual(fp, path.join(cacheDirOf(s, fake, 'screen'), SCREEN_NAME))
            assert.ok(fs.statSync(fp).isFile())
        })

        it('P7 真實repo(cwd=repo根, 預設manifest): getAhk()與getScreenCapture()回傳repo內_autoHotkey/與_screenCapture/路徑', function () {
            if (!fs.existsSync(path.join(repoDir, '_autoHotkey', 'AutoHotkey64.exe'))) {
                this.skip()
            }
            let ak = getAhk({ cwd: repoDir, env: {} })
            assert.strictEqual(ak.ahkExePath, path.join(repoDir, '_autoHotkey', 'AutoHotkey64.exe'))
            assert.strictEqual(getScreenCapture({ cwd: repoDir, env: {} }), path.join(repoDir, '_screenCapture', SCREEN_NAME))
        })

    })

    describe('快取目錄', function () {

        it('預設位置於使用者快取目錄(非套件目錄), 子目錄帶釘選提交, 可由WMOUSEKEY_CACHE_DIR改', function () {
            let dir = getCacheDir('ahk', { env: { WMOUSEKEY_CACHE_DIR: path.join(tmpRoot, 'x') }, manifest: fake.manifest })
            assert.strictEqual(dir, path.join(tmpRoot, 'x', fake.manifest.commit.slice(0, 12), '_autoHotkey'))
            let root = getCacheRoot({ env: process.platform === 'win32' ? { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' } : { XDG_CACHE_HOME: '/home/u/.cache' } })
            assert.strictEqual(root, process.platform === 'win32' ? path.join('C:\\Users\\u\\AppData\\Local', 'w-mousekey') : path.join('/home/u/.cache', 'w-mousekey'))
            assert.ok(!root.startsWith(repoDir), '不得落在套件目錄')
        })

    })

    describe('並行首次使用(同行程)', function () {

        it('P5 多個並行呼叫(含AHK與截圖) -> 每個網址只下載一次, 結果一致且檔案完好', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents, { delayMs: 30 })
            let opt = optOf(s, { fetch })
            let rs = await Promise.all([ensureAhk(opt), ensureAhk(opt), ensureAhk(opt), ensureScreenCapture(opt), ensureScreenCapture(opt)])
            let urls = [...AHK_NAMES.map((n) => urlOf('ahk', n)), urlOf('screen', SCREEN_NAME)].sort()
            assert.deepStrictEqual([...fetch.calls].sort(), urls, '同一網址並行時只應下載一次')
            assert.deepStrictEqual(rs[0], rs[1])
            assert.deepStrictEqual(rs[0], rs[2])
            assert.strictEqual(rs[3], rs[4])
            let dirA = cacheDirOf(s, fake, 'ahk')
            assert.deepStrictEqual(listDir(dirA), [...AHK_NAMES].sort())
            for (let name of AHK_NAMES) {
                assert.ok(fake.contents[urlOf('ahk', name)].equals(fs.readFileSync(path.join(dirA, name))), name)
            }
        })

        it('P4 並行呼叫共用同一個失敗的下載 -> 各自得到完整錯誤(含code),說明文字各只出現一次', async function () {
            let s = sb()
            let fetch = makeFetch({}, { delayMs: 20 })
            let opt = optOf(s, { fetch, attempts: 1 })
            let rs = await Promise.allSettled([ensureScreenCapture(opt), ensureScreenCapture(opt)])
            assert.strictEqual(fetch.calls.length, 1, '失敗的下載也只做一次')
            for (let r of rs) {
                assert.strictEqual(r.status, 'rejected')
                assert.strictEqual(r.reason.code, 'E_HTTP')
                assert.strictEqual(r.reason.status, 404)
                assert.strictEqual(r.reason.message.split('To use your own copy').length - 1, 1, '說明文字不得重複附加')
            }
        })

        it('P5 並行之一失敗不影響其他呼叫之後續成功(失敗後不殘留進行中狀態)', async function () {
            let s = sb()
            let failFirst = makeFetch(fake.contents, { handler: () => new Response(null, { status: 404, statusText: 'Not Found' }) })
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch: failFirst, attempts: 1 })))
            let ok = makeFetch(fake.contents)
            let fp = await ensureScreenCapture(optOf(s, { fetch: ok }))
            assert.ok(fs.existsSync(fp))
        })

        it('P5 多個行程各自下載、暫存檔名互不相同(跨行程並行不共用暫存檔)', async function () {
            //以兩份獨立模組實例模擬兩個行程: 各有各的進行中表, 同pid, 只能靠暫存檔名帶亂數區分
            let s = sb()
            let m1 = await import('../src/binEnsure.mjs?inst=1')
            let m2 = await import('../src/binEnsure.mjs?inst=2')
            let written = []
            let orig = fs.writeFileSync
            fs.writeFileSync = function (fp, ...rest) {
                if (String(fp).endsWith('.part')) {
                    written.push(String(fp))
                }
                return orig.call(this, fp, ...rest)
            }
            try {
                let fetch = makeFetch(fake.contents, { delayMs: 20 })
                let opt = optOf(s, { fetch })
                await Promise.all([m1.ensureGroup('screen', opt), m2.ensureGroup('screen', opt)])
            }
            finally {
                fs.writeFileSync = orig
            }
            assert.strictEqual(written.length, 2, '兩個實例各寫一次暫存檔')
            assert.notStrictEqual(written[0], written[1], '暫存檔名須互不相同')
            assert.deepStrictEqual(listDir(cacheDirOf(s, fake, 'screen')), [SCREEN_NAME])
        })

        it('P5 更名失敗(Windows下目的檔被占用/別的行程已完成)但目的檔已是正確內容 -> 視為成功', async function () {
            let s = sb()
            let dir = cacheDirOf(s, fake, 'screen')
            let orig = fs.renameSync
            fs.renameSync = function (from, to) {
                //模擬別的行程搶先完成(目的檔已是正確內容), 本行程更名時被拒
                if (String(from).endsWith('.part')) {
                    orig.call(this, from, to)
                    let err = new Error('EPERM: operation not permitted, rename')
                    err.code = 'EPERM'
                    throw err
                }
                return orig.call(this, from, to)
            }
            try {
                let fp = await ensureScreenCapture(optOf(s, { fetch: makeFetch(fake.contents) }))
                assert.ok(fake.contents[urlOf('screen', SCREEN_NAME)].equals(fs.readFileSync(fp)))
            }
            finally {
                fs.renameSync = orig
            }
            assert.deepStrictEqual(listDir(dir), [SCREEN_NAME])
        })

        it('P5 更名失敗且目的檔不存在 -> 拋錯, 不留暫存檔', async function () {
            let s = sb()
            let orig = fs.renameSync
            fs.renameSync = function (from) {
                if (String(from).endsWith('.part')) {
                    let err = new Error('EXDEV: cross-device link not permitted')
                    err.code = 'EXDEV'
                    throw err
                }
                return orig.apply(this, arguments)
            }
            try {
                await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch: makeFetch(fake.contents) })), (err) => err.code === 'EXDEV')
            }
            finally {
                fs.renameSync = orig
            }
            assert.deepStrictEqual(listDir(cacheDirOf(s, fake, 'screen')), [])
        })

    })

    describe('下載失敗之診斷與例外', function () {

        it('P4 原生逾時(AbortSignal.timeout, DOMException) -> E_TIMEOUT, 保留原因, 訊息含網址與說明, 重試至attempts', async function () {
            let s = sb()
            let calls = []
            let fetch = (url, init) => {
                calls.push(url)
                return new Promise((resolve, reject) => {
                    init.signal.addEventListener('abort', () => reject(init.signal.reason))
                })
            }
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch, timeoutMs: 20, attempts: 2 })), (err) => {
                assert.strictEqual(err.code, 'E_TIMEOUT')
                assert.strictEqual(err.cause.cause.name, 'TimeoutError', '原始原因(DOMException)應保留在cause鏈')
                assert.ok(err.message.includes(urlOf('screen', SCREEN_NAME)), err.message)
                assert.ok(err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
                return true
            })
            assert.strictEqual(calls.length, 2)
            assert.deepStrictEqual(listDir(cacheDirOf(s, fake, 'screen')), [])
        })

        it('P3 HTTP 429重試後成功', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents, {
                handler: (url, n) => {
                    if (n === 1) {
                        return new Response(null, { status: 429, statusText: 'Too Many Requests' })
                    }
                },
            })
            let fp = await ensureScreenCapture(optOf(s, { fetch }))
            assert.strictEqual(fetch.calls.length, 2)
            assert.ok(fs.existsSync(fp))
        })

        it('P3 讀取回應本文失敗(連線中斷)重試後成功', async function () {
            let s = sb()
            let fetch = makeFetch(fake.contents, {
                handler: (url, n) => {
                    if (n === 1) {
                        return {
                            ok: true,
                            status: 200,
                            arrayBuffer: async () => {
                                throw new Error('socket hang up')
                            },
                        }
                    }
                },
            })
            let fp = await ensureScreenCapture(optOf(s, { fetch }))
            assert.strictEqual(fetch.calls.length, 2)
            assert.ok(fs.existsSync(fp))
        })

        it('P4 沒有全域fetch -> E_NO_FETCH, 訊息含自行指定路徑說明', async function () {
            let s = sb()
            let orig = globalThis.fetch
            globalThis.fetch = undefined
            try {
                await assert.rejects(() => ensureScreenCapture(optOf(s)), (err) => err.code === 'E_NO_FETCH' && err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
            }
            finally {
                globalThis.fetch = orig
            }
        })

        it('P2 快取位置被資料夾占住(刪不掉) -> E_BAD_FILE, 同步/非同步訊息皆含自行指定路徑說明, 不下載', async function () {
            let s = sb()
            let dir = cacheDirOf(s, fake, 'screen')
            fs.mkdirSync(path.join(dir, SCREEN_NAME), { recursive: true })
            let fetch = makeFetch(fake.contents)
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch })), (err) => err.code === 'E_BAD_FILE' && err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
            assert.throws(() => getScreenCapture(optOf(s)), (err) => err.code === 'E_BAD_FILE' && err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
            assert.strictEqual(fetch.calls.length, 0)
        })

        it('P4 無法建立快取資料夾(快取根是一個檔案) -> 訊息含下載網址與自行指定路徑說明, 不呼叫fetch', async function () {
            let s = sb()
            let fpFile = path.join(s.root, 'iam-a-file')
            fs.writeFileSync(fpFile, 'x')
            let fetch = makeFetch(fake.contents)
            await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch, env: { WMOUSEKEY_CACHE_DIR: fpFile } })), (err) => {
                assert.ok(err.message.includes(urlOf('screen', SCREEN_NAME)), err.message)
                assert.ok(err.message.includes('WMOUSEKEY_SCREENCAPTURE_EXE'))
                return true
            })
            assert.strictEqual(fetch.calls.length, 0)
        })

        it('P4 雜湊不符且暫存檔刪不掉 -> 如實說明(帶cleanupError, 不稱已丟棄), 正式檔名不存在', async function () {
            let s = sb()
            let good = fake.contents[urlOf('screen', SCREEN_NAME)]
            let fetch = makeFetch(fake.contents, {
                handler: (url) => new Response(Buffer.alloc(good.length, 0x44), { status: 200 }),
            })
            let orig = fs.rmSync
            fs.rmSync = function (fp) {
                if (String(fp).endsWith('.part')) {
                    let err = new Error('EPERM: operation not permitted, unlink')
                    err.code = 'EPERM'
                    throw err
                }
                return orig.apply(this, arguments)
            }
            let dir = cacheDirOf(s, fake, 'screen')
            try {
                await assert.rejects(() => ensureScreenCapture(optOf(s, { fetch })), (err) => {
                    assert.strictEqual(err.code, 'E_HASH_MISMATCH')
                    assert.ok(err.cleanupError && err.cleanupError.code === 'EPERM')
                    assert.ok(err.message.includes('could not be removed'), err.message)
                    assert.ok(!err.message.includes('discarded'), err.message)
                    return true
                })
                assert.ok(!listDir(dir).includes(SCREEN_NAME))
                assert.strictEqual(listDir(dir).filter((f) => f.endsWith('.part')).length, 1, '清不掉之暫存檔須如實留在磁碟並於訊息指出')
            }
            finally {
                fs.rmSync = orig
                listDir(dir).filter((f) => f.endsWith('.part')).forEach((f) => fs.rmSync(path.join(dir, f), { force: true }))
            }
        })

    })

    describe('檢查與使用之間檔案被別的行程改動', function () {

        it('P5 檢查到壞檔後、刪除前,別的行程已換成好檔(身分改變) -> 不刪除該好檔, 不下載', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'screen')
            let fp = path.join(dir, SCREEN_NAME)
            let good = fake.contents[urlOf('screen', SCREEN_NAME)]
            fs.writeFileSync(fp, Buffer.alloc(good.length, 0x45)) //壞檔(大小相同)
            let orig = fs.statSync
            let n = 0
            fs.statSync = function (p) {
                if (String(p) === fp) {
                    n += 1
                    if (n === 2) {
                        //第2次取得檔案身分(刪除前)之前, 別的行程以更名方式發布了好檔
                        let swap = `${fp}.swap`
                        fs.writeFileSync(swap, good)
                        let t = new Date(Date.now() + 10000)
                        fs.utimesSync(swap, t, t)
                        fs.renameSync(swap, fp)
                    }
                }
                return orig.apply(this, arguments)
            }
            let fetch = makeFetch({})
            try {
                let r = await ensureScreenCapture(optOf(s, { fetch, attempts: 1 }))
                assert.strictEqual(r, fp)
            }
            finally {
                fs.statSync = orig
            }
            assert.strictEqual(fetch.calls.length, 0, '好檔不得被刪掉而重新下載')
            assert.ok(good.equals(fs.readFileSync(fp)))
        })

        it('P5 補下載期間先前已通過檢查之檔被改成錯誤內容 -> 補完後重新驗證並修復, 回傳之每個檔皆符合清單', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'ahk', AHK_NAMES.filter((n) => n !== 'zsend.ahk'))
            let fpExe = path.join(dir, 'AutoHotkey64.exe')
            let goodExe = fake.contents[urlOf('ahk', 'AutoHotkey64.exe')]
            let fetch = makeFetch(fake.contents, {
                handler: (url, n) => {
                    if (url.endsWith('zsend.ahk')) {
                        fs.writeFileSync(fpExe, Buffer.alloc(goodExe.length, 0x46)) //下載zsend.ahk的同時, 主檔被換成同大小的錯誤內容
                    }
                },
            })
            let ak = await ensureAhk(optOf(s, { fetch }))
            assert.deepStrictEqual([...fetch.calls].sort(), [urlOf('ahk', 'AutoHotkey64.exe'), urlOf('ahk', 'zsend.ahk')].sort())
            for (let name of AHK_NAMES) {
                assert.ok(fake.contents[urlOf('ahk', name)].equals(fs.readFileSync(path.join(dir, name))), `${name} 應符合清單`)
            }
            assert.strictEqual(ak.ahkExePath, fpExe)
        })

        it('P5 補下載兩輪後仍有檔被改成錯誤內容 -> 拋E_NOT_READY並指出該檔, 不回傳不符之檔', async function () {
            let s = sb()
            let dir = seedCache(s, fake, 'ahk', AHK_NAMES.filter((n) => n !== 'zsend.ahk'))
            let corrupt = (name) => fs.writeFileSync(path.join(dir, name), Buffer.alloc(fake.manifest.groups.ahk.files[name].size, 0x47))
            let fetch = makeFetch(fake.contents, {
                handler: (url) => {
                    //每一輪下載期間各弄壞另一個檔: 第1輪(zsend.ahk)壞zdrag.ahk, 第2輪(zdrag.ahk)壞zwheel.ahk
                    if (url.endsWith('zsend.ahk')) {
                        corrupt('zdrag.ahk')
                    }
                    else if (url.endsWith('zdrag.ahk')) {
                        corrupt('zwheel.ahk')
                    }
                },
            })
            await assert.rejects(() => ensureAhk(optOf(s, { fetch })), (err) => err.code === 'E_NOT_READY' && err.message.includes('zwheel.ahk'))
        })

    })
})
