# 狀態

本檔記載當前已開發功能之最新狀態(只記現況,過程寫入`sgud/exp/experience.md`),與`sgud/rule/rulebook.md`(藍圖)比對即知尚未做到者.接續工作時先讀本檔.過長時依功能類型拆為`state_<類型>.md`,本檔只留索引.

最近更新:2026-10-30(a-mousekey:負載執行器改用wsemi 1.9.33統一版,`wsemi`升至^1.9.33;前一輪tm-mousekey2:真實桌面負載試驗/變異/全套已跑).`package.json`之`version`為1.0.45(本輪未動,新版由使用者發布).

## 計時器相關之測試(規則R05,tm-mousekey)

| 項目 | 現況 | 規則 | 測試 |
| --- | --- | --- | --- |
| `waitPics` | 加選用`opt.onTrace`(事件`round/check/wait/found/giveUp/error`,JSDoc與README已列);未傳回調時行為不變 | R05 | `unit-waitPicsTrace`(輪次、等待間隔以假時鐘驗證、五種回調、事件契約)9案 |
| `runScp` | 加第2參數`opt`(選用)與`opt.onTrace`(事件`empty/start/step/stepWait/repeatWait/repeat/error/finish`);`runScp(inputFile)`呼叫不變 | R05 | `unit-runScpTrace`(步間/重複延時以假時鐘驗證、錯誤路徑、無限重複、五種回調、事件契約)10案 |
| `ckPics` | 不加`onTrace`(固定1500ms停頓非輪詢,無測試) | R05 | — |
| 4個需真實桌面之測試檔 | 12項盤點項目(9案+2輔助站點+1 B類案,約30處固定延時)全改條件同步(`helper.mjs`之`waitPageReady/waitTargetOnScreen/waitTyped/waitSelectAll/waitText/waitEvents/focusInputByPhysicalClick`,`launchBrowser`注入事件紀錄器);`unit-waitPics`補點擊送達斷言.**真實桌面已實跑**(2026-10-30,`--lock-exclusive`,使用者未操作):新測試12 passing(約12 s),全套`npm test` 91 passing(19 s);2026-10-29舊版快照9案落空之原因為使用者當時正在操作VS Code、Windows前景鎖使Chrome無法到前景(見規則帳本〈需真實桌面之測試之前置〉) | R05 | `unit-mousekey`,`unit-runScp`,`unit-ckPic`,`unit-waitPics`(`--lock-exclusive`) |
| 替身桌面 | `test/tools/fakeDesktop.mjs`:無頭Chrome+Playwright模擬OS層輸入與桌面截圖,舊/新4個桌面測試檔不改即可實跑;2026-10-29於其上:舊/新測試皆12/12綠,變異(輸入不送達、送錯字元、右鍵當左鍵、雙擊單擊、滾輪反向、sendCombo不送出、ckPic不點擊、runScp不點擊)新測試全數抓到,非缺陷之時序變異(輸入延後1500ms)舊測試9/12轉紅、新測試0/12.**不取代真實桌面實跑**(真實桌面已於2026-10-30另跑,見下列) | R05 | 手動(`NODE_OPTIONS=--import=<fakeDesktop.mjs網址>`) |
| 負載試驗器 | `test/tools/loadTrial.mjs`,`loadPreload.mjs`為**wsemi 1.9.33統一版**(2026-10-30,兩檔同時整份複製自`node_modules/wsemi/test/tools/`,位元組全等,不各自修改);環境變數`WSEMI_LT_PROBE/LAG/DIAG`(原`MKEY_LT_*`已廢);不退出之失敗鍵`(mocha did not exit)`;`--hang-sec`(別名`--exit-grace`,預設30)、`--run-max`(預設900秒,0為不限)、`--guard <腳本>`(每輪前先跑,離開碼非0即停止其後各輪、離開碼3)、`--diag` | R05,R06 | `unit-loadTrial`(8案,不需桌面,`--lock`);不需桌面之子集以`loadTrial`實跑一次(`--runs 3 --lag 400:1000`,38 passing×3,0失敗,每次自行退出) |
| 真實桌面負載試驗(2026-10-30,每組5次,舊=`git archive HEAD`快照+舊測試,每輪前前景確認) | **8壓力行程**:舊2/5次有失敗(3個`after all` hook於30 s逾時+1個連鎖:hook逾時後遲到之`restoreBin`改回環境變數,後檔找不到截圖exe),新0/5(再補5次共0/10);舊+僅加hook逾時修補1/10次(整個`unit-mousekey`7案+`runScp`1案落空,該檔桌面截圖相似度0.53見不到目標圖),新0/10.**阻塞400:1000**、**重度阻塞1500:3000**:舊0/5、新0/5(依規格P7失敗率無從比較).平均單次耗時舊→新:cpu 78.7→29.0 s、lag 27.2→15.1 s、heavy 34.0→15.6 s;案耗時加總縮短約58~65%.新測試在負載下共20次(桌面檔;另無負載煙霧1次)+45次(onTrace測試,含較密阻塞300:500、700:1000)0失敗,每次mocha皆自行退出,壓力行程PID皆回驗已結束 | R05 | 手動(`run-all.sh`之作法見下) |
| 真實桌面變異(2026-10-30) | 9項(輸入不送達、送錯字元、右鍵當左鍵、雙擊單擊、滾輪反向、sendCombo不送出、ckPic不點擊、runScp不點擊、時序變異「送達延後1500ms」)**新測試全數抓到**:舊/新失敗數 9/10、3/3、1/1、1/1、1/1、1/1、1/2、1/1;**非缺陷之時序變異**舊9/12轉紅、新0/12.舊測試對這些變異之涵蓋不退步,新測試對「輸入不送達」「ckPic不點擊」更強(補點擊送達斷言) | R05 | 手動 |

