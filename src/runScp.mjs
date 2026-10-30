import fs from 'fs'
import JSON5 from 'json5'
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isobj from 'wsemi/src/isobj.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import isint from 'wsemi/src/isint.mjs'
import cint from 'wsemi/src/cint.mjs'
import delay from 'wsemi/src/delay.mjs'
import pmSeries from 'wsemi/src/pmSeries.mjs'
import getTrace from 'wsemi/src/getTrace.mjs'
import mk from './mousekey.mjs'


let loadScript = async (fp) => {

    let j = fs.readFileSync(fp, 'utf8')
    let data = JSON5.parse(j)

    if (isobj(data)) {
        data = [data]
    }

    if (!isearr(data)) {
        return []
    }

    return data
}

let runSps = async (sps, trace) => {

    let n = size(sps)
    for (let ii = 0; ii < sps.length; ii++) {

        let sp = sps[ii]
        // console.log('sp', sp)

        let repeat = get(sp, 'repeat', 1)
        if (!isint(repeat)) {
            repeat = 1
        }
        repeat = cint(repeat)

        let inf = repeat < 0

        let steps = get(sp, 'steps', [])
        if (!isarr(steps)) {
            steps = []
        }

        if (steps.length === 0) {
            continue
        }

        let i = 0
        while (inf || i < repeat) {

            //執行steps
            let j = 0
            let nj = size(steps)
            await pmSeries(steps, async(st) => {

                try {

                    let x = get(st, 'x')
                    if (!isint(x)) {
                        throw new Error(`invalid x[${x}]`)
                    }

                    let y = get(st, 'y')
                    if (!isint(y)) {
                        throw new Error(`invalid y[${y}]`)
                    }

                    let timeDelaySt = get(st, 'delay')
                    if (!isint(timeDelaySt)) {
                        timeDelaySt = 0
                    }
                    timeDelaySt = cint(timeDelaySt)

                    console.log(`sp(${ii + 1}/${n}) rp(${i + 1}/${inf ? 'inf' : repeat}) step(${j + 1}/${nj}) clicking at (${x}, ${y})`)
                    if (trace) {
                        trace('step', { sp: ii + 1, rp: i + 1, step: j + 1, x, y })
                    }
                    await mk.mouseClick(x, y)

                    //執行delay
                    if (timeDelaySt > 0) {
                        console.log(`sp(${ii + 1}/${n}) rp(${i + 1}/${inf ? 'inf' : repeat}) step(${j + 1}/${nj}) waiting ${timeDelaySt}ms`)
                        if (trace) {
                            trace('stepWait', { sp: ii + 1, rp: i + 1, step: j + 1, ms: timeDelaySt })
                        }
                        await delay(timeDelaySt)
                    }

                }
                catch (err) {
                    if (trace) {
                        trace('error', { sp: ii + 1, rp: i + 1, step: j + 1 })
                    }
                    throw err
                }

                j++
            })

            let timeDelay = get(sp, 'delay', 0)
            if (!isp0int(timeDelay)) {
                timeDelay = 0
            }

            //執行delay
            if (timeDelay > 0) {
                console.log(`sp(${ii + 1}/${n}) rp(${i + 1}/${inf ? 'inf' : repeat}) waiting ${timeDelay}ms`)
                if (trace) {
                    trace('repeatWait', { sp: ii + 1, rp: i + 1, ms: timeDelay })
                }
                await delay(timeDelay)
            }

            if (trace) {
                trace('repeat', { sp: ii + 1, rp: i + 1 })
            }

            i++

        }

    }
}

/**
 * 讀取腳本檔並依序執行滑鼠點擊步驟
 *
 * 腳本檔為JSON5，內容為單一腳本物件或腳本物件陣列，腳本物件含repeat(重複次數，整數，負數為無限重複，預設1)、delay(每次重複完成後等待毫秒數，非負整數，預設0)與steps(步驟陣列)，步驟含x、y(螢幕座標，須為整數，否則拋錯)與delay(點擊後等待毫秒數，整數，預設0)
 *
 * @param {String} inputFile 輸入腳本檔路徑
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Function} [opt.onTrace=null] 輸入觀察回調函數，於內部事件發生當下同步呼叫，傳入一個凍結之事件物件{ type, ... }，供測試以事件(而非等待時間)同步與診斷；sp為腳本物件序號、rp為重複次序、step為步驟序號，皆從1起算；type為'empty'時為腳本無內容而即將返回，'start'時為即將開始執行(含nSp為腳本物件數量)，'step'時為即將點擊(含sp、rp、step、x、y)，'stepWait'時為點擊後即將等待步驟延遲(含sp、rp、step、ms，僅ms大於0時)，'repeatWait'時為該次重複之步驟皆完成而即將等待重複延遲(含sp、rp、ms，僅ms大於0時)，'repeat'時為該次重複(含其延遲)完成(含sp、rp)，'error'時為步驟拋錯而即將向外拋出(含sp、rp、step)，'finish'時為全部執行完畢而即將返回；回調不帶接收者呼叫，其拋錯與回傳值皆忽略，不影響執行與結果，預設null
 * @returns {Promise} 回傳Promise，resolve代表執行完畢(repeat為負數時永不resolve)
 */
let runScp = async (inputFile, opt = {}) => {

    //trace, 觀察回調(opt.onTrace), 未給時為null
    let trace = getTrace(opt)

    let sps = await loadScript(inputFile)

    if (!isearr(sps)) {
        console.log('no content found or empty script.')
        if (trace) {
            trace('empty', {})
        }
        return
    }

    console.log(`running...(Press Ctrl+C to abort.)`)
    if (trace) {
        trace('start', { nSp: size(sps) })
    }
    await runSps(sps, trace)

    console.log('finish')
    if (trace) {
        trace('finish', {})
    }
}


export default runScp
