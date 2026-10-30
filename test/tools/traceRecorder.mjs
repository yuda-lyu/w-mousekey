//traceRecorder.mjs: 觀察回調(opt.onTrace)之紀錄器, 供測試以「等第N個事件」而非固定延時同步
//  rec.onTrace: 傳給被測函數之opt.onTrace
//  rec.events: 已收到之事件(凍結物件)陣列
//  rec.wait(pred, from, n): 等index>=from且符合pred之事件累計達n個(預設from=0,n=1), 回傳符合者之陣列; 逾時(防懸置之看門狗, 用模組載入時保存之真實計時器, 不受假時鐘影響)拋錯並附已收到之事件
//  rec.types(): 已收到事件之type陣列
const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout


export function makeRecorder(msWatchdog = 15000) {
    let events = []
    let waiters = []

    let check = (w) => {
        let hit = []
        for (let i = w.from; i < events.length; i++) {
            if (w.pred(events[i])) {
                hit.push(events[i])
            }
        }
        return hit.length >= w.n ? hit : null
    }

    let onTrace = (e) => {
        events.push(e)
        for (let w of waiters.slice()) {
            let hit = check(w)
            if (hit) {
                waiters.splice(waiters.indexOf(w), 1)
                w.resolve(hit)
            }
        }
    }

    let wait = (pred, from = 0, n = 1) => {
        return new Promise((resolve, reject) => {
            let w = { pred, from, n, resolve }
            let hit = check(w)
            if (hit) {
                resolve(hit)
                return
            }
            let t = realSetTimeout(() => {
                waiters.splice(waiters.indexOf(w), 1)
                reject(new Error(`等待事件逾時(看門狗${msWatchdog}ms), 已收到: ${JSON.stringify(events)}`))
            }, msWatchdog)
            w.resolve = (hit2) => {
                realClearTimeout(t)
                resolve(hit2)
            }
            waiters.push(w)
        })
    }

    return {
        onTrace,
        events,
        wait,
        types: () => events.map((e) => e.type),
    }
}


//讓出一次事件迴圈(setImmediate不受node:test之mock.timers控制), 供假時鐘推進前確認被測函數已排入計時器
export function flush() {
    return new Promise((resolve) => setImmediate(resolve))
}
