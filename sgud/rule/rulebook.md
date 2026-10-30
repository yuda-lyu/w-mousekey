# 規則帳本

本檔為套件設計與開發階段之規則帳本(藍圖),為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.當前已做到哪些記於`sgud/state/state.md`.過長時依類型拆為`rulebook_<類型>.md`,本檔只留索引.

## 索引

| 規則 | 一句話 | 對應測試 |
| --- | --- | --- |
| R01 | npm包不得含執行檔與腳本檔,`bin/`下只有`manifest.json`入包 | `test/unit-npmPack.test.mjs`,`test/unit-binManifest.test.mjs`(T1) |
| R02 | 外部執行檔之存放/下載/校驗/離線一律依制式規格,經`src/ensureBins.mjs`(wsemi `fsEnsureBins`)取得 | `test/api-ensureBins.test.mjs`(T3~T7),`test/unit-binManifest.test.mjs` |
| R03 | `bin/manifest.json`由`toolg/genBinManifest.mjs`產生,與repo`bin/`實檔及釘選提交內位元組一致 | `test/unit-binManifest.test.mjs`(T2,M4) |
| R04 | 各公開入口只經`ensureBins`回傳之路徑啟動執行檔,不直連、不用舊路徑,交換檔不寫執行檔所在夾 | `test/api-ensureBins.test.mjs`(接線) |
| R05 | 計時器相關之測試以事件同步(`opt.onTrace`+條件式等待+假時鐘),固定延時只作看門狗上限;桌面測試`--lock-exclusive`;規格見dspec | `test/unit-waitPicsTrace.test.mjs`,`test/unit-runScpTrace.test.mjs`,4個桌面測試檔 |
| 廢止 | 舊R02~R05(自寫下載/快取/校驗,並行保護,環境變數自行指定路徑)已隨自寫程式刪除 | — |

## R01 npm包不得含執行檔與腳本檔(2026-10-26,2026-10-29依制式規格S1修訂)

**規則**:`npm pack`之檔案清單不得有任何`.exe`,`.ahk`,`.bat`,`.cmd`,`.chm`,`.dll`,`.zip`等執行檔與壓縮檔,`bin/`下只有`manifest.json`,不得有`bin-cache/`,不得有舊路徑資料夾`_autoHotkey/`,`_screenCapture/`,不得有開發用檔(根目錄`g*.mjs`,`pic/`,`script*.json`,`script.txt`,`test/`,`docs/`,`toolg/`,`sgud/`,`_tmp/`,`CLAUDE*.md`及開發設定檔).`dist/`(`main`入口)與`src/`(README以`w-mousekey/src/*.mjs`匯入)須入包.
**why**:2026-10-26凌晨npm帳號被鎖並移除1.0.41,1.0.42,研判整個repo入包(含AutoHotkey32/64.exe,安裝類ahk,bat,cmd,chm,截圖exe)被判為可疑.2026-10-28使用者裁示含外部執行檔之套件統一制式規格(S1:執行檔不入npm包,清單入包為校驗依據).
**實作**:`.npmignore`——`/bin/*`+`!/bin/manifest.json`(gitignore語意下排除整個資料夾後無法再納入其中之檔),`/bin-cache/`,`/test/_tmp/`;副檔名`*.exe *.ahk *.bat *.cmd *.chm`不錨定兜底(日後任何位置新增此類檔也不入包);開發用檔一律以`/`開頭錨定套件根(`/g*.mjs`只排根目錄,不誤傷`src/get*.mjs`).`.gitignore`列`/bin-cache/`,`.gitattributes`列`bin/** binary`.
**測試**:`unit-binManifest`之T1先放誘餌檔(`bin/*.dll`,`bin/*.zip(.001)`,`bin/*.bin`,`bin-cache/*/*.bin`,`src/AutoHotkey64.exe`)再`npm pack --dry-run`,缺規則時確定性變紅;`unit-npmPack`另把`.npmignore`套在自建夾具驗證樣式本身.
**盤點指令**(可重跑,輸出須為空):

