import assert from 'assert'
import path from 'path'
import fs from 'fs'
import { mock } from 'node:test'
import mk from '../src/mousekey.mjs'
import runScp from '../src/runScp.mjs'
import { testDir } from './tools/helper.mjs'
import { makeRecorder, flush } from './tools/traceRecorder.mjs'

//runScp之步驟、步間延時、重複與opt.onTrace: 滑鼠(mk.mouseClick)以測試替身記錄, 腳本解析與步驟排程走真實實作;
//以onTrace事件(而非固定延時)同步, 延遲長短(腳本之delay)為規格者以假時鐘驗證; 不需桌面與執行檔
describe('runScp - onTrace', function () {
    this.timeout(30000)

    let dir = path.join(testDir, '_tmp', 'runScpTrace')
    let orig = { mouseClick: mk.mouseClick }
    let clicks = []
    let failAt = 0 //第幾次點擊(從1起)拋錯, 0為不拋
    let seq = 0

    //寫腳本檔, 回傳路徑
    let writeScript = (obj) => {
        seq++
        let fp = path.join(dir, `script${seq}.json`)
        fs.writeFileSync(fp, JSON.stringify(obj))
        return fp
    }

    before(function () {
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(dir, { recursive: true })
        mk.mouseClick = async (x, y) => {
            clicks.push([x, y])
            if (failAt > 0 && clicks.length === failAt) {
                throw new Error('click failed')
            }
        }
    })

    after(function () {
        mk.mouseClick = orig.mouseClick
        mock.timers.reset()
        fs.rmSync(dir, { recursive: true, force: true })
        try {
            fs.rmdirSync(path.join(testDir, '_tmp'))
        }
        catch { /* 尚有其他測試之暫存時非空, 略過 */ }
    })

    beforeEach(function () {
        clicks = []
        failAt = 0
    })

    it('無延時之兩步驟: start -> step -> step -> repeat -> finish, 依序點擊座標', async function () {
        let rec = makeRecorder()
        await runScp(writeScript({ repeat: 1, steps: [{ x: 10, y: 20 }, { x: 30, y: 40 }] }), { onTrace: rec.onTrace })

        //spec: 依腳本步驟順序點擊座標, 全部執行完畢才結束
        assert.deepStrictEqual(rec.types(), ['start', 'step', 'step', 'repeat', 'finish'])
        assert.deepStrictEqual({ ...rec.events[0] }, { type: 'start', nSp: 1 })
        assert.deepStrictEqual({ ...rec.events[1] }, { type: 'step', sp: 1, rp: 1, step: 1, x: 10, y: 20 })
        assert.deepStrictEqual({ ...rec.events[2] }, { type: 'step', sp: 1, rp: 1, step: 2, x: 30, y: 40 })
        assert.deepStrictEqual({ ...rec.events[3] }, { type: 'repeat', sp: 1, rp: 1 })
        assert.deepStrictEqual(clicks, [[10, 20], [30, 40]])
    })

    it('步間延時: 點擊後stepWait(ms), 假時鐘推進ms-1毫秒仍不點擊下一步, 再推進1毫秒才點擊', async function () {
        let rec = makeRecorder()
        let fp = writeScript({ repeat: 1, steps: [{ x: 1, y: 2, delay: 3000 }, { x: 3, y: 4 }] })

        mock.timers.enable({ apis: ['setTimeout'] })
        try {
            let pm = runScp(fp, { onTrace: rec.onTrace })
            await rec.wait((e) => e.type === 'stepWait')
            await flush() //stepWait事件後同步排入delay計時器, 讓出一次確保已排入

            //spec: 腳本步驟之delay為點擊後等待毫秒數, 等滿才執行下一步
            assert.deepStrictEqual({ ...rec.events.find((e) => e.type === 'stepWait') }, { type: 'stepWait', sp: 1, rp: 1, step: 1, ms: 3000 })
            mock.timers.tick(2999)
            await flush()
            assert.strictEqual(rec.events.filter((e) => e.type === 'step').length, 1, '延時未滿不得執行下一步')
            assert.deepStrictEqual(clicks, [[1, 2]])

            mock.timers.tick(1)
            await pm
            assert.deepStrictEqual(clicks, [[1, 2], [3, 4]])
            assert.deepStrictEqual(rec.types(), ['start', 'step', 'stepWait', 'step', 'repeat', 'finish'])
        }
        finally {
            mock.timers.reset()
        }
    })

    it('重複與重複延時: 每次重複完成後repeatWait(ms)(含最後一次), 假時鐘推進滿才進入下一次重複', async function () {
        let rec = makeRecorder()
        let fp = writeScript({ repeat: 2, delay: 4000, steps: [{ x: 5, y: 6 }] })

        mock.timers.enable({ apis: ['setTimeout'] })
        try {
            let pm = runScp(fp, { onTrace: rec.onTrace })
            await rec.wait((e) => e.type === 'repeatWait')
            await flush()
            assert.deepStrictEqual({ ...rec.events.find((e) => e.type === 'repeatWait') }, { type: 'repeatWait', sp: 1, rp: 1, ms: 4000 })

            mock.timers.tick(3999)
            await flush()
            assert.strictEqual(rec.events.filter((e) => e.type === 'repeat').length, 0, '重複延時未滿不得完成該次重複')
            assert.deepStrictEqual(clicks, [[5, 6]])

            mock.timers.tick(1)
            await rec.wait((e) => e.type === 'repeatWait', 0, 2)
            await flush()
            mock.timers.tick(4000)
            await pm

            assert.deepStrictEqual(rec.types(), ['start', 'step', 'repeatWait', 'repeat', 'step', 'repeatWait', 'repeat', 'finish'])
            assert.deepStrictEqual(rec.events.filter((e) => e.type === 'step').map((e) => e.rp), [1, 2])
            assert.deepStrictEqual(clicks, [[5, 6], [5, 6]])
        }
        finally {
            mock.timers.reset()
        }
    })

    it('多個腳本物件: sp依序從1起算, 各自之repeat獨立', async function () {
        let rec = makeRecorder()
        await runScp(writeScript([{ steps: [{ x: 1, y: 1 }] }, { repeat: 2, steps: [{ x: 2, y: 2 }] }]), { onTrace: rec.onTrace })

        assert.deepStrictEqual({ ...rec.events[0] }, { type: 'start', nSp: 2 })
        assert.deepStrictEqual(rec.events.filter((e) => e.type === 'step').map((e) => [e.sp, e.rp, e.step]), [[1, 1, 1], [2, 1, 1], [2, 2, 1]])
        assert.deepStrictEqual(clicks, [[1, 1], [2, 2], [2, 2]])
    })

    it('腳本無內容: 空陣列只發empty不執行; 步驟為空只發start與finish', async function () {
        let rec = makeRecorder()
        await runScp(writeScript([]), { onTrace: rec.onTrace })
        assert.deepStrictEqual(rec.types(), ['empty'])
        assert.deepStrictEqual(clicks, [])

        let rec2 = makeRecorder()
        await runScp(writeScript({ steps: [] }), { onTrace: rec2.onTrace })
        assert.deepStrictEqual(rec2.types(), ['start', 'finish'])
        assert.deepStrictEqual(clicks, [])
    })

    it('座標無效(x或y非整數): 拋錯, 先發error事件, 不點擊', async function () {
        let rec = makeRecorder()
        await assert.rejects(() => runScp(writeScript({ steps: [{ x: 'a', y: 1 }] }), { onTrace: rec.onTrace }), /invalid x\[a\]/)
        assert.deepStrictEqual(rec.types(), ['start', 'error'])
        assert.deepStrictEqual({ ...rec.events[1] }, { type: 'error', sp: 1, rp: 1, step: 1 })

        let rec2 = makeRecorder()
        await assert.rejects(() => runScp(writeScript({ steps: [{ x: 1, y: 1.5 }] }), { onTrace: rec2.onTrace }), /invalid y\[1\.5\]/)
        assert.deepStrictEqual(rec2.types(), ['start', 'error'])
        assert.deepStrictEqual(clicks, [])
    })

    it('點擊拋錯: 原樣向外拋出, 先發error事件(帶出錯之步驟), 不發finish', async function () {
        failAt = 2
        let rec = makeRecorder()
        await assert.rejects(() => runScp(writeScript({ steps: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] }), { onTrace: rec.onTrace }), /click failed/)

        assert.deepStrictEqual(rec.types(), ['start', 'step', 'step', 'error'])
        assert.deepStrictEqual({ ...rec.events[3] }, { type: 'error', sp: 1, rp: 1, step: 2 })
        assert.deepStrictEqual(clicks, [[1, 1], [2, 2]], '出錯後不再執行後續步驟')
    })

    it('無限重複(repeat<0): rp持續累計直到步驟拋錯才結束', async function () {
        failAt = 3
        let rec = makeRecorder()
        await assert.rejects(() => runScp(writeScript({ repeat: -1, steps: [{ x: 7, y: 8 }] }), { onTrace: rec.onTrace }), /click failed/)

        assert.deepStrictEqual(rec.types(), ['start', 'step', 'repeat', 'step', 'repeat', 'step', 'error'])
        assert.deepStrictEqual(rec.events.filter((e) => e.type === 'step').map((e) => e.rp), [1, 2, 3])
        assert.deepStrictEqual({ ...rec.events[6] }, { type: 'error', sp: 1, rp: 3, step: 1 })
    })

    describe('未傳回調時行為不變(五種回調)', function () {
        let kinds = {
            '未傳': () => undefined,
            '紀錄器': () => makeRecorder().onTrace,
            '拋錯': () => () => {
                throw new Error('onTrace throws')
            },
            '回傳rejection': () => () => Promise.reject(new Error('onTrace rejects')),
            '非函數': () => 'not a function',
        }
        let script = { repeat: 2, delay: 1, steps: [{ x: 1, y: 2, delay: 1 }, { x: 3, y: 4 }] }

        it('五種回調之結果與點擊皆相同, 且無未處理之rejection', async function () {
            let unhandled = []
            let onUnhandled = (reason) => unhandled.push(reason)
            process.on('unhandledRejection', onUnhandled)
            let outs = {}
            try {
                for (let [k, mkTrace] of Object.entries(kinds)) {
                    clicks = []
                    let tr = mkTrace()
                    let r = await runScp(writeScript(script), tr === undefined ? {} : { onTrace: tr })
                    outs[k] = { r: r === undefined ? 'undefined' : r, clicks: JSON.stringify(clicks) }
                }
                await flush()
                await flush()
            }
            finally {
                process.off('unhandledRejection', onUnhandled)
            }

            //spec: 未傳onTrace時行為同無此功能; 回調拋錯/回傳rejection/非函數皆不影響結果
            let base = outs['未傳']
            assert.deepStrictEqual(base, { r: 'undefined', clicks: '[[1,2],[3,4],[1,2],[3,4]]' })
            for (let [k, o] of Object.entries(outs)) {
                assert.deepStrictEqual(o, base, `回調為${k}時結果須同未傳`)
            }
            assert.deepStrictEqual(unhandled, [], '不得有未處理之rejection')

            //出錯路徑亦同: 回調拋錯時仍向外拋出原錯誤(而非回調之錯誤)
            clicks = []
            failAt = 1
            let onTraceThrows = () => {
                throw new Error('onTrace throws')
            }
            await assert.rejects(() => runScp(writeScript(script), { onTrace: onTraceThrows }), /click failed/)
        })

        it('事件為凍結物件、回調不帶接收者、type固定且其餘欄位為原始值', async function () {
            let thisSeen = []
            let evs = []
            await runScp(writeScript(script), {
                onTrace: function (e) {
                    thisSeen.push(this)
                    evs.push(e)
                },
            })

            assert.ok(evs.length > 0)
            assert.ok(thisSeen.every((t) => t === undefined), '回調之this須為undefined')
            for (let e of evs) {
                assert.ok(Object.isFrozen(e), `${e.type}事件須凍結`)
                assert.ok(['empty', 'start', 'step', 'stepWait', 'repeatWait', 'repeat', 'error', 'finish'].includes(e.type), `未列舉之type: ${e.type}`)
                for (let [k, v] of Object.entries(e)) {
                    if (k !== 'type') {
                        assert.ok(['number', 'string', 'boolean'].includes(typeof v) || v === null, `${e.type}.${k}須為原始值`)
                    }
                }
            }
        })
    })
})
