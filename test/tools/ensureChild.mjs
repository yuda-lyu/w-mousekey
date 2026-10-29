//供api-ensureBins.test.mjs以子行程執行(cwd為他處之空資料夾): 載入src/ensureBins.mjs並呼叫, 把結果以JSON印出
//argv[2]為傳給ensureBins之opt(JSON)
import ensureBins from '../../src/ensureBins.mjs'


let opt = JSON.parse(process.argv[2] || '{}')
try {
    let r = await ensureBins(opt)
    console.log(JSON.stringify({ ok: true, bins: r }))
}
catch (err) {
    console.log(JSON.stringify({ ok: false, code: err.code, message: err.message }))
    process.exitCode = 1
}
