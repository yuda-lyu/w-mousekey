import assert from 'assert'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { SCREEN_NAME, toolsDir, tmpRoot, makeFake, makeSandbox, removeDir, cacheDirOf, listDir, sha256 } from './tools/binFake.mjs'

//規格(任務書範圍2.3/3): 並行之兩次首次使用(跨行程)不得互相毀損
//以子行程模擬, 以signalDir/go檔精確控制交錯順序(於「暫存檔已寫入並驗證、尚未更名」之瞬間暫停)
describe('binEnsure: 並行首次使用(跨行程)', function () {
    this.timeout(60000)

    let fake = makeFake()
    let sandboxes = []
    let sb = () => {
        let s = makeSandbox('binConcurrent')
        s.signalDir = path.join(s.root, 'signal')
        fs.mkdirSync(s.signalDir, { recursive: true })
        sandboxes.push(s)
        return s
    }

    after(function () {
        sandboxes.forEach((s) => removeDir(s.root))
        try {
            fs.rmdirSync(path.join(tmpRoot, 'binConcurrent'))
        }
        catch (err) {
            //ignore
        }
    })

    function runChild(s, id, extra = {}) {
        let cfg = { cacheDir: s.cache, cwd: s.cwd, signalDir: s.signalDir, id, ...extra }
        let child = spawn(process.execPath, [path.join(toolsDir, 'binChild.mjs'), JSON.stringify(cfg)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d) => {
            stdout += d
        })
        child.stderr.on('data', (d) => {
            stderr += d
        })
        let done = new Promise((resolve) => {
            child.on('close', (code) => {
                let result = null
                try {
                    result = JSON.parse(stdout.trim().split('\n').pop())
                }
                catch (err) {
                    //ignore
                }
                resolve({ id, code, stdout, stderr, result })
            })
        })
        return { child, done }
    }

    async function waitFor(fn, ms = 30000) {
        let t0 = Date.now()
        while (!fn()) {
            if (Date.now() - t0 > ms) {
                throw new Error('waitFor timeout')
            }
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
    }

    let specOf = () => fake.manifest.groups.screen.files[SCREEN_NAME]
    let ready = (s, id) => fs.existsSync(path.join(s.signalDir, `ready-${id}`))
    let go = (s) => fs.writeFileSync(path.join(s.signalDir, 'go'), '')

    it('P5 一個行程下載到錯誤內容、另一個行程正確下載且暫停於更名前 -> 錯誤者失敗, 正確者仍成功, 正式檔完好', async function () {
        let s = sb()
        let y = runChild(s, 'good', { pause: true })
        await waitFor(() => ready(s, 'good'))

        //好行程已寫好並驗證完暫存檔, 此時另一行程完整跑完一次失敗之下載(寫暫存檔, 驗證不符, 刪暫存檔)
        let x = runChild(s, 'bad', { corrupt: true })
        let rx = await x.done
        assert.notStrictEqual(rx.code, 0, '錯誤內容之行程應失敗')
        assert.strictEqual(rx.result?.code, 'E_HASH_MISMATCH', rx.stdout + rx.stderr)

        go(s)
        let ry = await y.done
        assert.strictEqual(ry.code, 0, `好行程應成功: ${ry.stdout}${ry.stderr}`)
        assert.strictEqual(ry.result.ok, true)

        let dir = cacheDirOf(s, fake, 'screen')
        assert.strictEqual(sha256(fs.readFileSync(path.join(dir, SCREEN_NAME))), specOf().sha256, '正式檔內容須完好')
        assert.deepStrictEqual(listDir(dir), [SCREEN_NAME], '不得殘留暫存檔')
    })

    it('P5 三個行程同時卡在更名前再一起放行 -> 全部成功, 正式檔完好, 無殘留暫存檔', async function () {
        let s = sb()
        let cs = ['a', 'b', 'c'].map((id) => runChild(s, id, { pause: true }))
        await waitFor(() => ['a', 'b', 'c'].every((id) => ready(s, id)))
        go(s)
        let rs = await Promise.all(cs.map((c) => c.done))
        for (let r of rs) {
            assert.strictEqual(r.code, 0, `${r.id}: ${r.stdout}${r.stderr}`)
        }
        let dir = cacheDirOf(s, fake, 'screen')
        assert.strictEqual(sha256(fs.readFileSync(path.join(dir, SCREEN_NAME))), specOf().sha256)
        assert.deepStrictEqual(listDir(dir), [SCREEN_NAME])
    })

    it('P5 前次行程崩潰留下之暫存檔(.part)不影響下一次下載', async function () {
        let s = sb()
        let dir = cacheDirOf(s, fake, 'screen')
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, `${SCREEN_NAME}.99999.deadbeef.part`), 'half-written')
        let r = await runChild(s, 'next').done
        assert.strictEqual(r.code, 0, r.stdout + r.stderr)
        assert.strictEqual(sha256(fs.readFileSync(path.join(dir, SCREEN_NAME))), specOf().sha256)
    })

})
