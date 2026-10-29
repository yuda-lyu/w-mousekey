import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { execFileSync, spawnSync } from 'child_process'
import fsGetBinManifestEntry from 'wsemi/src/fsGetBinManifestEntry.mjs'
import fsEnsureBins from 'wsemi/src/fsEnsureBins.mjs'
import { repoDir, tmpRoot, AHK_EXE, AHK_SCRIPTS, SCREEN_EXE } from './tools/binEnv.mjs'


let fp = (...a) => path.join(repoDir, ...a)
let lines = (fn) => {
    return fs.readFileSync(fp(fn), 'utf8').split(/\r?\n/).map((v) => v.trim())
}


//規格: 外部執行檔之存放下載校驗與離線(制式規格) S1、S2、S5、M1、M2、M4、D1、§8 T1、T2、§9第122行(套件層T1/T2之改良)
describe(`bin/manifest.json`, function() {
    this.timeout(120000)

    let fdt = path.join(tmpRoot, 'binManifest')

    //清單在it內讀(缺清單時單案失敗而非整檔載入失敗)
    let readManifest = () => {
        return JSON.parse(fs.readFileSync(fp('bin', 'manifest.json'), 'utf8'))
    }

    after(function() {
        fs.rmSync(fdt, { recursive: true, force: true })
        try {
            fs.rmdirSync(tmpRoot) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {
            //ignore
        }
    })

    it(`should pass the schema check of fsEnsureBins (M1, M2)`, async function() {
        //離線且快取為空資料夾: 清單有效時為E_OFFLINE_MISSING(缺檔), 清單無效時為E_MANIFEST; 不連網
        let err = null
        try {
            await fsEnsureBins('bin/manifest.json', { pkgRoot: repoDir, cacheDir: path.join(fdt, 'cache'), mirror: '', offline: true })
        }
        catch (e) {
            err = e
        }
        assert.strict.equal(err && err.code, 'E_OFFLINE_MISSING', err && err.message)
        assert.strict.equal(err.missing.length, 8) //清單內8檔皆缺
    })

    it(`should be a pinned manifest of w-mousekey listing the AutoHotkey64.exe, six z*.ahk scripts and the screen capture exe (M1, M2, U1)`, function() {
        let manifest = readManifest()
        //M1: pkg、mode、repo; M2/F15: 釘選模式之自有檔網址ref須為40碼提交
        assert.strict.equal(manifest.schema, 1)
        assert.strict.equal(manifest.pkg, 'w-mousekey')
        assert.strict.equal(manifest.mode, 'pinned')
        assert.strict.equal(manifest.repo, 'yuda-lyu/w-mousekey')
        assert.strict.equal(/^[0-9a-f]{40}$/.test(manifest.commit), true, manifest.commit)
        assert.strict.deepStrictEqual(manifest.files.map((v) => v.name).sort(), [AHK_EXE, ...AHK_SCRIPTS, SCREEN_EXE].sort())
        for (let f of manifest.files) {
            assert.strict.equal(f.path, `bin/${f.name}`, f.name)
            assert.strict.equal(/^[0-9a-f]{64}$/.test(f.sha256), true, f.name)
            assert.strict.equal(Number.isInteger(f.size) && f.size > 0, true, f.name)
        }
    })

    it(`should cover every tracked file of bin/ (nothing in bin/ escapes the manifest)`, function() {
        let manifest = readManifest()
        let tracked = execFileSync('git', ['ls-files', '-z', '--', 'bin'], { cwd: repoDir, encoding: 'utf8', windowsHide: true })
            .split('\0').filter((v) => v !== '' && v !== 'bin/manifest.json')
        assert.strict.deepStrictEqual(tracked.sort(), manifest.files.map((v) => v.path).sort())
    })

    it(`should match the real files in bin/ (M4, T2)`, async function() {
        let manifest = readManifest()
        for (let f of manifest.files) {
            for (let p of [f, ...(f.parts || [])]) {
                if (typeof p.path === 'string') {
                    let e = await fsGetBinManifestEntry(fp(p.path))
                    assert.strict.deepStrictEqual([e.sha256, e.size], [p.sha256, p.size], p.path)
                }
            }
        }
    })

    it(`should hold, byte for byte, the files of the pinned commit in bin/ (T2: what GitHub serves at the pinned url is what the working tree has)`, function() {
        let manifest = readManifest()
        let git = (args) => {
            return execFileSync('git', args, { cwd: repoDir, windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
        }
        try {
            git(['cat-file', '-e', `${manifest.commit}^{commit}`])
        }
        catch (err) {
            this.skip() //淺層clone等取不到該提交時略過
        }
        for (let f of manifest.files) {
            let blob = git(['cat-file', 'blob', `${manifest.commit}:${f.path}`])
            let real = fs.readFileSync(fp(f.path))
            assert.strict.equal(blob.equals(real), true, `${f.path} differs from ${manifest.commit}`)
            assert.strict.equal(blob.length, f.size, `${f.path} size of the commit differs from the manifest`)
        }
    })

    it(`should not download at install time: no install scripts (D1)`, function() {
        let pkg = JSON.parse(fs.readFileSync(fp('package.json'), 'utf8'))
        for (let k of ['preinstall', 'install', 'postinstall', 'prepare']) {
            assert.strict.equal(Object.prototype.hasOwnProperty.call(pkg.scripts || {}, k), false, k)
        }
    })

    it(`should have dropped the self-written download and the old folders without a compatibility layer (project principle 14)`, function() {
        for (let p of ['_autoHotkey', '_screenCapture', 'src/binEnsure.mjs', 'src/binManifest.mjs', 'src/getAhk.mjs', 'src/getScreenCapture.mjs']) {
            assert.strict.equal(fs.existsSync(fp(p)), false, p)
        }
    })

    it(`should keep the cache out of git and the npm package (S5) and bin/ out of the npm package except the manifest (S1)`, function() {
        assert.strict.equal(lines('.gitignore').includes('/bin-cache/'), true)
        assert.strict.equal(lines('.npmignore').includes('/bin-cache/'), true)
        assert.strict.equal(lines('.npmignore').includes('/test/_tmp/'), true)
        assert.strict.equal(lines('.npmignore').includes('/bin/*'), true)
        assert.strict.equal(lines('.npmignore').includes('!/bin/manifest.json'), true)
        assert.strict.equal(lines('.gitattributes').includes('bin/** binary'), true) //F12
    })

    it(`should not pack external executables into the npm package, only bin/manifest.json (S1, T1)`, function() {
        //測試暫存(鏡像、快取)與bin/、bin-cache/可能放有執行檔或壓縮檔副本(他測試平行執行時即是), 放誘餌確保缺規則時確定性變紅
        let decoys = [
            path.join(fdt, 'leak', 'AutoHotkey64.exe'),
            fp('bin', 'decoy-lib.dll'),
            fp('bin', 'decoy-pack.zip'),
            fp('bin', 'decoy-pack.zip.001'),
            fp('bin', 'decoy-data.bin'),
            fp('bin-cache', 'decoy-sha256', 'decoy-tool.bin'),
            fp('bin-cache', 'decoy-sha256', 'decoy-tool.exe'),
            fp('src', 'AutoHotkey64.exe'),
        ]
        try {
            for (let d of decoys) {
                fs.mkdirSync(path.dirname(d), { recursive: true })
                fs.writeFileSync(d, 'MZ')
            }
            let r = spawnSync('npm pack --dry-run --json --ignore-scripts', { cwd: repoDir, shell: true, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            assert.strict.equal(r.status, 0, `npm pack失敗: ${r.stderr}`)
            let j = JSON.parse(r.stdout)
            let info = Array.isArray(j) ? j[0] : Object.values(j)[0] //npm 11以前為陣列, npm 12起為以套件名為鍵之物件
            let fps = info.files.map((v) => v.path.replace(/\\/g, '/'))
            assert.strict.deepStrictEqual(fps.filter((v) => /\.(exe|dll|msi|zip|7z|ahk|bat|cmd|chm|bin|\d{3})$/i.test(v)), [])
            assert.strict.deepStrictEqual(fps.filter((v) => v.startsWith('bin/') || v.startsWith('bin-cache/')), ['bin/manifest.json'])
            //套件內無舊路徑檔(src/<執行檔>)與舊資料夾
            assert.strict.deepStrictEqual(fps.filter((v) => /^(_autoHotkey|_screenCapture)\//.test(v) || v.startsWith('src/AutoHotkey') || v.startsWith('src/screenCapture')), [])
        }
        finally {
            for (let d of decoys) {
                fs.rmSync(d, { force: true })
            }
            fs.rmSync(fp('bin-cache', 'decoy-sha256'), { recursive: true, force: true })
            try {
                fs.rmdirSync(fp('bin-cache')) //若原本就有快取則非空, 略過
            }
            catch (err) {
                //ignore
            }
        }
    })

})
