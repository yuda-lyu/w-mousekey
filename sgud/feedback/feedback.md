# 回饋

本檔記錄任務中發現之他套件、全域技能、全域設定之調整建議(只是紀錄與提案,實際修改走全域設定 §5.2、§13,不在本套件自行改).一條一列:日期、類別、對象、內容、依據.

| 日期 | 類別 | 對象 | 內容 | 依據 |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 自有套件 | w-playwright | 各使用端之接線測試(R-PW-WIRING)都要重寫同一組斷言(以 `setBrowserTypeForTest` 收到之合併後選項:`args` 恰一串 `--disable-features` 且為最後一個元素、集合 ⊇ `getPlaywrightInfo().defaultDisableFeatures` ∪ 守門、`ignoreDefaultArgs` 去掉預設串);建議於 `test/tools/` 隨包提供斷言輔助(如 `assertGuardOptions(opt)`,與 `readBadPassword.mjs` 同樣深層引用),避免十餘個使用端各寫一份且寫法不一 | `test/unit-pwWiring.test.mjs` R07-5 |
| 2026-11-13 | 自有套件 | w-playwright | README〈`setBrowserTypeForTest`〉可補一句:`next(o)` 對已合併之選項再合併時,`--disable-features` 之集合不變但項目排序改為「守門在前、其餘依字母序」(`args` 不逐字相等),使用端斷言須以集合比對 | 實測 `getChromiumLaunchOptions(getChromiumLaunchOptions(x))`,見 `sgud/exp/experience.md` 2026-11-13 節 |
| 2026-11-13 | 自有套件 | w-playwright(帳本 R-PW-ONLY) | 盤點指令會命中使用端測試中以字串寫成之「正例」(防空集合用之樣本),使用端須以變數組字才能使命中數為 0;建議帳本註明此作法,或把防空集合之正例改以 `w-playwright/src/_pw.mjs` 一處說明 | `test/unit-pwOnly.test.mjs` R07-1b;`rg` 盤點之首次命中 |
