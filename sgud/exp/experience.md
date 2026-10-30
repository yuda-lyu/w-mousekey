# 累積經驗

本檔為執行工作時特有之累積經驗,留給後續之嘗試、執行與判斷,由agent自行編列、擴充與維護.過長時抽出舊者為`experience_<年月日>.md`,並於本檔註明何時抽出.

## 2026-10-30 真實桌面負載試驗/變異/全套(tm-mousekey2)

- **條件更正(主控 10-30 查證)**:「使用者未操作」須為**測試開始前 200 秒起至結束,使用者不得操作遠端桌面(Windows 前景鎖 `HKCU\Control Panel\Desktop\ForegroundLockTimeout`=200000 ms:最後一次使用者輸入後 200 秒內,背景啟動之有頭 Chrome 無法取得前景、被當時之前景視窗遮住;超過則可,最大化之 VS Code 亦無妨)**.10-29 21:04 之 9/12 落空與 10-30 07:26 之 1/10 落空,皆為使用者正在操作 VS Code 之時;不必縮小 VS Code.已寫入規則帳本〈需真實桌面之測試之前置〉.診斷時看 `waitTargetOnScreen` 之最後相似度:≈0.5~0.7 且 `assertDesktopVisible` 通過 → 遮蔽/未繪製;全黑 → 工作階段不繪製.
- **舊快照盲目鍵入之防護**:`loadTrial.mjs --guard <腳本>` 每輪前跑前景確認(`fgcheck`:開有頭 Chrome → `waitPageReady` → `waitTargetOnScreen` 見到目標圖**之後**才實體點擊並確認 mousedown 與 `#result`,見到之前不送任何輸入;最多 3 次嘗試因滿載時第一次可能逾 15 s 看門狗;失敗離開碼 2,`loadTrial` 轉離開碼 3 並停止其後各輪);變異批次(`mutate.mjs`)每次舊測試前亦跑.本輪共 37 次前景確認(含起始 2 次、舊版煙霧與三組各輪、變異 9 次、對照組 10 次)全過.
- **時序變異「送達延後」在真實桌面須限制送出時機**:變異 `mkT` 讓 `mousekey` 先返回、1.5 s 後才啟動 AHK;若遲到之輸入落在案例或瀏覽器結束之後會打到別的視窗.用 mocha root hooks(`--require x.cjs` 匯出 `mochaHooks.beforeEach/afterEach` 設/清 `globalThis.__mkLateOk`),變異程式碼只在旗標為真時送出,案例外丟棄.舊測試 9/12 轉紅、新測試 0/12.
- **舊版 8 壓力行程失敗要分開歸因**:①`after` hook 之 `browser.close()` 逾 30 s(mousekey、runScp 檔 `this.timeout(30000)`),與同步方式無關;②連鎖:hook 逾時後遲到之 `restoreBin()` 把 `process.env.W_BIN_*` 改回前一檔之舊值並刪 `_tmp/<tag>`,下一檔 `ensureBins` 找不到截圖 exe(`fsEnsureBins offline … _tmp/mousekey/cache`;機制為推論);③真正的固定延時失敗:僅在「舊版+只加 hook 逾時修補」之對照 10 次中見 1 次(整個 `unit-mousekey` 7 案+`runScp` 落空,該檔 `mouseClick` 案桌面截圖相似度 0.5289 見不到目標圖),原因是固定 500 ms 後頁面尚未繪於桌面還是前景被他物短暫遮蔽,**日誌無法區分**.新測試對前者以 15 s 看門狗等待,對後者明確失敗而不盲鍵.要量「固定延時是否不穩」不能只看舊版總失敗次數,須加 hook 逾時修補之對照組,否則會把 hook 看門狗之改善誤算成事件同步之功.
- 阻塞負載 `--lag L:P` 須 **P > L**:P ≤ L 時計時器恆已逾期,事件迴圈近乎連續阻塞(本輪誤用 `1500:500`,一輪 290 s、1 案 mocha 30 s 逾時,屬退化負載,已棄用).執行僅 1.5~2 秒之測試(onTrace 兩檔),規格之 `1500:3000` 實際不落入(量測最大延遲僅 68~73 ms,首次阻塞要等 3 s),須另加較密之週期(`300:500`、`700:1000`、8 壓力行程+`300:500`,實測最大延遲 316~725 ms)才有負載意義.
- **排鎖**:本輪 06:55 起獨占鎖即時取得(無人排隊);合併為單次 `--lock-exclusive` 內以 bash 腳本依序跑(前景確認→新煙霧→舊煙霧→舊三組→新三組→onTrace 三組→變異→`quiet-run npm test`〔不帶鎖旗標,已持鎖〕),約 28 分鐘跑完.單次內若需再補跑,另排一次短的獨占請求.
- 真實桌面實測量:無負載煙霧新 11.7 s/舊 21.0 s;單案耗時:移除固定延時後 `sendChar`、`mouseScroll`、`sendCombo` 約縮短 83~85%,案耗時加總縮短 58~65%(各負載組);`ckPic(withClick=false)` 案本身未改,其耗時隨阻塞落點變動,不是同步方式造成.

