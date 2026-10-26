//供unit-binConcurrent.test.mjs以子行程執行: 模擬一個「首次使用」之行程, 以假manifest與假fetch取得截圖exe
//argv[2]為JSON設定{cacheDir,cwd,signalDir,id,corrupt,pause}
//  corrupt: 下載內容為大小相同之錯誤內容
//  pause:   於更名前(暫存檔已寫入並驗證)寫出ready-<id>, 等到signalDir/go出現才繼續, 讓測試能決定並行之交錯順序
import fs from 'fs'
import path from 'path'
import { ensureScreenCapture } from '../../src/getScreenCapture.mjs'
import { makeFake, makeFetch } from './binFake.mjs'

let cfg = JSON.parse(process.argv[2])
let fake = makeFake()

if (cfg.pause) {
    let orig = fs.renameSync
    let sab = new Int32Array(new SharedArrayBuffer(4))
    fs.renameSync = function (from) {
        if (String(from).endsWith('.part')) {
            fs.writeFileSync(path.join(cfg.signalDir, `ready-${cfg.id}`), '')
            let t0 = Date.now()
            while (!fs.existsSync(path.join(cfg.signalDir, 'go'))) {
                if (Date.now() - t0 > 30000) {
                    throw new Error('timeout waiting for go')
                }
                Atomics.wait(sab, 0, 0, 20)
            }
        }
        return orig.apply(this, arguments)
    }
}

let fetch = makeFetch(fake.contents, {
    handler: (url) => {
        if (cfg.corrupt) {
            return new Response(Buffer.alloc(fake.contents[url].length, 0x43), { status: 200 })
        }
    },
})

try {
    let fp = await ensureScreenCapture({
        env: { WMOUSEKEY_CACHE_DIR: cfg.cacheDir },
        cwd: cfg.cwd,
        manifest: fake.manifest,
        fetch,
        retryDelayMs: 1,
    })
    console.log(JSON.stringify({ ok: true, fp }))
}
catch (err) {
    console.log(JSON.stringify({ ok: false, code: err.code, message: err.message }))
    process.exitCode = 1
}