```bash
# npm 12 輸出為物件{"w-mousekey":{files:[...]}},非陣列; 以下輸出須只有bin/manifest.json一行
npm pack --dry-run --json --ignore-scripts | node -e "let j=JSON.parse(require('fs').readFileSync(0,'utf8'));j=Array.isArray(j)?j[0]:Object.values(j)[0];console.log(j.files.map(f=>f.path).filter(p=>/\.(exe|ahk|bat|cmd|chm|dll|zip|bin)$/i.test(p)||/^(bin|bin-cache|_autoHotkey|_screenCapture)\//.test(p)).join('\n'))"
```

**站點全集**(2026-10-29盤點,20檔):`LICENSE README.md SECURITY.md package.json bin/manifest.json dist/*(2) src/*.mjs(13)`;其餘皆刻意不入(上列開發用檔,含`.gitattributes`).
**判準**:已套=清單內無禁入項且`bin/`只有`manifest.json`;`docs/`為gh-pages(`npm run deploy`)用JSDoc靜態站,刻意不入包.

## R02 外部執行檔依制式規格取得(2026-10-29,bin-mousekey)

**規格(唯一真理源)**:`C:\opensrcOper\dspec\外部執行檔之存放下載校驗與離線.md`(S存放,M清單,D下載快取,O離線鏡像,E共用實作,T測試);主控帳本G10登記本套件為A類,**釘選模式**.本節只摘要,細節以規格為準.
**要點**:
1. 自有檔放自家repo`bin/`(8檔:`AutoHotkey64.exe`,`zclick.ahk`,`zdrag.ahk`,`zrecord.ahk`,`zsend.ahk`,`zsendcombo.ahk`,`zwheel.ahk`,`screenCapture_1.3.2.exe`),納入git,不入npm包(R01);清單`bin/manifest.json`(`mode:'pinned'`,`commit`=含`bin/`實檔之提交)隨包發布.
2. 套件端只做三件事:提供清單;呼叫`fsEnsureBins`取得路徑後啟動;匯出`ensureBins()`.**不得自寫下載,快取,鏡像,校驗**.入口`src/ensureBins.mjs`轉呼叫wsemi(>=1.9.27)`fsEnsureBins`,`pkgRoot`以本檔位置推得(不依賴cwd;rollup UMD後`dist/`與`src/`同為套件根下一層),**不轉傳`floatingManifestUrl`**.主檔`WMousekey`為物件,以屬性`WMousekey.ensureBins`匯出.
3. 首次使用時才取得(無`postinstall`);快取`<套件根>/bin-cache/<sha256>/<name>`(`W_BIN_CACHE`時為`<W_BIN_CACHE>/w-mousekey/<sha256>/<name>`),命中亦校驗;鏡像`W_BIN_MIRROR`,離線`W_BIN_OFFLINE=1`.
4. 各功能只取所需之檔(`names`):mousekey各動作=`AutoHotkey64.exe`+該動作之腳本;screen=截圖exe;recScp=`AutoHotkey64.exe`+`zrecord.ahk`.各檔位於不同之內容定址夾,腳本以絕對路徑傳給AutoHotkey(腳本間無`#Include`,已確認).
5. 執行期交換檔不寫執行檔所在夾:截圖輸出寫`os.tmpdir()`.
**站點全集與判準**(盤點指令:Grep `ensureBins\(` path=`src`):`src/mousekey.mjs:moukeyAhk`=已套;`src/screen.mjs:getScreenWin32`=已套;`src/recScp.mjs:recScp`=已套;`src/runScp.mjs`,`src/ckPic.mjs`,`src/ckPics.mjs`,`src/waitPics.mjs`,`src/action.mjs`=刻意不套(經mousekey/screen間接取得,自身不啟動執行檔);`src/WMousekey.mjs`=匯出`ensureBins`.名稱常數(`AHK_EXE`,`SCREEN_EXE`,`AHK_RECORD`,腳本名)須與`bin/manifest.json`之`name`一致,由接線測試(以名稱取檔)把關.
**破壞性變更**(原則14,不留相容層,README〈Breaking changes〉):移除`getAhk/ensureAhk/getScreenCapture/ensureScreenCapture`(`src/getAhk.mjs`,`src/getScreenCapture.mjs`及`WMousekey`同名屬性),移除環境變數`WMOUSEKEY_AHK_DIR`,`WMOUSEKEY_SCREENCAPTURE_EXE`,`WMOUSEKEY_CACHE_DIR`,快取由使用者目錄改為套件根`bin-cache/`,開發repo內不再直接用repo檔案,錯誤碼`E_NOT_READY/E_OVERRIDE/E_BAD_FILE/E_NO_FETCH`消失.

