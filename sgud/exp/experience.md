# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.過長時抽出舊者為`experience_<年月日>.md`,並於本檔註明何時抽出.

## 2026-10-26 執行檔改為首次使用時下載(mousekey-run01)

- **雜湊要用GitHub raw實際回傳之位元組(=git blob,LF)**.本機`core.autocrlf=true`,工作區`.ahk`是CRLF(`zclick.ahk`工作區210位元組,blob與GitHub為203),直接`sha256sum _autoHotkey/zclick.ahk`會得到錯的雜湊.取值用`git cat-file blob HEAD:<路徑> | sha256sum`,並用HTTP實取互相對照.測試比對工作區檔案時`.ahk`先以`\r\n`→`\n`正規化.
- **`.npmignore`的樣式要以`/`錨定套件根**:`g*.mjs`會把`src/getAhk.mjs`,`src/getSettings.mjs`也排掉.副檔名樣式(`*.exe`等)故意不錨定,作為日後任何位置新增此類檔的兜底;因此單測「漏排資料夾」要另斷言資料夾前綴,否則被副檔名樣式遮住(`license.txt`,`說明.txt`,`.ico`等非禁止副檔名之檔才會暴露)。
- **npm 12的`npm pack --json`輸出是物件`{"w-mousekey":{files:[...]}}`**,不是陣列;用`Object.values(j)[0]`.測試中用單一字串指令加`shell:true`呼叫`npm`,傳參數陣列加`shell:true`會有DEP0190警告.
- **AutoHotkey v2的`/ErrorStdOut`把錯誤寫到stderr,語法錯誤結束碼為2**,正常`ExitApp`為0.AutoHotkey是GUI子系統exe,但以`spawnSync`接管道可正常取得stderr.
- **完整走過AHK路徑又無副作用**:`mousekey.sendString('')`→`zsend.ahk`→`SendText('')`.其他動作(click,drag,scroll,sendCombo)都會動到使用者桌面,實證時不要用.
- **測試並行保護的作法**:同行程用`import('../src/binEnsure.mjs?inst=1')`的查詢字串取得獨立模組實例(各有各的單飛表,同pid),只能靠暫存檔名帶亂數區分;跨行程用子行程+`fs.renameSync`猴補丁卡在「暫存檔已寫入並驗證、尚未更名」,以`signalDir/go`檔放行,可決定性重現「一個行程下載到錯誤內容並刪暫存檔,另一個行程已驗證完待更名」之交錯.兩者都是直接改`fs`預設匯出物件的屬性(模組內以`fs.xxx`呼叫,故有效),測完必須還原.
- **更名容錯會遮住「暫存檔名固定」的變異**(多個行程用同名暫存檔,後更名者ENOENT但目的檔已正確→視為成功),所以另設「錯誤內容+正確內容交錯」案例,才讓固定暫存名必然失敗.日後若動這段,三個變異(固定暫存名,拿掉單飛,拿掉更名容錯)都要重跑.
- **rollup打包**:新增使用Node內建模組(`crypto`)時須同步補`toolg/gDistRollup.mjs`的`globals`與`external`,否則警告「No name was provided for external module」.驗證打包:用`w-package-tools/src/rollupFiles.mjs`把`fdTar`指到`./tmp/...`重建(它會先清空`fdTar`,切勿指向`dist/`),再`require`載入檢查匯出鍵。
- **eslint規則**:`operator-linebreak`要求`+`在行尾;匯出清單`export { a, b }`最後一項不可有逗號(物件字面值則要求有).
- **外審(sol,Codex)抓到而自測沒抓到的幾類**(日後同類程式先自查):①`AbortSignal.timeout`逾時的`DOMException.message`是唯讀getter,就地`err.message = ...`會另拋TypeError而遺失網址——包裝外來錯誤一律`new Error(msg, { cause })`;②並行呼叫共用同一個rejected promise,逐呼叫就地附加訊息會重複;③「檢查→刪除」之間檔案可能被別的行程換掉:刪前再取檔案身分(大小,mtime,ino)比對,測試用`fs.statSync`猴補丁在第2次取身分時以「寫swap檔+utimes+rename」發布好檔來重現;④先檢查通過的群組成員,在補下載的await期間可能被改,補完後要重新驗證整個群組;⑤`existsSync`不等於一般檔案,override與dev來源都要`statSync().isFile()`;⑥`finally`裡吞掉`rmSync`錯誤會讓訊息謊稱「已丟棄」;⑦測試用「所有檔案的總呼叫數 >= 2」斷言重試次數辨識力不足,要逐網址精確計數;⑧未錨定的`.npmignore`樣式(`g*.mjs`)與過窄的樣式(`/g.*`)各有誤傷與漏排,用夾具測樣式本身。
- 截圖測試不可把「任何失敗」都當作無桌面而略過,會掩蓋exe真壞;改為明確環境變數`WMOUSEKEY_TEST_NO_DESKTOP=1`才略過。
- 現有需可見Chrome與真實滑鼠的測試(`unit-mousekey`等)不能在有人使用本機時跑;驗證AHK路徑用上條無副作用做法。
