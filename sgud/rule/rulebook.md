# 規則帳本

本檔為套件設計與開發階段之規則帳本(藍圖),為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.當前已做到哪些記於`sgud/state/state.md`.過長時依類型拆為`rulebook_<類型>.md`,本檔只留索引.

## 索引

| 規則 | 一句話 | 對應測試 |
| --- | --- | --- |
| R01 | npm包不得含執行檔與腳本檔,`bin/`下只有`manifest.json`入包 | `test/unit-npmPack.test.mjs`,`test/unit-binManifest.test.mjs`(T1) |
| R02 | 外部執行檔之存放/下載/校驗/離線一律依制式規格,經`src/ensureBins.mjs`(wsemi `fsEnsureBins`)取得 | `test/api-ensureBins.test.mjs`(T3~T7),`test/unit-binManifest.test.mjs` |
| R03 | `bin/manifest.json`由`toolg/genBinManifest.mjs`產生,與repo`bin/`實檔及釘選提交內位元組一致 | `test/unit-binManifest.test.mjs`(T2,M4) |
| R04 | 各公開入口只經`ensureBins`回傳之路徑啟動執行檔,不直連、不用舊路徑,交換檔不寫執行檔所在夾 | `test/api-ensureBins.test.mjs`(接線) |
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

## 改動範圍 → 測試檔對照(規範:依輪次只跑受影響者)

| 改動 | 測試檔 |
| --- | --- |
| `src/ensureBins.mjs`,`bin/manifest.json`,`bin/*`,`toolg/genBinManifest.mjs` | `api-ensureBins`,`unit-binManifest`,`unit-npmPack` |
| `.npmignore`,`.gitignore`,`.gitattributes`,`package.json`,新增/搬移套件根檔案 | `unit-binManifest`,`unit-npmPack` |
| `src/mousekey.mjs`,`src/screen.mjs`,`src/recScp.mjs`,`src/WMousekey.mjs` | 上列 + `unit-screen`(截圖,無視窗)+ `unit-keySyntax`;`unit-mousekey`,`unit-runScp`,`unit-ckPic`,`unit-waitPics`需可見Chrome與真實滑鼠,依守則17於本機有人使用時不跑;跑時須遠端桌面視窗顯示(見〈需真實桌面之測試之前置〉) |
| `toolg/gDistRollup.mjs` | 以`tmp/`重建UMD載入驗證(`ensureBins`之套件根,external/globals含`url`,`crypto`,`stream`,`stream/promises`,`os`) |

## 測試環境變數

- `WMOUSEKEY_TEST_NO_DESKTOP=1`:沒有桌面工作階段(服務/CI)時略過真截圖exe案;未設定時截圖失敗即測試失敗.

## 需真實桌面之測試之前置(2026-10-29)

- `unit-mousekey`、`unit-runScp`、`unit-ckPic`、`unit-waitPics` 之 `before` 呼叫 `test/tools/helper.mjs` 之 `assertDesktopVisible()`:桌面截圖 RGB 全為 0 即以明確訊息失敗(不略過).
- 理由(實驗):遠端桌面視窗縮小(或鎖定、工作階段未顯示)時,遠端工作階段停止繪製——桌面截圖全黑,AutoHotkey 送出之滑鼠鍵盤送不到視窗;程式皆能啟動、不報錯,只有斷言得空字串.10-26、10-27 兩次全套之 9 failing 與 10-29 縮小視窗之實驗完全相同 9 案;視窗顯示時全綠.
- 執行這 4 檔時須:遠端桌面視窗**未縮小**、工作階段未鎖定(遠端畫面仍在繪製、可互動)——**不需在最上層、不需焦點、部分顯示即可**(2026-10-29 使用者實測:遠端視窗於雙螢幕只部分顯示、焦點在本機另一瀏覽器時全綠);執行期間勿於遠端畫面內操作滑鼠鍵盤.宜避開 CPU 滿載之負載試驗(同日於 4 個負載行程並行時仍全綠,非硬性).

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
