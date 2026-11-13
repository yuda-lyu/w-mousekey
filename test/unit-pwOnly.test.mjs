//R07: Chromium系瀏覽器之啟動一律經w-playwright(全庫規則R-PW-ONLY之本套件盤點), 不直接依賴或匯入playwright/playwright-core
//本檔只掃描檔案文字(不啟動瀏覽器、不載入test/tools/helper.mjs, 故可對舊版樹之副本直接實跑以示修前紅)
import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

//排除: 相依套件、產物、文件站、各式暫存(ai暫存tmp、測試暫存test/_tmp、_tmp)、版控
const skipDirs = new Set(['node_modules', 'dist', 'docs', 'tmp', '_tmp', 'bin-cache', '.git', 'licenses'])
const selfName = path.basename(fileURLToPath(import.meta.url))

function listScripts(dir, out) {
    for (let ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.isDirectory()) {
            if (!skipDirs.has(ent.name)) {
                listScripts(path.join(dir, ent.name), out)
            }
        }
        else if (/\.(mjs|js)$/.test(ent.name)) {
            out.push(path.join(dir, ent.name))
        }
    }
    return out
}

//套件根之全部.mjs/.js(不含上列排除夾): src, test, toolg與根目錄之g*.mjs等
function allScripts() {
    return listScripts(root, []).filter((f) => path.basename(f) !== selfName)
}

const rel = (f) => path.relative(root, f).replace(/\\/g, '/')

describe('R07: 瀏覽器一律經w-playwright', function () {

    it('R07-1 全部.mjs/.js(含動態import與require)不直接匯入playwright/playwright-core(R-PW-ONLY之正則)', function () {
        //spec: 設計報告§8.4 R-PW-ONLY, 命中數須為0; 本檔自身含此正則字面, 故排除自身
        let re = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/
        let files = allScripts()
        assert(files.length > 20, `掃描檔數過少(${files.length}), 範圍可能壞了`) //防空集合: 已知有20餘個測試與src檔
        let hits = []
        for (let f of files) {
            let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
            lines.forEach((ln, i) => {
                if (re.test(ln)) {
                    hits.push(`${rel(f)}:${i + 1}: ${ln.trim()}`)
                }
            })
        }
        assert.deepStrictEqual(hits, [])
    })

    it('R07-1b 防空集合: 正則抓得到已知正例', function () {
        //正反例以變數組出(本檔之原始碼不含可被全庫盤點指令命中之字面)
        let re = /(from\s+|import\(\s*|require\(\s*)['"`]playwright(-core)?['"`/]/
        let q = '\''
        let d = '"'
        let pw = 'play' + 'wright'
        for (let s of [
            `import { chromium } from ${q}${pw}${q}`,
            `import { chromium } from ${d}${pw}-core${d}`,
            `let { chromium } = await import(${q}${pw}${q})`,
            `const x = require(${q}${pw}-core/lib/x${q})`,
        ]) {
            assert(re.test(s), s)
        }
        for (let s of [
            `import wpw from ${q}w-${pw}${q}`,
            `let wpw = (await import(${q}w-${pw}${q})).default`,
        ]) {
            assert(!re.test(s), s)
        }
    })

    it('R07-2 package.json不宣告playwright/playwright-core, 且以devDependencies宣告w-playwright', function () {
        //spec: 任務〈本輪範圍〉1: 移除playwright/playwright-core, 加入w-playwright(^1.0.1, dev)
        let pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
        for (let k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            for (let name of ['playwright', 'playwright-core']) {
                assert(!(pkg[k] && name in pkg[k]), `${k}.${name}`)
            }
        }
        assert.strictEqual(pkg.devDependencies['w-playwright'], '^1.0.1')
        assert(!(pkg.dependencies && 'w-playwright' in pkg.dependencies), 'w-playwright僅為dev(src不啟動瀏覽器)')
    })

    it('R07-3 啟動點全集: wpw.launchChromium/launchChromiumPersistent只出現在test/tools/helper.mjs一處, src與toolg無', function () {
        //spec: R-PW-WIRING之啟動點全集(rg "wpw\.(launchChromium|launchChromiumPersistent)\(" )與接線測試逐點對照; 本套件之啟動點收斂為helper之launchBrowser
        let re = /\bwpw\s*\.\s*(launchChromium|launchChromiumPersistent)\s*\(/
        let hits = []
        for (let f of allScripts()) {
            let lines = fs.readFileSync(f, 'utf8').split(/\r?\n/)
            lines.forEach((ln, i) => {
                if (re.test(ln)) {
                    hits.push(`${rel(f)}:${i + 1}`)
                }
            })
        }
        assert.strictEqual(hits.length, 1, hits.join(', '))
        assert(hits[0].startsWith('test/tools/helper.mjs:'), hits[0])
    })

    it('R07-4 呼叫launchBrowser之測試檔全集為5個, 每檔至多呼叫一次(同檔共用瀏覽器, before起/after關)', function () {
        //spec: 設計報告§5.2 會啟動真Chrome之測試檔每檔最多啟動一次
        let users = {}
        for (let f of allScripts()) {
            let r = rel(f)
            if (!r.startsWith('test/') || r.startsWith('test/tools/')) {
                continue
            }
            let txt = fs.readFileSync(f, 'utf8')
            let n = (txt.match(/\blaunchBrowser\s*\(/g) || []).length
            if (n > 0) {
                users[r] = n
            }
        }
        let names = Object.keys(users).filter((r) => r !== 'test/unit-pwWiring.test.mjs').sort()
        assert.deepStrictEqual(names, [
            'test/unit-ckPic.test.mjs',
            'test/unit-compare.test.mjs',
            'test/unit-mousekey.test.mjs',
            'test/unit-runScp.test.mjs',
            'test/unit-waitPics.test.mjs',
        ])
        for (let r of names) {
            assert.strictEqual(users[r], 1, `${r}呼叫launchBrowser ${users[r]}次`)
        }
    })

})
