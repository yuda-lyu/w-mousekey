import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { repoDir, testDir } from './tools/binFake.mjs'

//規格(任務書範圍1): npm包內不得有任何.exe,.ahk,.bat,.cmd,.chm; 不含_autoHotkey/,_screenCapture/與開發用檔; main入口與src/須入包
//以真實的 npm pack --dry-run 取得檔案清單(不連網, 不產生tgz)
describe('npm pack: 包內容', function () {
    this.timeout(120000)

    let files = []

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

    it('P9 包內不得有任何.exe,.ahk,.bat,.cmd,.chm', function () {
        let bad = files.filter((f) => /\.(exe|ahk|bat|cmd|chm)$/i.test(f.path)).map((f) => f.path)
        assert.deepStrictEqual(bad, [])
    })

    it('P9 包內不得有_autoHotkey/,_screenCapture/下任何檔(含license.txt,說明.txt,ico等)', function () {
        let bad = files.filter((f) => /^(_autoHotkey|_screenCapture)\//.test(f.path)).map((f) => f.path)
        assert.deepStrictEqual(bad, [])
    })

    it('P9 包內不得有開發用檔: g*.mjs,pic/,script*.json,script.txt,_tmp,test/,docs/,toolg/,sgud/,CLAUDE*.md,開發設定檔', function () {
        let re = /^(g[^/]*\.mjs|pic\/.*|script[^/]*\.json|script\.txt|_tmp\/.*|test\/.*|docs\/.*|toolg\/.*|sgud\/.*|CLAUDE[^/]*\.md|\.editorconfig|\.eslint[^/]*|\.jsdoc|babel\.config\.js)$/
        let bad = files.filter((f) => re.test(f.path)).map((f) => f.path)
        assert.deepStrictEqual(bad, [])
    })

    it('P9 包內必須有: package.json,README.md,LICENSE,main入口dist/與全部src/*.mjs', function () {
        let set = new Set(files.map((f) => f.path))
        for (let need of ['package.json', 'README.md', 'LICENSE', 'dist/w-mousekey.umd.js']) {
            assert.ok(set.has(need), `缺少 ${need}`)
        }
        let srcs = fs.readdirSync(path.join(repoDir, 'src')).filter((n) => n.endsWith('.mjs'))
        assert.ok(srcs.includes('binEnsure.mjs') && srcs.includes('binManifest.mjs') && srcs.includes('getScreenCapture.mjs'))
        for (let n of srcs) {
            assert.ok(set.has(`src/${n}`), `缺少 src/${n}`)
        }
    })

    it('P9 包很小(單檔不超過500KB, 總和不超過1MB), 避免其他副檔名之二進位檔混入', function () {
        let big = files.filter((f) => f.size > 500 * 1024).map((f) => `${f.path} ${f.size}`)
        assert.deepStrictEqual(big, [])
        let total = files.reduce((a, f) => a + f.size, 0)
        assert.ok(total < 1024 * 1024, `未壓縮總和 ${total}`)
    })

    //以repo的.npmignore套在自建夾具上: 驗證樣式對「日後新增、命名不同」的檔案也有效, 不只對目前的檔案清單
    it('P9 .npmignore套在夾具: 根目錄g*.mjs與各處巢狀禁入副檔名(含大寫)被排除, src/get*.mjs,src/g*.mjs,dist,README保留', function () {
        let fd = path.join(testDir, '_tmp', 'npmPack', String(process.pid))
        fs.rmSync(fd, { recursive: true, force: true })
        let put = (rel, text = 'x') => {
            fs.mkdirSync(path.dirname(path.join(fd, rel)), { recursive: true })
            fs.writeFileSync(path.join(fd, rel), text)
        }
        try {
            fs.mkdirSync(fd, { recursive: true })
            fs.copyFileSync(path.join(repoDir, '.npmignore'), path.join(fd, '.npmignore'))
            put('package.json', JSON.stringify({ name: 'fixture-pkg', version: '0.0.0' }))
            put('README.md')
            put('dist/x.js')
            put('src/getExtra.mjs')
            put('src/go.mjs')
            let dropped = [
                'gSmoke.mjs', 'g-helper.mjs', 'g.rec.mjs', 'g.mjs', '_autoHotkey/a.txt', '_autoHotkey/b.dll', '_screenCapture/c.png', 'sub/deep/z.ahk', 'sub/UPPER.EXE', 'sub/y.bat',
                'sub/y.cmd', 'sub/y.chm', 'pic/a.png', 'script_x.json', 'script.txt', 'test/t.mjs', 'docs/d.html', 'toolg/t.mjs', 'sgud/rule/r.md',
            ]
            dropped.forEach((rel) => put(rel))
            let r = spawnSync('npm pack --dry-run --json --ignore-scripts', { cwd: fd, shell: true, windowsHide: true, encoding: 'utf8' })
            assert.strictEqual(r.status, 0, r.stderr)
            let j = JSON.parse(r.stdout)
            let info = Array.isArray(j) ? j[0] : Object.values(j)[0]
            let got = info.files.map((f) => f.path.replace(/\\/g, '/')).sort()
            assert.deepStrictEqual(got, ['README.md', 'dist/x.js', 'package.json', 'src/getExtra.mjs', 'src/go.mjs'])
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
