//unit-pwInstall之子行程: 於乾淨之環境(由父行程給PLAYWRIGHT_BROWSERS_PATH、下載主機、W_BIN_OFFLINE)以真w-playwright(不用替身)呼叫ensurePwBrowserOrSkip,
//把結果以單行「RESULT <json>」印出; PLAYWRIGHT_BROWSERS_PATH須於載入w-playwright前設定, 故須在獨立行程內執行
import { ensurePwBrowserOrSkip } from './pwInstall.mjs'

let out = { skip: null, error: null }
try {
    out.skip = await ensurePwBrowserOrSkip()
}
catch (err) {
    out.error = { code: err.code || null, message: String(err.message), hasCause: !!err.cause }
}
console.log('RESULT ' + JSON.stringify(out))