## R03 清單與repo實檔同步(2026-10-29)

**規則**:`bin/manifest.json`不手寫,由`node toolg/genBinManifest.mjs --commit <含bin/實檔之提交40碼>`產生(工具先驗`bin/`與該提交相同).更新流程(規格U1,兩步提交):替換`bin/`內檔→提交並推GitHub得提交雜湊→產生清單→跑`unit-binManifest`→發布新版;改`src/`內名稱常數時同步.
**測試**:`unit-binManifest`——清單通過`fsEnsureBins`之schema檢查;清單涵蓋git追蹤之`bin/`每個檔;`bin/`實檔sha256與大小=清單(M4,T2);**清單釘選提交內之git blob位元組=工作樹`bin/`實檔**(`git cat-file blob <commit>:<path>`;取不到提交,如淺層clone,則略過);無`postinstall`等安裝腳本;舊檔/舊資料夾已刪。
**why位元組比對**:GitHub回傳git blob;本機`core.autocrlf=true`時工作樹文字檔會是CRLF而雜湊不同,故`.gitattributes`設`bin/** binary`並以提交內位元組為準(2026-10-26經驗).
**起始值**:提交`949e2af6fbc8ccfe53ff8addb88b61e379eb130b`(主控2026-10-29先提交推送`bin/`實檔與`.gitattributes`;8檔sha256與舊釘選提交`1bb3f051…`之清單逐一相同).

## R04 入口接線(2026-10-29)

**規則**:公開入口(`mousekey`各動作,`screen`各函數,`recScp`)必須經`ensureBins`取得路徑後啟動;所啟動者=清單校驗後之快取路徑(絕對路徑),**不是**repo`bin/`內檔(舊路徑檔與快取檔位元相同時,只驗功能輸出之測試對「先取得卻仍用舊路徑」盲);不直連全域`fetch`;只取所需之`names`;截圖交換檔在`os.tmpdir()`.
**測試**:`api-ensureBins`之「real executables」群(取代原需網路之`api-ghDownload`):自本機鏡像取得後,快取內`AutoHotkey64.exe`實跑(ExitApp腳本結束碼0,語法錯誤腳本結束碼2且`/ErrorStdOut`輸出錯誤),截圖exe實截一張PNG(無桌面時`WMOUSEKEY_TEST_NO_DESKTOP=1`略過),六個腳本無`#Include`/`A_ScriptDir`依賴。`api-ensureBins`之「接線」群:攔截全域`fetch`斷言零呼叫,攔截`child_process.execFile`/`spawn`(替身改以node執行`test/tools/stubExe.mjs`,不動桌面)斷言`prog`與`args[1]`=`<W_BIN_CACHE>/w-mousekey/<sha256>/<name>`且sha256=清單;全新快取夾斷言取得之檔名集合;子行程於他處cwd載入`src/ensureBins.mjs`斷言預設快取在套件根`bin-cache/`;傳無效`floatingManifestUrl`仍成功(不轉傳);`WMousekey.ensureBins`存在而舊鍵不存在.

## R05 計時器相關之測試以事件同步,不以延時偵測(2026-10-29,tm-mousekey)