## 2026-10-29 計時器相關測試改事件同步(tm-mousekey)

- **遠端桌面條件變更(主控實測,取代下節「縮小即全黑」之限制)**:使用者端已設登錄 `RemoteDesktop_SuppressWhenMinimized=2`,視窗縮小時桌面仍繪製,4 個桌面測試檔縮小狀態下 12 passing.新條件:工作階段未鎖定、未中斷連線,使用者未在操作該畫面;縮小可.此登錄屬使用者端各機設定,換機須另設;`assertDesktopVisible()` 失敗時先查鎖定/中斷/登錄,不要反覆重試.
- **10-29 21:04 舊版快照煙霧測試仍 9 案落空,但桌面非全黑**(`assertDesktopVisible` 通過):`mouseClick` 案桌面截圖比對相似度 0.52、`ckPic` 原圖比對 0.70(目標圖應 ≈1.0).另取一張桌面截圖(唯讀,看完即刪)見桌面正常繪製、前景為最大化之 VS Code(主控 session),測試 Chrome 不在其中——假設:有頭 Chrome 因前景鎖被最大化視窗遮在後面,輸入因而落到別處.診斷順序:先看 `waitTargetOnScreen` 之錯誤訊息(最後相似度)與桌面截圖內容,再查登錄/鎖定;**需真實桌面之測試開始前 200 秒起至結束,勿操作遠端桌面**(前景鎖;VS Code 開著無妨).
- 替身桌面(`tmp/tm-mousekey/fakedesk/preload.mjs`,不入 repo):無頭 Chrome 之 `screenX/screenY=(10,10)`、`outer=inner=800×400`、`document.hasFocus()=true`;以 `sc.init({screenshot})`(把頁面截圖貼在 1000×600 灰底之 (10,10))與 `mk.init({moukey})`(Playwright 滑鼠鍵盤,座標減視窗偏移)取代 OS 層,舊/新測試檔不改一行即可實跑(`NODE_OPTIONS=--import=<preload>`,檔名須含 mocha 才啟用).用於驗證輔助函式邏輯、變異(輸入層注入缺陷)與「非缺陷之時序變異」(`FD_LATE_MS` 使輸入延後送達);Playwright 輸入是同步的,故純負載下舊測試亦不失敗,舊測試之脆弱處只在延後送達時現形.
- 桌面測試之固定等待分兩種,各有可觀察之替代:①動作後等結果(輸入框值、`#result`/`#wheelInfo` 文字、ctrl+a 之選取範圍)——`page.waitForFunction` 等條件,`polling` 用固定週期(50ms,取樣頻率)而非 rAF(視窗被遮擋時 rAF 暫停);②載入 settle——等 `load`、`visibilityState==='visible'`、圖片 `complete&&naturalWidth>0`、兩個 rAF,再**輪詢桌面截圖直到辨識到目標圖**(須在 reload 之後做,否則舊畫面仍見到目標會誤判就緒).
- 實體點擊(AHK)確保 OS 焦點在瀏覽器:改以頁面內事件紀錄器(`addInitScript` 注入 `window.__mkEv`,捕獲階段記 mousedown/click/dblclick/contextmenu/wheel/keydown/input)確認 mousedown 已送達,再等 `document.hasFocus()`;`dblclick` 先經兩次 click 使 `#result` 暫為 CLICKED,故須等**最終**文字 DBLCLICKED,不可等「非空」.
- 輸入框值之等待只用「等於 expected」(正向),不用「input 事件數」或「是否仍為 expected 之前綴」:全選取代時既有值 `hello` 非 `xx` 之前綴,前綴法會在尚未輸入時就誤判;事件數法假設每字元恰一個 input 事件.送錯/漏字元時於看門狗上限(15s)報出當下值.
- mocha 同一行程內 `mk.init({moukey})`/`sc.init({screenshot})` 設定後無法還原(`_initialized` 只增不減),會污染後續真實 AHK 測試;單元測試改以 property 替換(`mk.mouseClick`、`sc.screenSave`)並於 `after` 還原,`ckPic`/`waitPics`/`runScp` 皆以 `mk.`/`sc.` 屬性呼叫故有效.影像比對(opencv)走真實實作,以 sharp 合成「灰底+目標圖」與「灰底+另一圖」兩張假螢幕.
- 假時鐘(`node:test` 之 `mock.timers`,`apis:['setTimeout']`)用於 `timeDelay`/腳本 `delay`:`wait` 事件於 `trace()` 同步呼叫後才排入 `delay` 計時器,測試等到事件後須 `setImmediate` 讓出一次再 `tick`;opencv 須在假時鐘前已載入(先跑過一次辨識);防懸置看門狗用模組載入時保存之真實 `setTimeout`.`wsemi delay` 呼叫全域 `setTimeout`,`pmSeries` 無計時器.
- 負載試驗器 `test/tools/loadTrial.mjs` 複製自 wsemi 並加「json 報告寫出後逾 30 秒仍未退出即殺行程樹並計失敗」;環境變數改 `MKEY_LT_LAG/PROBE`(避免與 wsemi 同名而互相干擾).`--cwd` 指向 `git archive` 解出之舊版快照,mocha 取自本套件 `node_modules`,快照在 `./tmp` 下故 `node_modules` 沿父目錄解析,**不需 junction**.
- 排鎖實況(10-29):共用鎖 `--lock` 等 6 分~23 分;獨占 `--lock-exclusive` 自 21:36 排隊至 23:40 才取得(2 小時 4 分),因兩槽被他套件之長時間 `npm test`(w-web-perm 自 21:08 持槽 2 小時 22 分)占住且佇列前有共用請求;4 小時預算大半耗在排鎖.**教訓**:需獨占之工作(負載試驗、全套)盡早排隊,並把所有需獨占者合併為單次取鎖(單一 bash 腳本內依序執行),取消重複之獨占請求(自己排隊之請求可自行終止,殘留號碼牌由後續等鎖者順手清除);排鎖期間只做不需測試之工作.
- 替身桌面下舊測試於 8 壓力行程之純 CPU 負載:單次 `mousekey` 之 `after all` hook(`browser.close()`)逾 30s 逾時(`this.timeout(30000)` 適用 hook),為負載下關瀏覽器過慢,與同步方式無關(新測試之 `after` 與逾時相同,同樣有此風險);若真實桌面重現,應調高 hook 逾時或在 `after` 內以事件(`browser.on('disconnected')`)等關閉,而非只加大 timeout.
- 排鎖:`--lock-exclusive` 須等所有槽空出,他套件持有之長時間 `--lock`(如開發伺服器 `runsrv.mjs`)會使獨占請求排在佇列首位而卡住其後所有人,實測 10-29 排隊逾 10 分鐘;排隊期間只做不需測試之工作(寫碼、文件、`node --check`、eslint).

## 2026-10-29 縮小遠端桌面視窗即桌面全黑、輸入落空(主控實驗;已被上節之登錄設定改變條件)

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
