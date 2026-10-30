import assert from 'assert'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import { mock } from 'node:test'
import sc from '../src/screen.mjs'
import mk from '../src/mousekey.mjs'
import waitPics from '../src/waitPics.mjs'
import { testDir, imgsDir, ensureImages } from './tools/helper.mjs'
import { makeRecorder, flush } from './tools/traceRecorder.mjs'

//waitPics之輪詢行為與opt.onTrace: 螢幕截圖(sc.screenSave)與滑鼠(mk.mouseClick)以測試替身供給/記錄, 其餘(ckPic、影像比對)走真實實作;
//以onTrace事件(而非固定延時)同步, 等待間隔(opt.timeDelay)為規格者以假時鐘驗證; 不需桌面與執行檔
describe('waitPics - onTrace', function () {
    this.timeout(60000)

    let dir = path.join(testDir, '_tmp', 'waitPicsTrace')
    let picDir = path.join(dir, 'pic')
    let tmpDir = path.join(dir, 'tmp')
    let orig = { screenSave: sc.screenSave, mouseClick: mk.mouseClick }
    let screenPresent = null //含目標圖(藍底白十字)於(120,70)
    let screenAbsent = null //不含目標圖, 含另一張不同之圖
    let frames = []
    let nShot = 0
    let clicks = []

    //以ckPic實際比對之臨時opt
    let optBase = () => ({ fdTar: picDir, fdTmp: tmpDir, x: 0, y: 0, width: 400, height: 240, threshold: 0.9, numMax: 3, timeDelay: 1 })

    before(async function () {
        await ensureImages()
        fs.rmSync(dir, { recursive: true, force: true })
        fs.mkdirSync(picDir, { recursive: true })
        fs.mkdirSync(tmpDir, { recursive: true })
        fs.copyFileSync(path.join(imgsDir, 'target.png'), path.join(picDir, 'target.png'))
        fs.copyFileSync(path.join(imgsDir, 'btn_c.png'), path.join(picDir, 'other.png'))

        let bg = () => sharp({ create: { width: 400, height: 240, channels: 3, background: { r: 224, g: 224, b: 224 } } })
        screenPresent = await bg().composite([{ input: path.join(imgsDir, 'target.png'), left: 120, top: 70 }]).png().toBuffer()
        screenAbsent = await bg().composite([{ input: path.join(imgsDir, 'btn_c.png'), left: 120, top: 70 }]).png().toBuffer()

        //測試替身: 依序供給frames(用盡則重複最後一張), 點擊只記錄
        sc.screenSave = async (x, y, width, height, fp) => {
            let img = frames[Math.min(nShot, frames.length - 1)]
            nShot++
            fs.writeFileSync(fp, img)
            return img
        }
        mk.mouseClick = async (x, y) => {
            clicks.push([x, y])
        }
    })

    after(function () {
        sc.screenSave = orig.screenSave
        mk.mouseClick = orig.mouseClick
        mock.timers.reset()
        fs.rmSync(dir, { recursive: true, force: true })
        try {
            fs.rmdirSync(path.join(testDir, '_tmp'))
        }
        catch { /* 尚有其他測試之暫存時非空, 略過 */ }
    })

    beforeEach(function () {
        frames = []
        nShot = 0
        clicks = []
    })

    it('首輪即辨識成功: round -> check(ok) -> found, 不等待, 點擊目標圖中心', async function () {
        frames = [screenPresent]
        let rec = makeRecorder()
        let r = await waitPics('target', { ...optBase(), onTrace: rec.onTrace })

        //spec: 一張圖成功即可結束(回傳true), 成功即不再等待
        assert.strictEqual(r, true)
        assert.deepStrictEqual(rec.types(), ['round', 'check', 'found'])
        assert.deepStrictEqual({ ...rec.events[0] }, { type: 'round', i: 1, numMax: 3 })
        assert.deepStrictEqual({ ...rec.events[1] }, { type: 'check', i: 1, name: 'target', ok: true })
        assert.deepStrictEqual({ ...rec.events[2] }, { type: 'found', i: 1, name: 'target' })
        assert.strictEqual(nShot, 1)
        assert.deepStrictEqual(clicks, [[160, 110]], '點擊目標圖中心(120+80/2, 70+80/2)')
    })

    it('withClick=false: 辨識成功但不點擊', async function () {
        frames = [screenPresent]
        let rec = makeRecorder()
        let r = await waitPics('target', { ...optBase(), withClick: false, onTrace: rec.onTrace })

        assert.strictEqual(r, true)
        assert.deepStrictEqual(rec.types(), ['round', 'check', 'found'])
        assert.deepStrictEqual(clicks, [])
    })

    it('首輪失敗次輪成功: 失敗後先wait(含timeDelay)再進入下一輪, 失敗輪不點擊', async function () {
        frames = [screenAbsent, screenPresent]
        let rec = makeRecorder()
        let r = await waitPics('target', { ...optBase(), timeDelay: 7, onTrace: rec.onTrace })

        //spec: 全部失敗則等待timeDelay後進入下一輪, 任一輪成功即結束
        assert.strictEqual(r, true)
        assert.deepStrictEqual(rec.types(), ['round', 'check', 'wait', 'round', 'check', 'found'])
        assert.deepStrictEqual({ ...rec.events[1] }, { type: 'check', i: 1, name: 'target', ok: false })
        assert.deepStrictEqual({ ...rec.events[2] }, { type: 'wait', i: 1, timeDelay: 7 })
        assert.deepStrictEqual({ ...rec.events[3] }, { type: 'round', i: 2, numMax: 3 })
        assert.deepStrictEqual({ ...rec.events[5] }, { type: 'found', i: 2, name: 'target' })
        assert.strictEqual(nShot, 2)
        assert.deepStrictEqual(clicks, [[160, 110]], '只在成功之輪點擊一次')
    })

    it('全部輪數皆失敗: 每輪(含最後一輪)失敗後皆wait, 末了giveUp並回傳false, 不點擊', async function () {
        frames = [screenAbsent]
        let rec = makeRecorder()
        let r = await waitPics('target', { ...optBase(), numMax: 3, onTrace: rec.onTrace })

        //spec: 若都失敗則須於嘗試完全部次數才能結束(回傳false)
        assert.strictEqual(r, false)
        assert.deepStrictEqual(rec.types(), ['round', 'check', 'wait', 'round', 'check', 'wait', 'round', 'check', 'wait', 'giveUp'])
        assert.deepStrictEqual(rec.events.filter((e) => e.type === 'round').map((e) => e.i), [1, 2, 3])
        assert.deepStrictEqual({ ...rec.events[9] }, { type: 'giveUp', numMax: 3 })
        assert.strictEqual(nShot, 3)
        assert.deepStrictEqual(clicks, [])
    })

    it('多張圖: 同輪依序辨識, 任一成功即結束並回報成功之圖名, 之後的圖不再辨識', async function () {
        frames = [screenPresent]
        let rec = makeRecorder()
        let r = await waitPics(['other', 'target'], { ...optBase(), onTrace: rec.onTrace })

        assert.strictEqual(r, true)
        assert.deepStrictEqual(rec.types(), ['round', 'check', 'check', 'found'])
        assert.deepStrictEqual({ ...rec.events[1] }, { type: 'check', i: 1, name: 'other', ok: false })
        assert.deepStrictEqual({ ...rec.events[2] }, { type: 'check', i: 1, name: 'target', ok: true })
        assert.deepStrictEqual({ ...rec.events[3] }, { type: 'found', i: 1, name: 'target' })

        //成功之圖排前面時, 後面的圖不再辨識
        frames = [screenPresent]
        nShot = 0
        let rec2 = makeRecorder()
        let r2 = await waitPics(['target', 'other'], { ...optBase(), withClick: false, onTrace: rec2.onTrace })
        assert.strictEqual(r2, true)
        assert.deepStrictEqual(rec2.types(), ['round', 'check', 'found'])
        assert.strictEqual(nShot, 1)
    })

    it('ckPic拋錯(資料夾或圖檔不存在)時原樣向外拋出, 並先發error事件', async function () {
        frames = [screenPresent]

        //fdTar不是資料夾
        let rec = makeRecorder()
        await assert.rejects(() => waitPics('target', { ...optBase(), fdTar: path.join(dir, 'nofolder'), onTrace: rec.onTrace }), /is not a folder/)
        assert.deepStrictEqual(rec.types(), ['round', 'error'])
        assert.deepStrictEqual({ ...rec.events[1] }, { type: 'error', i: 1, name: 'target' })

        //圖檔不存在
        let rec2 = makeRecorder()
        await assert.rejects(() => waitPics('missing', { ...optBase(), onTrace: rec2.onTrace }), /is not a file/)
        assert.deepStrictEqual(rec2.types(), ['round', 'error'])
        assert.deepStrictEqual({ ...rec2.events[1] }, { type: 'error', i: 1, name: 'missing' })
        assert.deepStrictEqual(clicks, [])
    })

    it('等待間隔為opt.timeDelay: 假時鐘推進timeDelay-1ms仍未進入下一輪, 再推進1ms才進入', async function () {
        frames = [screenAbsent, screenPresent]
        let rec = makeRecorder()

        //確認影像比對(opencv)已載入, 假時鐘期間不得首次載入
        await waitPics('target', { ...optBase(), numMax: 1, withClick: false })
        nShot = 0

        mock.timers.enable({ apis: ['setTimeout'] })
        try {
            let pm = waitPics('target', { ...optBase(), timeDelay: 5000, withClick: false, onTrace: rec.onTrace })
            await rec.wait((e) => e.type === 'wait')
            await flush() //wait事件後同步排入delay計時器, 讓出一次確保已排入

            mock.timers.tick(4999)
            await flush()
            assert.strictEqual(rec.events.filter((e) => e.type === 'round').length, 1, 'timeDelay未滿不得進入下一輪')

            mock.timers.tick(1)
            await rec.wait((e) => e.type === 'round', 0, 2)
            assert.strictEqual(await pm, true)
            assert.deepStrictEqual(rec.types(), ['round', 'check', 'wait', 'round', 'check', 'found'])
        }
        finally {
            mock.timers.reset()
        }
    })

    describe('未傳回調時行為不變(五種回調)', function () {
        let thisSeen = []
        let kinds = {
            '未傳': () => undefined,
            '紀錄器': () => makeRecorder().onTrace,
            '拋錯': () => () => {
                throw new Error('onTrace throws')
            },
            '回傳rejection': () => () => Promise.reject(new Error('onTrace rejects')),
            '非函數': () => 'not a function',
        }

        it('五種回調之結果、點擊與輪次皆相同, 且無未處理之rejection', async function () {
            let unhandled = []
            let onUnhandled = (reason) => unhandled.push(reason)
            process.on('unhandledRejection', onUnhandled)
            let outs = {}
            try {
                for (let [k, mkTrace] of Object.entries(kinds)) {
                    frames = [screenAbsent, screenPresent]
                    nShot = 0
                    clicks = []
                    let opt = optBase()
                    let tr = mkTrace()
                    if (tr !== undefined) {
                        opt.onTrace = tr
                    }
                    let r = await waitPics('target', opt)
                    outs[k] = { r, nShot, clicks: JSON.stringify(clicks) }
                }
                await flush()
                await flush()
            }
            finally {
                process.off('unhandledRejection', onUnhandled)
            }

            //spec: 未傳onTrace時行為同無此功能; 回調拋錯/回傳rejection/非函數皆不影響結果
            let base = outs['未傳']
            assert.deepStrictEqual(base, { r: true, nShot: 2, clicks: '[[160,110]]' })
            for (let [k, o] of Object.entries(outs)) {
                assert.deepStrictEqual(o, base, `回調為${k}時結果須同未傳`)
            }
            assert.deepStrictEqual(unhandled, [], '不得有未處理之rejection')
        })

        it('事件為凍結物件、回調不帶接收者、type固定且其餘欄位為原始值', async function () {
            frames = [screenAbsent, screenPresent]
            let evs = []
            await waitPics('target', {
                ...optBase(),
                onTrace: function (e) {
                    thisSeen.push(this)
                    evs.push(e)
                },
            })

            assert.ok(evs.length > 0)
            assert.ok(thisSeen.every((t) => t === undefined), '回調之this須為undefined')
            for (let e of evs) {
                assert.ok(Object.isFrozen(e), `${e.type}事件須凍結`)
                assert.ok(['round', 'check', 'wait', 'found', 'giveUp', 'error'].includes(e.type), `未列舉之type: ${e.type}`)
                for (let [k, v] of Object.entries(e)) {
                    if (k !== 'type') {
                        assert.ok(['number', 'string', 'boolean'].includes(typeof v) || v === null, `${e.type}.${k}須為原始值`)
                    }
                }
            }
        })
    })
})