**規格(唯一真理源)**:`C:\opensrcOper\dspec\計時器相關函數之觀察回調與測試.md`(P1~P7);全域技能 role-coder-for-test §8 及 `references/timer-tests.md`.本節只摘要,細節以規格為準.
**規則**:
1. 計時器相關函數(輪詢、重試、步間/重複延時)提供選用之 `opt.onTrace`(經 wsemi `getTrace`,不自寫等價實作):`src/waitPics.mjs`(事件 `round/check/wait/found/giveUp/error`)、`src/runScp.mjs`(`empty/start/step/stepWait/repeatWait/repeat/error/finish`),事件列舉寫於 JSDoc 與 README〈觀察回調〉.未傳回調時行為與時序不變(`if (trace)` 才組事件物件).`ckPics` 之固定 1500ms 為每圖辨識後之停頓、非輪詢/重試,無測試等它,不加(日後有測試再加).`ckPic`、`mousekey`、`screen`、`compare` 無計時器.
2. 需真實桌面之測試(OS 層 AutoHotkey 輸入送達瀏覽器 DOM 後才斷言)**等可觀察之結果,固定延時只可作看門狗上限**:`test/tools/helper.mjs` 之 `waitPageReady`(已載入、可見、圖片已解碼、兩個畫面框)、`waitTargetOnScreen`(桌面截圖須辨識到目標圖才進行)、`waitTyped`(輸入框值)、`waitSelectAll`(ctrl+a 之選取)、`waitText`(元素文字)、`waitEvents/countEvents`(頁面內 `window.__mkEv` 事件紀錄器,`launchBrowser` 以 `addInitScript` 注入,每次載入新文件重置)、`focusInputByPhysicalClick`(實體點擊已送達、頁面取得焦點、輸入框為作用元素).`WATCHDOG_MS`(15s)只防懸置,條件成立即返回;`POLL_MS`/`SHOT_POLL_MS` 為取樣週期,不是等待時間.
3. 被測物之間隔本身是規格者(`timeDelay`、腳本之 `delay`)用 `node:test` 之 `mock.timers`(只取代 `setTimeout`),斷言事件之虛擬時刻(推進 `ms-1` 不得進入下一步、再推進 1 才進入);防懸置之看門狗用模組載入時保存之真實計時器(`test/tools/traceRecorder.mjs`).
4. 新測試對 `mk`、`sc` 以**property 替換並於 `after` 還原**(`mk.mouseClick`、`sc.screenSave`),不用 `mk.init`/`sc.init`(無法還原,會污染同一 mocha 行程內後續之真實 AHK 測試).
5. 每個加 `onTrace` 之函數補五種回調案(未傳、紀錄器、拋錯、回傳 rejection、非函數;結果相同、無未處理之 rejection)與事件契約案(凍結、`this` 為 undefined、`type` 在列舉內、其餘欄位為原始值).
6. 4 個需真實桌面之測試檔與全套 `npm test` 一律 `--lock-exclusive`(獨占螢幕與滑鼠),其餘單檔 `--lock`;負載試驗用 `test/tools/loadTrial.mjs`(複製自 wsemi,另加「json 報告寫出後逾 30 秒未退出即判『測完不退出』」與 `--guard <腳本>`:每輪前先跑該腳本,離開碼非 0 即停止其後各輪、離開碼 3,供會盲目鍵入之舊版快照於每輪前做前景確認,見〈需真實桌面之測試之前置〉)與 `loadPreload.mjs`.
7. 真實桌面不可用時,以 `test/tools/fakeDesktop.mjs`(替身桌面預載模組,無頭 Chrome+Playwright 模擬 OS 層輸入與桌面截圖;用法與 `FD_MUT`/`FD_LATE_MS` 見檔頭)實跑 4 個桌面測試檔以驗證測試邏輯、變異與「非缺陷之時序變異」;**不得取代真實桌面實跑**(Playwright 輸入同步,與 AutoHotkey 經 OS 非同步送達不同).
**盤點指令**(可重跑,輸出只應剩下列一行):

```text
Grep pattern="waitForTimeout|setTimeout\(resolve|sleep\(|delay\(" path=test glob=*.test.mjs   # 測試檔內無固定延時
# 現況僅 api-ensureBins.test.mjs:420(startRec 以 calls.length 變化為條件之輪詢,每 20ms 取樣、20s 看門狗,非固定延時同步)
```

