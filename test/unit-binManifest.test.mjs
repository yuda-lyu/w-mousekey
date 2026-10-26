import assert from 'assert'
import fs from 'fs'
import path from 'path'
import manifest from '../src/binManifest.mjs'
import { AHK_NAMES, SCREEN_NAME, repoDir, sha256 } from './tools/binFake.mjs'

//規格(任務書背景2): 下載網址釘在特定提交; 每個檔以寫死於原始碼之SHA-256驗證
describe('binManifest: 釘選清單', function () {

    let pkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'))
    let repoPath = pkg.repository.url.replace(/^git\+https:\/\/github\.com\//, '').replace(/\.git$/, '')

    it('repo名稱與package.json之repository一致', function () {
        assert.strictEqual(repoPath, 'yuda-lyu/w-mousekey')
        assert.strictEqual(manifest.repo, repoPath)
    })

    it('網址釘在40碼提交雜湊(非分支名), 主機為raw.githubusercontent.com', function () {
        assert.match(manifest.commit, /^[0-9a-f]{40}$/)
        assert.strictEqual(manifest.rawBase, `https://raw.githubusercontent.com/${repoPath}/${manifest.commit}/`)
        assert.ok(!/\/(master|main|HEAD)\//.test(manifest.rawBase), '不得指向會移動之分支')
    })

    it('檔案清單: ahk群組為AutoHotkey64.exe+六個z*.ahk, screen群組為截圖exe, 每檔皆有64碼SHA-256與大小', function () {
        assert.deepStrictEqual(Object.keys(manifest.groups).sort(), ['ahk', 'screen'])
        assert.deepStrictEqual(Object.keys(manifest.groups.ahk.files).sort(), [...AHK_NAMES].sort())
        assert.deepStrictEqual(Object.keys(manifest.groups.screen.files), [SCREEN_NAME])
        for (let g of Object.values(manifest.groups)) {
            for (let [name, spec] of Object.entries(g.files)) {
                assert.match(spec.sha256, /^[0-9a-f]{64}$/, name)
                assert.ok(Number.isInteger(spec.size) && spec.size > 0, name)
            }
        }
    })

    //repo內檔案若被修改而清單未同步, 下載到的舊提交檔將與repo不一致, 故於開發repo內比對
    //.ahk以LF正規化後比對(git於Windows可能轉為CRLF; GitHub raw提供之為git blob, 即LF)
    it('清單與repo內檔案同步(開發repo內才比對, 安裝為相依套件時無該資料夾而略過)', function () {
        if (!fs.existsSync(path.join(repoDir, '_autoHotkey', 'AutoHotkey64.exe'))) {
            this.skip()
        }
        for (let g of Object.values(manifest.groups)) {
            for (let [name, spec] of Object.entries(g.files)) {
                let buf = fs.readFileSync(path.join(repoDir, g.dir, name))
                if (name.endsWith('.ahk')) {
                    buf = Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')
                }
                assert.strictEqual(buf.length, spec.size, `${g.dir}/${name} 大小與清單不符, 請依src/binManifest.mjs註解更新清單`)
                assert.strictEqual(sha256(buf), spec.sha256, `${g.dir}/${name} SHA-256與清單不符, 請依src/binManifest.mjs註解更新清單`)
            }
        }
    })

})
