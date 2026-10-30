import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isestr from 'wsemi/src/isestr.mjs'
import delay from 'wsemi/src/delay.mjs'
import getTrace from 'wsemi/src/getTrace.mjs'
import ckPic from './ckPic.mjs'


/**
 * 輪詢螢幕直到辨識到指定圖片(withClick時一併點擊)，多張圖時任一張辨識成功即結束
 *
 * 每輪依序以ckPic辨識names內各圖，任一成功即結束並回傳true，皆失敗則等待timeDelay後進入下一輪，嘗試完numMax輪仍皆失敗才回傳false；其餘opt同ckPic(fdTar、fdTmp、x、y、width、height、threshold、modeCompare、withClick、withDrag、dx、dy等)，辨識所需之圖檔或資料夾不存在時ckPic拋錯，錯誤原樣向外拋出
 *
 * @param {String|Array} names 輸入圖檔名稱(不含副檔名，檔案為{fdTar}/{name}.png)字串或字串陣列
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Integer} [opt.numMax=60] 輸入最大輪數，預設60
 * @param {Integer} [opt.timeDelay=1500] 輸入每輪皆失敗後之等待毫秒數，預設1500
 * @param {Function} [opt.onTrace=null] 輸入觀察回調函數，於內部事件發生當下同步呼叫，傳入一個凍結之事件物件{ type, ... }，供測試以事件(而非等待時間)同步與診斷；type為'round'時為即將進行第i輪(含i為輪次從1起算、numMax為最大輪數)，'check'時為ckPic已完成一張圖之辨識(含i、name為圖檔名稱、ok為是否辨識成功)，'wait'時為該輪皆失敗而即將等待(含i、timeDelay為opt.timeDelay之值)，'found'時為辨識成功而即將回傳true(含i、name)，'giveUp'時為全部輪數皆失敗而即將回傳false(含numMax)，'error'時為ckPic拋錯而即將向外拋出(含i、name)；回調不帶接收者呼叫，其拋錯與回傳值皆忽略，不影響輪詢與結果，預設null
 * @returns {Promise} 回傳Promise，resolve回傳布林，true代表有一張圖辨識成功，false代表嘗試完全部輪數皆失敗
 */
let waitPics = async(names, opt = {}) => {
    //waitPics是偵測若有一張圖成功就可結束, 若都失敗則須於嘗試完全部次數才能結束
    let b = false

    //trace, 觀察回調(opt.onTrace), 未給時為null
    let trace = getTrace(opt)

    //check
    if (isestr(names)) {
        names = [names]
    }

    //numMax
    let numMax = get(opt, 'numMax', 60)

    //timeDelay
    let timeDelay = get(opt, 'timeDelay', 1500)

    for (let i = 1; i <= numMax; i++) {
        console.log(`waitPics names[${names}]...`, i)
        if (trace) {
            trace('round', { i, numMax })
        }

        let bb = false
        let nameFound = null
        for (let j = 0; j < size(names); j++) {

            //name
            let name = names[j]

            //ckPic
            try {
                bb = await ckPic(name, opt) //{ ...loc, threshold: 0.95 }
            }
            catch (err) {
                if (trace) {
                    trace('error', { i, name })
                }
                throw err
            }
            if (trace) {
                trace('check', { i, name, ok: Boolean(bb) })
            }
            if (bb) {
                nameFound = name
                break
            }
        }

        if (bb) {
            b = true
            if (trace) {
                trace('found', { i, name: nameFound })
            }
            break
        }

        if (trace) {
            trace('wait', { i, timeDelay })
        }
        await delay(timeDelay)
    }

    if (!b && trace) {
        trace('giveUp', { numMax })
    }

    return b
}


export default waitPics