**站點全集與判準**(2026-10-29,12 項盤點項目[9 案+2 輔助站點+1 B 類案]全數已套):`unit-mousekey` 7 案(sendString,sendChar,mouseClick,mouseDblClick,mouseClick(right),mouseScroll,sendCombo)、`unit-runScp` 1 案、`unit-ckPic` 辨識並點擊案與 `before`、`unit-waitPics` 案與 `before`;不在範圍:`helper.mjs:calibrateViewport/toScreen/extractTargetFromScreen`(無呼叫者之既有死碼,含 `waitForTimeout`,不動,只提出).
**對應測試**:`test/unit-waitPicsTrace.test.mjs`、`test/unit-runScpTrace.test.mjs`(事件與假時鐘,不需桌面);4 個桌面測試檔(條件同步).變異與負載試驗結果見任務報告 `agent-out/tm-mousekey-修正報告.md`.

## 改動範圍 → 測試檔對照(規範:依輪次只跑受影響者)

| 改動 | 測試檔 |
| --- | --- |
| `src/ensureBins.mjs`,`bin/manifest.json`,`bin/*`,`toolg/genBinManifest.mjs` | `api-ensureBins`,`unit-binManifest`,`unit-npmPack` |
| `.npmignore`,`.gitignore`,`.gitattributes`,`package.json`,新增/搬移套件根檔案 | `unit-binManifest`,`unit-npmPack` |
| `src/mousekey.mjs`,`src/screen.mjs`,`src/recScp.mjs`,`src/WMousekey.mjs` | 上列 + `unit-screen`(截圖,無視窗)+ `unit-keySyntax`;`unit-mousekey`,`unit-runScp`,`unit-ckPic`,`unit-waitPics`需可見Chrome與真實滑鼠,依守則17於本機有人使用時不跑;跑時須工作階段未鎖定、未中斷且使用者未在操作該畫面,視窗縮小可(須使用者端已設登錄),且測試開始前 200 秒起至結束,使用者不得操作遠端桌面(Windows 前景鎖 `HKCU\Control Panel\Desktop\ForegroundLockTimeout`=200000 ms:最後一次使用者輸入後 200 秒內,背景啟動之有頭 Chrome 無法取得前景、被當時之前景視窗遮住;超過則可,最大化之 VS Code 亦無妨)(見〈需真實桌面之測試之前置〉),一律`--lock-exclusive` |
| `src/waitPics.mjs`,`src/runScp.mjs`,`src/ckPic.mjs` | `unit-waitPicsTrace`,`unit-runScpTrace`(不需桌面,`--lock`) + 4個桌面測試檔(`--lock-exclusive`) |
| `test/tools/helper.mjs`,`test/tools/traceRecorder.mjs` | 4個桌面測試檔 + `unit-waitPicsTrace`,`unit-runScpTrace` |
| `toolg/gDistRollup.mjs` | 以`tmp/`重建UMD載入驗證(`ensureBins`之套件根,external/globals含`url`,`crypto`,`stream`,`stream/promises`,`os`) |

## 測試環境變數

- `WMOUSEKEY_TEST_NO_DESKTOP=1`:沒有桌面工作階段(服務/CI)時略過真截圖exe案;未設定時截圖失敗即測試失敗.

## 需真實桌面之測試之前置(2026-10-29;同日主控實測後改為新條件;2026-10-30 再補前景鎖條件)