重跑真實桌面(桌面可用時:工作階段未鎖定、未中斷,開始前 200 秒起至結束無人操作遠端桌面〔Windows 前景鎖〕):`node C:/opensrcOper/tools/quiet-run.mjs --lock-exclusive --name mousekey-desk -- node node_modules/mocha/bin/mocha.js --no-parallel test/unit-mousekey.test.mjs test/unit-runScp.test.mjs test/unit-ckPic.test.mjs test/unit-waitPics.test.mjs --timeout 180000`;負載試驗以`test/tools/loadTrial.mjs --out tmp/<名> --runs 5 --burners 8|--lag 400:1000|--lag 1500:3000 -- <同上mocha參數>`(單次mocha預設逾900秒即判不退出,逾15分之單次須加`--run-max 0`).舊版對照可用`git archive <提交> -o tmp/x.tar`解到`tmp/`副本(`--cwd`),`node_modules`沿父目錄解析;**舊版會盲目鍵入,須加`--guard <前景確認腳本>`**(前景確認腳本之作法:開有頭Chrome載入`test_mousekey.html`,用改造後helper的`waitPageReady`、`waitTargetOnScreen`見到目標圖後才實體點擊並確認mousedown與`#result`,見到目標前不送任何輸入;失敗即停,不得盲跑).長作業以`nohup`detached、單次`--lock-exclusive`內合併跑(`bash`腳本依序執行,最後一段`npm test`以不帶鎖旗標之`quiet-run`取摘要).

## 外部執行檔取得與npm包內容(規則R01~R04)

| 項目 | 現況 | 規則 | 測試 |
| --- | --- | --- | --- |
| 外部執行檔 | 依制式規格(`C:\opensrcOper\dspec\外部執行檔之存放下載校驗與離線.md`),A類,釘選模式;8檔在repo`bin/`(`AutoHotkey64.exe`,6個`z*.ahk`,`screenCapture_1.3.2.exe`),不入npm包 | R02 | `api-ensureBins`,`unit-binManifest` |
| 清單 | `bin/manifest.json`由`toolg/genBinManifest.mjs`產生,釘選提交`949e2af6fbc8ccfe53ff8addb88b61e379eb130b`,8檔sha256與大小(與舊`1bb3f051…`清單逐一相同) | R03 | `unit-binManifest` |
| 取得入口 | `src/ensureBins.mjs`(轉呼叫wsemi 1.9.27`fsEnsureBins`,`pkgRoot`=本檔上一層,不轉傳`floatingManifestUrl`);`WMousekey.ensureBins`屬性;`mousekey`,`screen`,`recScp`已改經它取得路徑,各取所需之檔 | R02,R04 | `api-ensureBins`(T3~T7,接線) |
| npm包內容 | `bin/`只有`manifest.json`;無`.exe/.ahk/.bat/.cmd/.chm`,無`bin-cache/`,無開發用檔;`dist/`,`src/`,`README.md`,`LICENSE`,`SECURITY.md`,`package.json`入包 | R01 | `unit-npmPack`,`unit-binManifest`(T1) |
| 忽略規則 | `.npmignore`:`/bin/*`,`!/bin/manifest.json`,`/bin-cache/`,`/test/_tmp/`(另保留副檔名兜底);`.gitignore`:`/bin-cache/`;`.gitattributes`:`bin/** binary` | R01 | `unit-binManifest` |
| 已移除(原則14,無相容層) | `_autoHotkey/`,`_screenCapture/`,`src/binEnsure.mjs`,`src/binManifest.mjs`,`src/getAhk.mjs`,`src/getScreenCapture.mjs`;環境變數`WMOUSEKEY_AHK_DIR/SCREENCAPTURE_EXE/CACHE_DIR`;`WMousekey`之`getAhk/ensureAhk/getScreenCapture/ensureScreenCapture` | R02 | `unit-binManifest`,`api-ensureBins` |
| README | 〈外部執行檔〉(含`W_BIN_CACHE/MIRROR/OFFLINE`與離線部署)與〈Breaking changes〉 | — | — |
| rollup | `toolg/gDistRollup.mjs`之external/globals補`url`,`stream`,`stream/promises`(原已有`os`,`crypto`,`child_process`);已以`tmp/`重建UMD驗證:`require()`所得物件含`ensureBins`,`ensureBins`之套件根為`dist/`上一層 | R02 | 手動(見經驗) |

