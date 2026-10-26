//供api-ghDownload.test.mjs以子行程執行(cwd為空資料夾, 非開發repo; WMOUSEKEY_CACHE_DIR指向測試用快取):
//走完 recScp(匯入不得拋錯), mousekey(sendString空字串, 完整走過AutoHotkey但無副作用), screen(截全螢幕), WMousekey(匯出鍵) 的真實取得流程
import recScp from '../../src/recScp.mjs'
import mk from '../../src/mousekey.mjs'
import sc from '../../src/screen.mjs'
import WM from '../../src/WMousekey.mjs'

let out = process.argv[2]
await mk.sendString('')
let bytes = 0
if (process.env.WMOUSEKEY_TEST_NO_DESKTOP !== '1') {
    let img = await sc.screenFullSave(out)
    bytes = img.length
}
console.log(JSON.stringify({ ok: true, recScp: typeof recScp, keys: Object.keys(WM), bytes }))
