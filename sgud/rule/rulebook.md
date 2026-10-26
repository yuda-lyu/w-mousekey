# 規則帳本

本檔為套件設計與開發階段之規則帳本(藍圖),為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.當前已做到哪些記於`sgud/state/state.md`.過長時依類型拆為`rulebook_<類型>.md`,本檔只留索引.

## 索引

| 規則 | 一句話 | 對應測試 |
| --- | --- | --- |
| R01 | npm包不得含執行檔與腳本檔 | `test/unit-npmPack.test.mjs` |
| R02 | 執行檔與腳本檔於首次使用時自GitHub釘選提交下載,雜湊相符才可使用 | `test/unit-binEnsure.test.mjs`,`test/api-ghDownload.test.mjs` |
| R03 | 釘選清單(提交/SHA-256/大小)與repo內檔案同步 | `test/unit-binManifest.test.mjs` |
| R04 | 並行首次使用(同行程/跨行程)不得互相毀損 | `test/unit-binEnsure.test.mjs`,`test/unit-binConcurrent.test.mjs` |
| R05 | 自行指定路徑之途徑(環境變數)優先,不下載不驗證 | `test/unit-binEnsure.test.mjs` |

## R01 npm包不得含執行檔與腳本檔(2026-10-26)

**規則**:`npm pack`之檔案清單不得有任何`.exe`,`.ahk`,`.bat`,`.cmd`,`.chm`,不得有`_autoHotkey/`,`_screenCapture/`下任何檔,不得有開發用檔(根目錄`g*.mjs`,`pic/`,`script*.json`,`script.txt`,`test/`,`docs/`,`toolg/`,`sgud/`,`_tmp/`,`CLAUDE*.md`及開發設定檔).`dist/`(`main`入口)與`src/`(README以`w-mousekey/src/*.mjs`匯入)須入包.
**why**:2026-10-26凌晨npm帳號被鎖並移除1.0.41,1.0.42,研判整個repo入包(含AutoHotkey32/64.exe,安裝類ahk,bat,cmd,chm,截圖exe)被判為可疑.原無`.npmignore`.
**實作**:`.npmignore`——整個資料夾以`/`開頭錨定於套件根,副檔名`*.exe *.ahk *.bat *.cmd *.chm`兜底(日後任何位置新增此類檔也不入包).開發用檔一律以`/`開頭錨定套件根(`/g*.mjs`只排根目錄,不誤傷`src/get*.mjs`;未錨定的`g*.mjs`會誤傷).`unit-npmPack`除檢查現有清單,另把本檔套在自建夾具上(日後新增、命名不同之根目錄`gSmoke.mjs`,巢狀`.ahk/.EXE`等)驗證樣式本身有效.
**盤點指令**(可重跑,輸出須為空):

```bash
# 禁入副檔名與資料夾
npm pack --dry-run --json --ignore-scripts > ./tmp/pack.json   # npm 12 輸出為物件{"w-mousekey":{files:[...]}},非陣列
node -e "const j=Object.values(JSON.parse(require('fs').readFileSync('./tmp/pack.json','utf8')))[0];console.log(j.files.map(f=>f.path).filter(p=>/\.(exe|ahk|bat|cmd|chm)$/i.test(p)||/^(_autoHotkey|_screenCapture)\//.test(p)).join('\n'))"
# 或直接看產出之tgz
npm pack --ignore-scripts --pack-destination ./tmp && tar -tzf ./tmp/w-mousekey-*.tgz | grep -i -E "\.(exe|ahk|bat|cmd|chm)$|_autoHotkey|_screenCapture"
```

**站點全集**(2026-10-26盤點,22檔):`LICENSE README.md SECURITY.md package.json dist/*(2) src/*.mjs(16)`;其餘皆刻意不入(上列開發用檔).
**判準**:已套=清單內無禁入項;`docs/`為gh-pages(`npm run deploy`)用JSDoc靜態站,刻意不入包.

## R02 首次使用時下載並驗證(2026-10-26)

