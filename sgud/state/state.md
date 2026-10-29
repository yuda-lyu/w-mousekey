# 狀態

本檔記載當前已開發功能之最新狀態(只記現況,過程寫入`sgud/exp/experience.md`),與`sgud/rule/rulebook.md`(藍圖)比對即知尚未做到者.接續工作時先讀本檔.過長時依功能類型拆為`state_<類型>.md`,本檔只留索引.

最近更新:2026-10-29(bin-mousekey).`package.json`之`version`仍為1.0.43(未動,新版由使用者發布).

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

- 2026-10-29(bin-mousekey):新測試`api-ensureBins`(T3~T7與接線),`unit-binManifest`(T1,T2含提交位元組),`unit-npmPack`(更新)全綠;修前紅(HEAD之`src/`配新測試)、變異皆見任務報告`agent-out/bin-mousekey-修正報告.md`.舊`unit-binEnsure`(48),`unit-binConcurrent`(3),`api-ghDownload`(7),`unit-binManifest`(舊4)隨自寫程式刪除.
- 真實執行(L5):本機鏡像供檔,快取路徑含中文,`mousekey.sendString('')`經真AutoHotkey成功,`screen.screenFullSave`得真PNG,快取內`AutoHotkey64.exe`可執行.

## 已知缺口與待辦

- `dist/w-mousekey.umd.js`仍是舊建置(內含舊的下載邏輯),發布時自動重新產製;已以相同設定建置到`tmp/`驗證新模組可打包、可載入.
- `docs/`(JSDoc靜態站)未重新產製,仍是舊內容,屬`npm run deploy`之發布流程.
- 需可見Chrome與真實滑鼠之測試(`unit-mousekey`,`unit-ckPic`,`unit-runScp`,`unit-waitPics`)已改用本機鏡像取得執行檔,但因守則17(本機有人使用時不開可見視窗/不動滑鼠)本輪未跑,由主控於末輪跑全套.
- `test/tools/helper.mjs:checkScreen`仍把截圖本身之任何失敗當成無桌面而略過(既有);截圖exe取得失敗(鏡像或清單有誤)則直接拋錯,不略過.
- AutoHotkey之`license.txt`(GPLv2)隨`_autoHotkey/`刪除;README註明授權與官方連結,是否需把授權文字放回repo待使用者裁示.
- 發布由使用者進行;發布後可再以真實網址跑一次`ensureBins()`(本輪全部為本機替身,規格§9亦建議).
- 修改`bin/`內被列檔時須重新產生清單(規則R03).
