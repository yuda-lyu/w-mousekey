# 回饋

本檔記錄任務中發現之他套件、全域技能、全域設定之調整建議(只是紀錄與提案,實際修改走全域設定 §5.2、§13,不在本套件自行改).一條一列:日期、類別、對象、內容、依據.

| 日期 | 類別 | 對象 | 內容 | 依據 |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 自有套件 | w-playwright | 各使用端之接線測試(R-PW-WIRING)都要重寫同一組斷言(以 `setBrowserTypeForTest` 收到之合併後選項:`args` 恰一串 `--disable-features` 且為最後一個元素、集合 ⊇ `getPlaywrightInfo().defaultDisableFeatures` ∪ 守門、`ignoreDefaultArgs` 去掉預設串);建議於 `test/tools/` 隨包提供斷言輔助(如 `assertGuardOptions(opt)`,與 `readBadPassword.mjs` 同樣深層引用),避免十餘個使用端各寫一份且寫法不一 | `test/unit-pwWiring.test.mjs` R07-5 |
| 2026-11-13 | 自有套件 | w-playwright | README〈`setBrowserTypeForTest`〉可補一句:`next(o)` 對已合併之選項再合併時,`--disable-features` 之集合不變但項目排序改為「守門在前、其餘依字母序」(`args` 不逐字相等),使用端斷言須以集合比對 | 實測 `getChromiumLaunchOptions(getChromiumLaunchOptions(x))`,見 `sgud/exp/experience.md` 2026-11-13 節 |
| 2026-11-25 | 自有套件 | w-playwright | 各使用端之測試取得受管瀏覽器(`ensureChromium({ timeout })`)都要自訂「安裝預算」常數(本庫 `test/tools/pwInstall.mjs` 之 `PW_INSTALL_BUDGET_MS` = 900000;依據:headless shell 129.8 MB＋ffmpeg 1.7 MB＋winldd 0.13 MB ≈ 131 MB,持續頻寬 ≥ 1.2 Mbit/s),建議於 `getPlaywrightInfo()` 或另匯出建議值,匯出後使用端改引用 | `test/tools/pwInstall.mjs`;慢網路驗收(500 KB/s 取得 297 秒) |
| 2026-11-25 | 自有套件 | w-playwright | `ensureChromium` 失敗之錯誤只含離開碼(`browser installation failed with exit code N`,不附子行程輸出),使用端須自接 `funLog('install-output')` 收輸出末段才有診斷(本庫已於 `pwInstall.mjs` 實作:2000 字元、去色碼);建議提供選項或於錯誤物件附輸出末段(須維持不洩漏路徑/網址之原則) | `test/tools/pwInstall.mjs`;PI-8(連線被拒之輸出重複 5 次) |
| 2026-11-25 | 全域技能 | role-coder-for-test | 任務書所引 §5.3(取得工具集中於 `before`、缺工具不得靜默略過、時限對齊安裝預算)於本機技能不存在(僅 §5、§5.1),請確認 `sync.bat` 後已含;並建議補「以限速鏡像(只限頻寬)重現慢網路下載之修前紅」「驗收一律以 `PLAYWRIGHT_BROWSERS_PATH` 指向 `./tmp/` 空夾、不動全機共用之瀏覽器目錄」「`PLAYWRIGHT_BROWSERS_PATH` 於 w-playwright 載入時固定,驗收須用子行程」「離線旗標須於模組載入時讀取(測試內之 `setBinEnv` 會設 `W_BIN_OFFLINE=1`)」 | 本輪(tmk632)報告;`sgud/rule/rulebook.md` R08 |
| 2026-11-25 | 全域設定 | 主控工具 sbx-run | 沙箱(`sbx-run`)只掛載工作快照、Node、Chrome、Git 與輸出夾,**未掛 `%LOCALAPPDATA%\ms-playwright`**,每次沙箱全套對需受管瀏覽器之測試皆真下載約 131 MB(實測見 `sgud/state/state.md`);建議 `sbx-run` 提供選項掛載唯讀預載之瀏覽器夾(並於沙箱內設 `PLAYWRIGHT_BROWSERS_PATH`),或文件註明沙箱須有對外網路 | 沙箱執行器 `sbx-run` 之 `run.wsb` 產生段(掛載清單) |
| 2026-11-13 | 自有套件 | w-playwright(帳本 R-PW-ONLY) | 盤點指令會命中使用端測試中以字串寫成之「正例」(防空集合用之樣本),使用端須以變數組字才能使命中數為 0;建議帳本註明此作法,或把防空集合之正例改以 `w-playwright/src/_pw.mjs` 一處說明 | `test/unit-pwOnly.test.mjs` R07-1b;`rg` 盤點之首次命中 |
