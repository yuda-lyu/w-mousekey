import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { repoDir, testDir, toolsDir } from './tools/binEnv.mjs'

//規格(規則R06, 任務書第184項): 負載執行器(test/tools/loadTrial.mjs, loadPreload.mjs)為wsemi統一版, 兩檔同時整份複製自node_modules/wsemi/test/tools/, 不各自修改;
//  環境變數統一WSEMI_LT_*(原MKEY_LT_*已廢); 不退出之失敗鍵為(mocha did not exit); --exit-grace即--hang-sec; --run-max預設900秒; --guard失敗離開碼3
//以真實的 loadTrial 起真實的 mocha 子行程(固定小夾具, 不需桌面), 不把接縫 mock 掉
describe('負載執行器: wsemi統一版', function () {
    this.timeout(120000)

    let fnTrial = path.join(toolsDir, 'loadTrial.mjs')
    let fnPreload = path.join(toolsDir, 'loadPreload.mjs')
    let dirWsemi = path.join(repoDir, 'node_modules', 'wsemi', 'test', 'tools')
    let fdt = path.join(testDir, '_tmp', 'loadTrial')

    //子行程環境: 清除NODE_OPTIONS與WSEMI_LT_*前綴, 以免外層若亦在負載試驗下而干擾內層之量測與環境變數斷言
    function cleanEnv() {
        let env = { ...process.env }
        delete env.NODE_OPTIONS
        for (let k of Object.keys(env)) {
            if (k.startsWith('WSEMI_LT_')) {
                delete env[k]
            }
        }
        return env
    }

    //夾具: 寫成mocha測試檔(test/_tmp/loadTrial/<name>.mjs), 其路徑含中文亦可
    function writeFx(name, body) {
        let fn = path.join(fdt, name)
        fs.writeFileSync(fn, body, 'utf8')
        return fn
    }

    //執行loadTrial, 回傳{ r, summary }; summary為<out>/summary.json(未產出時為null)
    function runTrial(out, loadArgs, mochaFiles) {
        let dirOut = path.join(fdt, out)
        let r = spawnSync(process.execPath, [fnTrial, '--out', dirOut, ...loadArgs, '--', '--no-parallel', ...mochaFiles, '--timeout', '20000'], {
            cwd: repoDir,
            env: cleanEnv(),
            encoding: 'utf8',
            windowsHide: true,
            timeout: 100000,
        })
        let fnSum = path.join(dirOut, 'summary.json')
        let summary = fs.existsSync(fnSum) ? JSON.parse(fs.readFileSync(fnSum, 'utf8')) : null
        return { r, summary }
    }

    before(function () {
        fs.rmSync(fdt, { recursive: true, force: true })
        fs.mkdirSync(fdt, { recursive: true })
    })

    after(function () {
        fs.rmSync(fdt, { recursive: true, force: true })
    })

    it('R06-1 兩檔與node_modules/wsemi/test/tools/之版本位元組全等(不各自修改; 不符時須同時重新複製兩檔)', function () {
        for (let n of ['loadTrial.mjs', 'loadPreload.mjs']) {
            let a = fs.readFileSync(path.join(toolsDir, n))
            let b = fs.readFileSync(path.join(dirWsemi, n))
            assert.ok(a.equals(b), `${n} 與 node_modules/wsemi/test/tools/${n} 不一致`)
        }
    })

    it('R06-2 兩檔皆以WSEMI_LT_*為環境變數(PROBE,LAG), 不再有MKEY_LT_', function () {
        let a = fs.readFileSync(fnTrial, 'utf8')
        let b = fs.readFileSync(fnPreload, 'utf8')
        for (let s of [a, b]) {
            assert.ok(!s.includes('MKEY_LT_'))
            assert.ok(s.includes('WSEMI_LT_PROBE'))
            assert.ok(s.includes('WSEMI_LT_LAG'))
        }
    })

    it('R06-3 通過案: 離開碼0, 無失敗鍵, 預設hangSec=30與runMax=900, 子行程取得WSEMI_LT_PROBE與WSEMI_LT_LAG(無MKEY_LT_*)且預載模組已量測', function () {
        let fx = writeFx('pass.mjs', `
import assert from 'assert'
describe('fixture pass', function () {
    it('env', function () {
        assert.ok(process.env.WSEMI_LT_PROBE)
        assert.strictEqual(process.env.WSEMI_LT_LAG, '20:200')
        assert.strictEqual(process.env.MKEY_LT_LAG, undefined)
        assert.strictEqual(process.env.MKEY_LT_PROBE, undefined)
    })
})
`)
        let { r, summary } = runTrial('pass', ['--runs', '1', '--lag', '20:200'], [fx])
        assert.strictEqual(r.status, 0, r.stdout + r.stderr)
        assert.deepStrictEqual(summary.failRate, [])
        assert.strictEqual(summary.runs.length, 1)
        assert.strictEqual(summary.runs[0].passes, 1)
        assert.strictEqual(summary.runs[0].failures, 0)
        assert.strictEqual(summary.runs[0].noExit, false)
        assert.strictEqual(summary.opt.hangSec, 30)
        assert.strictEqual(summary.opt.runMax, 900)
        //預載模組loadPreload.mjs已載入測試行程: 結束時寫出<out>/probe1/probe-<pid>.json(count可為0, 故不以summary.lag.procs判定)
        let probes = fs.readdirSync(path.join(fdt, 'pass', 'probe1')).filter((n) => /^probe-\d+\.json$/.test(n))
        assert.ok(probes.length >= 1, '預載模組未寫出量測(probe)')
    })

    it('R06-4 失敗案: 離開碼1, 失敗鍵為「<檔名> :: <完整標題>」', function () {
        let fx = writeFx('fail.mjs', `
import assert from 'assert'
describe('fixture fail', function () {
    it('boom', function () {
        assert.strictEqual(1, 2)
    })
})
`)
        let { r, summary } = runTrial('fail', ['--runs', '1'], [fx])
        assert.strictEqual(r.status, 1)
        assert.deepStrictEqual(summary.failRate.map((o) => [o.key, o.n, o.of]), [['fail.mjs :: fixture fail boom', 1, 1]])
        assert.strictEqual(summary.runs[0].noExit, false)
    })

    it('R06-5 測完不退出: 失敗鍵為(mocha did not exit)(不再是(mocha did not exit by itself)), noExit為true, --exit-grace即--hang-sec', function () {
        let fx = writeFx('hang.mjs', `
describe('fixture hang', function () {
    it('leaves a live handle', function () {
        setInterval(() => {}, 1000)
    })
})
`)
        let { r, summary } = runTrial('hang', ['--runs', '1', '--exit-grace', '2'], [fx])
        assert.strictEqual(r.status, 1)
        assert.strictEqual(summary.opt.hangSec, 2)
        assert.deepStrictEqual(summary.failRate.map((o) => [o.key, o.n, o.of]), [['(mocha did not exit)', 1, 1]])
        assert.strictEqual(summary.runs[0].noExit, true)
        assert.ok(/did not exit within 2s/.test(summary.runs[0].hung), summary.runs[0].hung)
        assert.strictEqual(summary.runs[0].passes, 1)
        assert.strictEqual(summary.runs[0].failures, 0)
        assert.ok(!r.stdout.includes('did not exit by itself'))
    })

    it('R06-6 --guard: 腳本離開碼非0則不跑任何輪, 離開碼3, summary.guardFailed記錄之', function () {
        let fx = writeFx('pass2.mjs', `
describe('fixture pass2', function () {
    it('ok', function () {})
})
`)
        let guard = writeFx('guard.mjs', `
process.exit(5)
`)
        let { r, summary } = runTrial('guard', ['--runs', '2', '--guard', guard], [fx])
        assert.strictEqual(r.status, 3)
        assert.strictEqual(summary.guardFailed.run, 1)
        assert.strictEqual(summary.guardFailed.code, 5)
        assert.deepStrictEqual(summary.runs, [])
    })

    it('R06-7 --run-max不合法(負數)與未知選項皆拒收, 不產出summary', function () {
        let fx = writeFx('pass3.mjs', `
describe('fixture pass3', function () {
    it('ok', function () {})
})
`)
        let a = runTrial('bad1', ['--runs', '1', '--run-max', '-1'], [fx])
        assert.strictEqual(a.r.status, 1)
        assert.ok(/invalid --run-max/.test(a.r.stdout), a.r.stdout)
        assert.strictEqual(a.summary, null)
        let b = runTrial('bad2', ['--runs', '1', '--exit-grace-x', '1'], [fx])
        assert.strictEqual(b.r.status, 1)
        assert.ok(/unknown option/.test(b.r.stdout), b.r.stdout)
        assert.strictEqual(b.summary, null)
    })

    it('R06-8 --run-max 0(不限)與--burners: 通過案離開碼0, 壓力行程於結束後皆已終止(PID回驗)', function () {
        let fx = writeFx('pass4.mjs', `
describe('fixture pass4', function () {
    it('ok', function () {})
})
`)
        let { r, summary } = runTrial('burn', ['--runs', '1', '--burners', '1', '--burn-max', '60', '--run-max', '0'], [fx])
        assert.strictEqual(r.status, 0, r.stdout + r.stderr)
        assert.strictEqual(summary.opt.runMax, 0)
        assert.strictEqual(summary.burnersAfter.length, 1)
        assert.strictEqual(summary.burnersAfter[0].alive, false)
        let pid = summary.burnersAfter[0].pid
        let alive = true
        try {
            process.kill(pid, 0)
        }
        catch (err) {
            alive = err.code === 'EPERM'
        }
        assert.strictEqual(alive, false, `壓力行程${pid}仍存活`)
    })
})