## 驗證紀錄

- 2026-10-30(a-mousekey,第184項):`unit-loadTrial`(R06,8案)主機`--lock`綠(約4 s);7項變異皆使對應案轉紅;`loadTrial`以本套件用法實跑不需桌面之子集(`unit-waitPicsTrace`,`unit-runScpTrace`,`unit-keySyntax`,`unit-compare`,`--runs 3 --lag 400:1000`)3輪皆38 passing、0失敗、每次自行退出;全套`npm test`經`sbx-run`(Windows沙箱,快照執行)99 passing(原91+8),0 failing,0 pending,耗時約2分.

- 2026-10-29(bin-mousekey):新測試`api-ensureBins`(T3~T7與接線),`unit-binManifest`(T1,T2含提交位元組),`unit-npmPack`(更新)全綠;修前紅(HEAD之`src/`配新測試)、變異皆見任務報告`agent-out/bin-mousekey-修正報告.md`.舊`unit-binEnsure`(48),`unit-binConcurrent`(3),`api-ghDownload`(7),`unit-binManifest`(舊4)隨自寫程式刪除.
- 真實執行(L5):本機鏡像供檔,快取路徑含中文,`mousekey.sendString('')`經真AutoHotkey成功,`screen.screenFullSave`得真PNG,快取內`AutoHotkey64.exe`可執行.

## 已知缺口與待辦

- `dist/w-mousekey.umd.js`仍是舊建置(內含舊的下載邏輯),發布時自動重新產製;已以相同設定建置到`tmp/`驗證新模組可打包、可載入.
- `docs/`(JSDoc靜態站)未重新產製,仍是舊內容,屬`npm run deploy`之發布流程.
- 需可見Chrome與真實滑鼠之測試(`unit-mousekey`,`unit-ckPic`,`unit-runScp`,`unit-waitPics`)已於2026-10-30在真實桌面實跑(全套91 passing);跑時須自開始前200秒起至結束無人操作遠端桌面(Windows前景鎖;見規則帳本).
- 4個桌面測試檔之`after`以`restoreBin()`還原`process.env.W_BIN_*`並刪`test/_tmp/<tag>`:該hook若逾時(滿載時`browser.close()`過慢),`restoreBin`會在其後遲到執行,把環境變數改回前一檔之舊值,下一檔的`ensureBins`即找不到截圖exe(舊版快照8壓力行程第2次執行實見該錯誤,訊息所指快取路徑為`_tmp/mousekey/`;「遲到之`restoreBin`改回環境變數」為由此推得之機制,未另行重現);新測試以`this.timeout(120000)`緩解,未改`binEnv.mjs`之還原方式.
- `test/tools/helper.mjs:checkScreen`仍把截圖本身之任何失敗當成無桌面而略過(既有);截圖exe取得失敗(鏡像或清單有誤)則直接拋錯,不略過.
- AutoHotkey之`license.txt`(GPLv2)隨`_autoHotkey/`刪除;README註明授權與官方連結,是否需把授權文字放回repo待使用者裁示.
- 發布由使用者進行;發布後可再以真實網址跑一次`ensureBins()`(本輪全部為本機替身,規格§9亦建議).
- 修改`bin/`內被列檔時須重新產生清單(規則R03).