**規則**:
1. 執行期取得順序:環境變數指定(R05) > 開發repo(cwd/package.json名稱為`w-mousekey`,且`_autoHotkey/`或`_screenCapture/`內該群組每個檔皆為一般檔案)直接用 > 使用者快取目錄內SHA-256與大小皆相符者 > 自釘選網址下載.
2. 不使用`postinstall`(npm 12預設停用安裝腳本,且安裝時下載執行檔即惡意套件掃描警訊);下載只在首次使用時.
3. 下載網址釘在`src/binManifest.mjs`的40碼提交雜湊;每檔SHA-256與大小寫死於該檔;驗證不符即刪除並拋錯,不得使用.
4. 下載至`<檔>.<pid>.<亂數>.part`,驗證後原子更名為正式檔名;失敗必清暫存檔.
5. 失敗訊息須含網址與如何自行指定路徑(R05)與快取目錄.
6. 快取目錄=`%LOCALAPPDATA%\w-mousekey\<提交前12碼>\`(非Windows`$XDG_CACHE_HOME`或`~/.cache`),可由`WMOUSEKEY_CACHE_DIR`改.**why不放套件目錄**:可能唯讀(全域安裝,容器),重裝即清,各專案各存一份.
7. 同步`getAhk()`/`getScreenCapture()`維持既有API且不下載(未備妥時拋`E_NOT_READY`,指引`ensureAhk()`/`ensureScreenCapture()`);`mousekey.mjs`,`screen.mjs`,`recScp.mjs`內一律用ensure版.`recScp`不得在模組載入時呼叫取得函數(否則未下載時import即拋錯).

**盤點指令**:

```
Grep 'getAhk\(|ensureAhk|getScreenCapture|ensureScreenCapture|_autoHotkey|_screenCapture' path=src
```

**站點全集與判準**(2026-10-26):`src/mousekey.mjs:moukeyAhk`=已套(ensureAhk);`src/screen.mjs:getScreenWin32`=已套(ensureScreenCapture);`src/recScp.mjs:recScp`=已套(ensureAhk,函數內);`src/WMousekey.mjs`=匯出getAhk(同步,既有)+ensureAhk,getScreenCapture,ensureScreenCapture;`test/tools/helper.mjs:checkAhk`=刻意不改(開發repo內同步版即可).
8. 檢查與使用之間檔案可能被別的行程改動(2026-10-26外審):①刪除內容不符之檔前再取一次檔案身分(大小,mtime,ino),與檢查時不同即不刪並重新檢查(縮小而非消除窗口);②補下載後重新驗證整個群組,最多補兩輪,仍不符拋`E_NOT_READY`;③錯誤一律以新`Error`包裝(`cause`保留原因,帶`code`,`status`,`cleanupError`),不就地改原錯誤(原生逾時`DOMException.message`唯讀,並行呼叫共用同一錯誤物件);④建資料夾與定位階段之錯誤亦附下載網址與自行指定路徑說明;⑤暫存檔清不掉如實回報(`cleanupError`),不稱已丟棄.
**API錯誤碼**:`E_NOT_READY`(未備妥),`E_HASH_MISMATCH`,`E_HTTP`(含`status`),`E_TIMEOUT`(原生逾時,`cause`鏈保留`TimeoutError`),`E_OVERRIDE`(指定路徑不完整或名稱非一般檔案),`E_BAD_FILE`(壞檔刪不掉),`E_NO_FETCH`.

## R03 釘選清單與repo同步(2026-10-26)

**規則**:`src/binManifest.mjs`之`commit`,各檔`sha256`,`size`須等於該提交內之git blob(LF換行).修改`_autoHotkey/`或`_screenCapture/`內任一被列檔後須:①提交並推上GitHub;②取新提交雜湊與各檔`git cat-file blob <commit>:<路徑> | sha256sum`;③更新清單;④跑`test/unit-binManifest.test.mjs`(於開發repo內比對工作區檔案,`.ahk`以LF正規化——本機`core.autocrlf=true`時工作區為CRLF,雜湊與GitHub raw不同,以blob為準)與`test/api-ghDownload.test.mjs`(真實下載).
**站點全集**:`AutoHotkey64.exe`,`zclick.ahk`,`zdrag.ahk`,`zsend.ahk`,`zsendcombo.ahk`,`zwheel.ahk`,`zrecord.ahk`,`screenCapture_1.3.2.exe`(共8檔);repo內其餘`_autoHotkey/`檔(32位元exe,UX/,chm,bat等)刻意不列入清單,執行期不使用.
**起始值**:提交`1bb3f051465e7dc96416fd5eaf2f069e27514941`(2026-10-26,HEAD與origin一致,8檔經HTTP 200取回並比對雜湊).

## R04 並行首次使用不得互相毀損(2026-10-26)

**規則**:①同行程同一目的檔之下載單飛(`_inflight`);②暫存名帶pid與亂數,跨行程/跨模組實例不共用暫存檔;③驗證後才更名;④更名遭拒(Windows下目的檔被占用,防毒掃描)重試,仍失敗但目的檔已是正確內容視為成功;⑤失敗不留暫存檔,前次崩潰遺留之`.part`不影響下次.
**未做**:跨行程鎖檔(殘留風險大於收益;代價為偶爾兩行程各下載一次).

## R05 自行指定路徑(2026-10-26)

**規則**:環境變數`WMOUSEKEY_AHK_DIR`(資料夾,內`AutoHotkey64.exe`與六個`z*.ahk`皆須為一般檔案)與`WMOUSEKEY_SCREENCAPTURE_EXE`(exe檔案路徑);設定了就必須完整,否則拋`E_OVERRIDE`,不退回下載;不驗證雜湊.**不加函數選項**——對外函數無options參數,加了即改API.

## 改動範圍 → 測試檔對照(規範:依輪次只跑受影響者)

| 改動 | 測試檔 |
| --- | --- |
| `src/binEnsure.mjs`,`src/binManifest.mjs`,`src/getAhk.mjs`,`src/getScreenCapture.mjs` | `unit-binEnsure`,`unit-binConcurrent`,`unit-binManifest`,`api-ghDownload`(需網路,離線設`WMOUSEKEY_TEST_OFFLINE=1`略過) |
| `.npmignore`,`package.json`的files相關,新增/搬移套件根檔案 | `unit-npmPack` |
| `src/screen.mjs` | 上列 + `unit-screen`(截圖,無視窗) |
| `src/mousekey.mjs`,`src/recScp.mjs` | 上列 + `unit-mousekey`,`unit-runScp`(需可見Chrome與真實滑鼠,依守則17於本機有人使用時不跑) |

## 測試環境變數

- `WMOUSEKEY_TEST_OFFLINE=1`:略過`api-ghDownload`(需連 GitHub)。
- `WMOUSEKEY_TEST_NO_DESKTOP=1`:沒有桌面工作階段(服務/CI)時略過截圖相關案;未設定時截圖失敗即測試失敗。

## 變異驗證(2026-10-26,一次性,在`./tmp`複本上做;針對外審修正後之最終程式碼,13類全被抓到,證據見任務報告)

| 變異 | 被抓到之測試 |
| --- | --- |
| 拿掉雜湊比對(只剩大小) | `binEnsure`:下載並驗證、內容不符之本機檔、下載失敗之診斷、檢查與使用之間(共7案) |
| `.npmignore`漏排`/_autoHotkey/` | `unit-npmPack`:不得有`_autoHotkey/`下任何檔、夾具案 |
| `.npmignore`漏排兩資料夾與五個副檔名 | `unit-npmPack`:副檔名案、資料夾案、包大小案、夾具案 |
| `.npmignore`改回`/g.*`(漏排`gSmoke.mjs`) | `unit-npmPack`:夾具案 |
| 暫存名固定為`<檔>.part` | `binEnsure`:跨行程暫存檔名互異案、`unit-binConcurrent`:錯誤內容+正確內容交錯案 |
| 拿掉單飛 | `binEnsure`:同行程並行案(每網址只下載一次) |
| 拿掉更名容錯 | `binEnsure`:更名失敗但目的檔正確案、`unit-binConcurrent`:三行程同放行案 |
| 刪除不符檔前不核對檔案身分 | `binEnsure`:檢查後刪除前別的行程已換成好檔案 |
| 補下載後不重新驗證群組 | `binEnsure`:補下載期間先前通過之檔被改案(2案) |
| 錯誤包裝改回就地修改原錯誤 | `binEnsure`:並行共用失敗案、原生逾時案 |
| AHK override只查存在(資料夾也收) | `binEnsure`:override資料夾案 |
| 開發repo只查主檔存在 | `binEnsure`:開發repo殘缺案 |
| 暫存檔清不掉時不回報 | `binEnsure`:暫存檔刪不掉案 |
