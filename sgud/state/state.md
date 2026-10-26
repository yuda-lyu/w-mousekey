# 狀態

本檔記載當前已開發功能之最新狀態(只記現況,過程寫入`sgud/exp/experience.md`),與`sgud/rule/rulebook.md`(藍圖)比對即知尚未做到者.接續工作時先讀本檔.過長時依功能類型拆為`state_<類型>.md`,本檔只留索引.

最近更新:2026-10-26(mousekey-run01).`package.json`之`version`仍為1.0.42(npm上1.0.41,1.0.42已被移除,新版由使用者發布).

## 執行檔取得與npm包內容(規則R01~R05)

| 項目 | 現況 | 規則 | 測試 |
| --- | --- | --- | --- |
| npm包內容 | 22檔,約96KB(原137檔,4.5MB);無`.exe/.ahk/.bat/.cmd/.chm`,無`_autoHotkey/`,`_screenCapture/`,無開發用檔;`dist/`,`src/`,`README.md`,`LICENSE`,`SECURITY.md`,`package.json`入包 | R01 | `unit-npmPack` |
| 首次使用時下載 | `getAhk.mjs`(`ensureAhk`,同步`getAhk`),`getScreenCapture.mjs`(`ensureScreenCapture`,同步`getScreenCapture`),核心`binEnsure.mjs`,清單`binManifest.mjs`;`mousekey.mjs`,`screen.mjs`,`recScp.mjs`已改用ensure版 | R02 | `unit-binEnsure`,`api-ghDownload` |
| 釘選清單 | 提交`1bb3f051465e7dc96416fd5eaf2f069e27514941`,8檔SHA-256與大小寫死 | R03 | `unit-binManifest` |
| 並行保護 | 同行程單飛+唯一暫存名+驗證後原子更名+更名容錯 | R04 | `unit-binEnsure`,`unit-binConcurrent` |
| 自行指定路徑 | `WMOUSEKEY_AHK_DIR`,`WMOUSEKEY_SCREENCAPTURE_EXE`;快取根可由`WMOUSEKEY_CACHE_DIR`改 | R05 | `unit-binEnsure` |
| README | 已寫首次使用行為,下載來源與雜湊驗證,自行指定路徑,離線用法,Upgrade Notes | — | — |

## 驗證紀錄

- 2026-10-26:`unit-binEnsure`(48),`unit-binConcurrent`(3),`unit-binManifest`(4),`unit-npmPack`(6),`api-ghDownload`(7)共68案新增,加既有`unit-keySyntax`(15),`unit-screen`(4),共87案全綠;變異13類皆被抓到(見規則帳本末);已依外審(sol)修正8項並補測試;以`npm pack`之tgz安裝到空專案實證(自GitHub下載,雜湊相符,AutoHotkey與截圖exe可執行,並行首次使用不毀損;main入口dist以相同設定重建後亦驗證),報告見任務資料夾`agent-out/mousekey-run01-修正報告.md`.

## 已知缺口與待辦

- `dist/w-mousekey.umd.js`仍是舊建置(內含舊的cwd查找),發布時自動重新產製;已以相同設定建置到暫存夾驗證新模組可打包、可載入、可下載(`toolg/gDistRollup.mjs`已補`crypto`為external/globals).
- `docs/`(JSDoc靜態站)未重新產製,仍是舊內容,屬`npm run deploy`之發布流程.
- 既有需可見Chrome與真實滑鼠之測試(`unit-mousekey`,`unit-ckPic`,`unit-runScp`,`unit-waitPics`,`unit-compare`)本輪未跑,由主控於末輪跑全套.
- 發布由使用者進行(npm帳號被鎖中);發布後`api-ghDownload`可再驗一次實際發布版。
- 修改`_autoHotkey/`或`_screenCapture/`內被列檔時須同步更新`src/binManifest.mjs`(規則R03).
