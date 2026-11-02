import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { repoDir, testDir } from './tools/binEnv.mjs'

//規格: 外部執行檔之存放下載校驗與離線 S1(執行檔不入包, bin/下只有manifest.json入包; 任務書範圍1)
//規格: 自有套件之npm發布範圍(dspec) 原則1(npm包=git版控內容, sgud/,docs/,test/,toolg/ 皆隨包), 原則2第1條(只有外部執行檔與其附屬才排除), 原則3(.npmignore首段抄.gitignore), 原則4(sgud/,src/,dist/,README.md,LICENSE,package.json,test/tools/ 一律不排除)
//規格: 同上 原則2〈套件測試之npm包檢查〉(2026-11-02使用者裁示A): ①「不得入包」只列外部執行檔與壓縮檔,bin/除manifest.json外之檔,CLAUDE*.md,tmp/,test/_tmp/,.env, 不得斷言sgud/,docs/,test/,toolg/,script.txt,開發設定檔等不在; ②大小上限只計執行期之src/,dist/,bin/
//以真實的 npm pack --dry-run 取得檔案清單(不連網, 不產生tgz)
describe('npm pack: 包內容', function () {
    this.timeout(120000)

    let files = []

    //repo內某資料夾之全部檔案(相對套件根, 以/分隔)
    let listRepoFiles = (rel) => {
        return fs.readdirSync(path.join(repoDir, rel), { recursive: true, withFileTypes: true })
            .filter((d) => d.isFile())
            .map((d) => path.relative(repoDir, path.join(d.parentPath, d.name)).replace(/\\/g, '/'))
    }

    before(function () {
        let r = spawnSync('npm pack --dry-run --json --ignore-scripts', {
            cwd: repoDir,
            shell: true,
            windowsHide: true,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        })
        assert.strictEqual(r.status, 0, `npm pack失敗: ${r.stderr}`)
        let j = JSON.parse(r.stdout)
        let info = Array.isArray(j) ? j[0] : Object.values(j)[0]
        files = info.files.map((f) => ({ path: f.path.replace(/\\/g, '/'), size: f.size }))
        assert.ok(files.length > 0)
    })

    it('P9 包內不得有外部執行檔與壓縮檔(.exe,.dll,.node,.msi,.zip,.7z,.gz,.tgz)及其附屬腳本(.ahk,.bat,.cmd,.chm)(npm發布範圍 原則2①)', function () {
        let bad = files.filter((f) => /\.(exe|dll|node|msi|zip|7z|gz|tgz|ahk|bat|cmd|chm)$/i.test(f.path)).map((f) => f.path)
        assert.deepStrictEqual(bad, [])
    })

    it('P9 包內bin/下只有manifest.json, 無bin-cache/(其餘一律不入包, 含非禁入副檔名之檔)(外部執行檔規格S1; npm發布範圍 原則2①)', function () {
        let bad = files.filter((f) => /^(bin|bin-cache|_autoHotkey|_screenCapture)\//.test(f.path)).map((f) => f.path)
        assert.deepStrictEqual(bad, ['bin/manifest.json'])
    })

    it('P9 包內不得有CLAUDE*.md,tmp/,test/_tmp/,_tmp/,.env(npm發布範圍 原則2①; 其餘git版控內容依原則1隨包, 不斷言其不在)', function () {
        let re = /(^|\/)(CLAUDE[^/]*\.md|\.env)$|(^|\/)(tmp|_tmp)\//
        let bad = files.filter((f) => re.test(f.path)).map((f) => f.path)
        assert.deepStrictEqual(bad, [])
    })

    it('P9 包內必須有sgud/(全部檔, 至少sgud/state/state.md)與test/tools/(全部檔)(npm發布範圍 原則1,原則4)', function () {
        let set = new Set(files.map((f) => f.path))
        assert.ok(set.has('sgud/state/state.md'), '缺少 sgud/state/state.md')
        for (let rel of [...listRepoFiles('sgud'), ...listRepoFiles('test/tools')]) {
            assert.ok(set.has(rel), `缺少 ${rel}`)
        }
        assert.ok(files.some((f) => f.path.startsWith('test/tools/')), '缺少 test/tools/')
    })

    it('P9 包內必須有: package.json,README.md,LICENSE,main入口dist/與全部src/*.mjs', function () {
        let set = new Set(files.map((f) => f.path))
        for (let need of ['package.json', 'README.md', 'LICENSE', 'dist/w-mousekey.umd.js']) {
            assert.ok(set.has(need), `缺少 ${need}`)
        }
        assert.ok(set.has('bin/manifest.json'), '缺少 bin/manifest.json(釘選之校驗依據)')
        let srcs = fs.readdirSync(path.join(repoDir, 'src')).filter((n) => n.endsWith('.mjs'))
        assert.ok(srcs.includes('ensureBins.mjs'))
        for (let n of srcs) {
            assert.ok(set.has(`src/${n}`), `缺少 src/${n}`)
        }
    })

    it('P9 執行期src/+dist/+bin/很小(單檔不超過500KB, 總和不超過1MB), 避免其他副檔名之二進位檔混入(npm發布範圍 原則2②: 只計src/,dist/,bin/, 不含docs/,test/,sgud/等隨包資產)', function () {
        let runtime = files.filter((f) => /^(src|dist|bin)\//.test(f.path))
        assert.ok(runtime.length > 0, '執行期src/+dist/+bin/無檔')
        let big = runtime.filter((f) => f.size > 500 * 1024).map((f) => `${f.path} ${f.size}`)
        assert.deepStrictEqual(big, [], '執行期src/+dist/+bin/單檔不得超過500KB')
        let total = runtime.reduce((a, f) => a + f.size, 0)
        assert.ok(total < 1024 * 1024, `執行期src/+dist/+bin/未壓縮總和 ${total}(口徑: 只計src/,dist/,bin/)`)
    })

    //.npmignore首段須完整抄錄.gitignore(npm一旦有.npmignore即不讀.gitignore), 其後才是外部執行檔之排除項
    it('P9 .npmignore首段完整抄錄.gitignore(順序與內容一致; npm發布範圍 原則3)', function () {
        let rows = (fn) => {
            return fs.readFileSync(path.join(repoDir, fn), 'utf8').split(/\r?\n/).map((v) => v.trim()).filter((v) => v !== '' && !v.startsWith('#'))
        }
        let gi = rows('.gitignore')
        let ni = rows('.npmignore')
        assert.deepStrictEqual(ni.slice(0, gi.length), gi)
    })

    //以repo的.npmignore套在自建夾具上: 驗證樣式對「日後新增、命名不同」的檔案也有效, 不只對目前的檔案清單
    it('P9 .npmignore套在夾具: 僅外部執行檔與其附屬(bin/除manifest.json, 各處禁入副檔名含大寫)及.gitignore所列(CLAUDE*.md,tmp,.env,test/_tmp)被排除; sgud,docs(含docs/dist),test(含test/tools),toolg,g*.mjs,pic,script*,開發設定檔,src/get*.mjs,dist,README,bin/manifest.json保留(npm發布範圍 原則1,原則3,原則4)', function () {
        let fd = path.join(testDir, '_tmp', 'npmPack', String(process.pid))
        fs.rmSync(fd, { recursive: true, force: true })
        let put = (rel, text = 'x') => {
            fs.mkdirSync(path.dirname(path.join(fd, rel)), { recursive: true })
            fs.writeFileSync(path.join(fd, rel), text)
        }
        try {
            fs.mkdirSync(fd, { recursive: true })
            fs.copyFileSync(path.join(repoDir, '.npmignore'), path.join(fd, '.npmignore'))
            let kept = [
                'package.json', 'README.md', 'LICENSE', 'dist/x.js', 'src/getExtra.mjs', 'src/go.mjs', 'bin/manifest.json',
                '.gitattributes', '.editorconfig', 'babel.config.js',
                'gSmoke.mjs', 'g-helper.mjs', 'g.rec.mjs', 'g.mjs', 'pic/a.png', 'script_x.json', 'script.txt',
                'test/t.mjs', 'test/tools/t.mjs', 'docs/d.html', 'docs/dist/d.js', 'toolg/t.mjs', 'sgud/state/state.md', 'sgud/rule/r.md',
            ]
            let dropped = [
                'bin/b.dll', 'bin/c.png', 'bin/d.zip.001', 'bin/e.txt', 'bin-cache/s/t.bin', 'test/_tmp/f.dat', 'sub/deep/z.ahk', 'sub/UPPER.EXE', 'sub/y.bat',
                'sub/y.cmd', 'sub/y.chm', 'CLAUDE.md', 'CLAUDE_settings.md', 'tmp/t.txt', '_tmp/t.txt', '.env',
            ]
            put('package.json', JSON.stringify({ name: 'fixture-pkg', version: '0.0.0' }))
            kept.filter((rel) => rel !== 'package.json').forEach((rel) => put(rel, rel === 'bin/manifest.json' ? '{}' : 'x'))
            dropped.forEach((rel) => put(rel))
            let r = spawnSync('npm pack --dry-run --json --ignore-scripts', { cwd: fd, shell: true, windowsHide: true, encoding: 'utf8' })
            assert.strictEqual(r.status, 0, r.stderr)
            let j = JSON.parse(r.stdout)
            let info = Array.isArray(j) ? j[0] : Object.values(j)[0]
            let got = info.files.map((f) => f.path.replace(/\\/g, '/')).sort()
            assert.deepStrictEqual(got, [...kept].sort())
        }
        finally {
            fs.rmSync(fd, { recursive: true, force: true })
            try {
                fs.rmdirSync(path.join(testDir, '_tmp', 'npmPack'))
                fs.rmdirSync(path.join(testDir, '_tmp'))
            }
            catch (err) {
                //ignore
            }
        }
    })

})