- `unit-mousekey`、`unit-runScp`、`unit-ckPic`、`unit-waitPics` 之 `before` 呼叫 `test/tools/helper.mjs` 之 `assertDesktopVisible()`:桌面截圖 RGB 全為 0 即以明確訊息失敗(不略過).
- 理由(實驗):遠端桌面工作階段不繪製(鎖定、中斷連線,或視窗縮小而使用者端未設下述登錄)時,桌面截圖全黑,AutoHotkey 送出之滑鼠鍵盤送不到視窗;程式皆能啟動、不報錯,只有斷言得空字串.10-26、10-27 兩次全套之 9 failing 與 10-29 縮小視窗之實驗完全相同 9 案;桌面繪製時全綠.
- **現行條件(2026-10-29 主控實測)**:使用者端已設登錄 `RemoteDesktop_SuppressWhenMinimized=2`,**遠端桌面視窗縮小時桌面仍會繪製,GUI 自動化可正常運作**(縮小狀態下 4 檔實測 12 passing).執行這 4 檔時須:**工作階段未鎖定、未中斷連線,且使用者未在操作該畫面**(執行期間勿於遠端畫面內操作滑鼠鍵盤);**視窗縮小可**,不需在最上層、不需焦點、部分顯示亦可(10-29 使用者實測:雙螢幕只部分顯示、焦點在本機另一瀏覽器時全綠);此處「視窗」指本機上之遠端桌面連線視窗,遠端桌面**內**之視窗另見下條.
- **條件更正(2026-10-30,主控查證)**:「使用者未操作」之確切意義為**測試開始前 200 秒起至結束,使用者不得操作遠端桌面(Windows 前景鎖 `HKCU\Control Panel\Desktop\ForegroundLockTimeout`=200000 ms:最後一次使用者輸入後 200 秒內,背景啟動之有頭 Chrome 無法取得前景、被當時之前景視窗遮住;超過則可,最大化之 VS Code 亦無妨)**.不必縮小 VS Code:10-29 下午之縮小視窗實驗,VS Code 開著而 12 passing.2026-10-29 21:04 舊版快照之 9/12 落空,桌面繪製正常(非全黑)而截圖見不到目標圖(相似度 0.52/0.70)、輸入全落空,原因為使用者當時正在操作 VS Code(前景鎖期間 Chrome 被遮);10-30 07:26 使用者操作 VS Code 時,舊版快照於 8 壓力行程下亦 1/10 次落空(相似度 0.5289),同時誤觸開出 Edge;使用者不操作畫面後,主控以改造後之 4 檔實跑 12 passing(9 秒,目標圖相似度約 1.0).新測試以 `waitTargetOnScreen`/mousedown 已送達為條件,遮蔽時於 15 s 以明確訊息失敗(不盲目鍵入).
- **對會盲目鍵入之測試(如改造前之舊版快照)**:每次執行前先以改造後 helper 做前景確認(桌面截圖見到目標圖後,才實體點擊並確認 mousedown 已送達測試頁面;見到目標之前不送任何輸入),失敗即停止整批、不得盲跑;負載試驗器 `test/tools/loadTrial.mjs` 的 `--guard <腳本>` 於每輪前執行該腳本、離開碼非 0 即停止其後各輪(離開碼 3).
- 此登錄屬**使用者端各機之設定**,換機須另設;`assertDesktopVisible()` 失敗(桌面全黑)時先確認:工作階段是否鎖定/中斷、該登錄是否已設,**不要反覆重試**.
- 宜避開他套件 CPU 滿載之測試(10-29 於 4 個負載行程並行時仍全綠,非硬性);4 檔獨占螢幕與滑鼠,須以 `--lock-exclusive` 取鎖(見〈R05〉).

## 變異驗證(2026-10-29,bin-mousekey;一次性,在`./tmp`副本上做,結果見任務報告)

| 變異 | 被抓到之測試 |
| --- | --- |
| 轉傳`floatingManifestUrl` | `api-ensureBins`:floatingManifestUrl not forwarded |
| 套件根取自`process.cwd()` | `api-ensureBins`:package root does not depend on the working directory |
| 不轉傳選項(names/fetch/cacheDir) | `api-ensureBins`:T3~T7多案 |
| 取得後仍用repo`bin/`路徑(mousekey exe/腳本,screen,recScp) | `api-ensureBins`:各接線案 |
| 不限`names`(mousekey/screen) | `api-ensureBins`:only the files its function needs |
| 另直連全域`fetch` | `api-ensureBins`:mousekey actions…without global fetch |
| 交換檔寫在執行檔所在夾 | `api-ensureBins`:screen…os.tmpdir() |
| `.npmignore`缺`/bin/*`,`!/bin/manifest.json`,`/bin-cache/`,`*.exe` | `unit-binManifest`:T1;`unit-npmPack` |
| 清單sha256/size/commit/name/mode錯 | `unit-binManifest`:schema,M4,T2,提交位元組比對 |
| 加`postinstall` | `unit-binManifest`:no install scripts |
