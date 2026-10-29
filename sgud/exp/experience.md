# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.過長時抽出舊者為`experience_<年月日>.md`,並於本檔註明何時抽出.

## 2026-10-29 縮小遠端桌面視窗即桌面全黑、輸入落空(主控實驗)

- 使用者縮小遠端桌面視窗後,主控執行 4 個需真實桌面之測試檔:3 passing、9 failing——輸入、單字元、點擊、雙擊、右鍵、滾輪、全選取代、腳本點圖、辨識並點擊皆得空字串;測試前後之桌面截圖皆為 1920×1080 全黑(PNG 約 10 KB).Chrome、AutoHotkey 皆正常啟動、不報錯.
- 與 10-26、10-27 兩次全套之 9 failing 完全相同(同 9 案同訊息);10-27 13:07 全綠者當時視窗顯示.故先前「疑時序」之推論不成立,根因為工作階段不繪製.
- 對照:使用者還原遠端視窗後全套 72 passing、0 failing(當時另有 4 個負載試驗行程並行);使用者另指出當時遠端視窗於雙螢幕只**部分顯示**、焦點在本機另一瀏覽器——故條件是「未縮小、未鎖定(工作階段仍繪製、可互動)」,不需最上層或焦點.
- 處置:`assertDesktopVisible()` 前置檢查(以明確訊息失敗);規則帳本〈需真實桌面之測試之前置〉.不在 Playwright 頁面內之操作(桌面截圖、SendInput)都受影響;只靠 Chrome 自身繪製者(如「辨識目標圖(withClick=false)」「等待並找到目標圖」)不受影響.

## 2026-10-29 外部執行檔改依制式規格、共用wsemi `fsEnsureBins`(bin-mousekey)

- 規格與範本:`C:\opensrcOper\dspec\外部執行檔之存放下載校驗與離線.md`;範本取自`wsemi-run04-修正報告.md`§8與已完成之w-html2docx(`test/api-ensureBins.test.mjs`).本套件為A類:原有自寫釘選清單與下載,**整套刪除**(`src/binEnsure.mjs`,`src/binManifest.mjs`,`src/getAhk.mjs`,`src/getScreenCapture.mjs`及其測試),不留相容層(原則14).
- 同一功能需多個檔(exe+腳本)而各檔落在不同內容定址夾(`<快取>/<sha256>/<name>`):AutoHotkey腳本改以**絕對路徑**傳入即可,無`#Include`之相對依賴;快取路徑含中文實測可行.
- 攔截子行程啟動的方法:wsemi `execProcess`以`cp.execFile(...)`於呼叫時查找(`import cp from 'child_process'`之預設匯出物件),直接替換`cp.execFile`即可;`recScp`與wsemi `fsEnsureBins`以**具名匯入**`spawn`,替換`cp.spawn`後須呼叫`module.syncBuiltinESMExports()`,還原後再呼叫一次.替身讓被啟動者改為`node test/tools/stubExe.mjs`,不動桌面.`recScp`永不結束(`await new Promise(()=>{})`),測試不等待,啟動後須移除它登記之`SIGINT`處理(比對呼叫前後`process.listeners('SIGINT')`).
- 副本內要唯讀使用git(`git ls-files`,`git cat-file blob <commit>:<path>`):副本根放一個內容為`gitdir: <repo>/.git`之`.git`檔即可(HEAD副本、變異副本皆如此);其中**不得執行寫入類git指令**.
- Windows下GNU tar把`C:`當遠端主機:`git archive -o x.tar`後解壓改用相對路徑呼叫`tar -xf <相對> -C <相對>`.
- 其他套件之測試同機並行,常用埠(如8941)可能處於TIME_WAIT/占用:本套件測試埠用8944,開測前`netstat -ano`看一眼.
- `unit-ckPic`,`unit-waitPics`之`after`會`fs.rmSync(test/_tmp)`整夾:本機鏡像之`setBinEnv`的`restore()`對不存在之夾須容忍(`rmSync force`,`rmdirSync`包try).
- `quiet-run --lock`等鎖曾達約2分40秒:多段驗證(新測試,修前紅,變異)寫成一支腳本於同一次鎖內依序跑.
- 變異驗證之等價變異:`.npmignore`的`/test/_tmp/`在pack層無效果(`/test/`已整夾排除),只能以「規則存在」之斷言抓;`*.exe`兜底與`/bin/*`重疊,誘餌要用`.dll`,`.zip`,`.bin`等非兜底副檔名才能讓缺`/bin/*`確定性變紅.
- 打包驗證(UMD):用`w-package-tools/src/rollupFiles.mjs`以`toolg/gDistRollup.mjs`之設定(只改fdSrc/fdTar)建到`tmp/.../pkg/dist`,並把`bin/manifest.json`複製到`tmp/.../pkg/bin/`當假套件根,`require`後呼叫`ensureBins`,路徑落在`pkg/bin-cache/`即證明`import.meta.url`被換成`pathToFileURL(__filename)`後套件根判定可用(`url`,`stream`,`stream/promises`須列external/globals).
- `bin/manifest.json`之`commit`須含`bin/`實檔且已推GitHub:本輪由主控先提交(`949e2af…`),agent只用`genBinManifest --commit`產生清單並以`git cat-file blob`比對提交內位元組.
- 既有`test/tools/helper.mjs:checkScreen`會把截圖失敗一律當無桌面略過(既有缺陷,範圍外):新增之截圖exe取得步驟放在其`try`外,鏡像或清單有誤時直接拋錯,不被吞掉.

## 2026-10-26 執行檔改為首次使用時下載(mousekey-run01)(自寫下載已於2026-10-29刪除;下列與`binEnsure`並行保護,測試猴補丁,外審缺陷類別有關者僅供參考,git blob雜湊,`.npmignore`錨定,npm 12 pack格式,AHK行為,eslint規則仍有效)

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
