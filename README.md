# w-mousekey
An operator for mouse and keyboard in nodejs.

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-mousekey.svg?style=flat)](https://npmjs.org/package/w-mousekey) 
[![license](https://img.shields.io/npm/l/w-mousekey.svg?style=flat)](https://npmjs.org/package/w-mousekey) 
[![npm download](https://img.shields.io/npm/dt/w-mousekey.svg)](https://npmjs.org/package/w-mousekey) 
[![npm download](https://img.shields.io/npm/dm/w-mousekey.svg)](https://npmjs.org/package/w-mousekey) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-mousekey.svg)](https://www.jsdelivr.com/package/npm/w-mousekey)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-mousekey/WMousekey.html).

## Core
> `w-mousekey` is basing on `@techstark/opencv-js` (WASM), `sharp`, `screenshot-desktop` and `AutoHotkey`.

## Installation

### Using npm(ES6 module):
```bash
npm i w-mousekey
```

No native OpenCV installation required. Image matching uses `@techstark/opencv-js` (WebAssembly), which works on any Node.js version without compilation.

### Example

```js
import mk from 'w-mousekey/src/mousekey.mjs'
import sc from 'w-mousekey/src/screen.mjs'
import cp from 'w-mousekey/src/compare.mjs'
import ckPic from 'w-mousekey/src/ckPic.mjs'

// mouseClick
await mk.mouseClick(100, 100)

// sendString
await mk.sendString('Hello World!')

// screenSave
await sc.screenSave(0, 0, 600, 1000, './screenshot.png')

// calcSimilarity
let r = await cp.calcSimilarity('./target.png', './screenshot.png', 1)
console.log(r) // { similarity, x, y, width, height, scale }

// ckPic - find image on screen and click
let found = await ckPic('target', { threshold: 0.9 })
console.log(found) // true or false
```

## 觀察回調 `opt.onTrace`

`waitPics`(輪詢辨識圖片)與 `runScp`(依腳本執行點擊,含步間與重複延時)為計時器相關函數,提供選用之觀察回調 `opt.onTrace`,供測試與診斷以「事件發生」而非「等待毫秒」同步:

```js
import waitPics from 'w-mousekey/src/waitPics.mjs'
import runScp from 'w-mousekey/src/runScp.mjs'

let events = []
let found = await waitPics('target', { numMax: 5, timeDelay: 500, onTrace: (e) => events.push(e) })
// events: { type: 'round', i: 1, numMax: 5 }, { type: 'check', i: 1, name: 'target', ok: false }, { type: 'wait', i: 1, timeDelay: 500 }, ...

await runScp('./script.json', { onTrace: (e) => console.log(e.type) })
```

- 事件為凍結物件 `{ type, ... }`,其餘欄位皆為原始值;回調同步呼叫、不帶接收者(`this` 為 `undefined`),其拋錯與回傳值(含 rejection)一律忽略,不影響被觀察函數之執行與結果;未傳或非函數時行為與未支援前相同.
- `waitPics` 之 `type`:`round`(即將進行第 `i` 輪)、`check`(一張圖辨識完,含 `name`、`ok`)、`wait`(該輪皆失敗,即將等待 `timeDelay`)、`found`(辨識成功)、`giveUp`(全部輪數皆失敗)、`error`(`ckPic` 拋錯,隨後原樣向外拋出).
- `runScp` 之 `type`:`empty`、`start`、`step`(即將點擊,含 `sp`、`rp`、`step`、`x`、`y`)、`stepWait`、`repeatWait`、`repeat`、`error`、`finish`.
- 各 `type` 之完整欄位見 `src/waitPics.mjs`、`src/runScp.mjs` 之 JSDoc.`runScp` 新增第二參數 `opt`(選用),原 `runScp(inputFile)` 之呼叫不變.
- 兩者皆經 wsemi 之 `getTrace`(`wsemi/src/getTrace.mjs`,需 wsemi >= 1.9.31)取得回調.

## 外部執行檔

本套件執行時需要下列外部執行檔與腳本,不含於 npm 包(npm 包內 `bin/` 只有清單 `manifest.json`):

| 檔名 | 用途 | 來源 |
|---|---|---|
| `AutoHotkey64.exe` | 執行 AutoHotkey v2 腳本(`mousekey`、`recScp`、`runScp`) | 本套件 GitHub repo 之 `bin/`(釘選提交) |
| `zclick.ahk`、`zdrag.ahk`、`zsend.ahk`、`zsendcombo.ahk`、`zwheel.ahk`、`zrecord.ahk` | 點擊、拖曳、輸入、組合鍵、滾輪、錄製之腳本 | 同上 |
| `screenCapture_1.3.2.exe` | Windows 截圖(`screen`) | 同上 |

AutoHotkey 以 GNU GPL v2 授權,授權全文見 repo 之 `licenses/AutoHotkey-license.txt`.

- 首次使用到相關功能時自動下載(或預先呼叫本套件匯出之 `WMousekey.ensureBins()`),以 `bin/manifest.json` 所載之 SHA-256 與大小校驗後存於 `<套件根>/bin-cache/<sha256>/<檔名>`;之後自快取取得(亦校驗).安裝時不下載(無 `postinstall`).各功能只取所需之檔(如 `mouseClick` 只取 `AutoHotkey64.exe` 與 `zclick.ahk`),腳本以絕對路徑交給 AutoHotkey.
- 下載網址釘在清單所載之 GitHub 提交(`https://raw.githubusercontent.com/yuda-lyu/w-mousekey/<提交>/bin/<檔名>`),不使用分支名;任何來源取得之檔皆以清單校驗,不符即不用.
- 環境變數:
  - `W_BIN_CACHE=<資料夾>`:快取改放 `<資料夾>/w-mousekey/`(套件所在之 `node_modules` 唯讀時使用,多套件可共用同一資料夾).
  - `W_BIN_MIRROR=<資料夾或 http(s) 網址>`:內網鏡像,先找鏡像再連 GitHub;結構為 `<鏡像>/w-mousekey/<sha256>/<檔名>`.鏡像之檔同樣以清單校驗,不符即不用.
  - `W_BIN_OFFLINE=1`:不連網,只用快取與鏡像;缺檔時錯誤(`E_OFFLINE_MISSING`)會列出缺哪些檔、sha256、大小與應放之完整路徑.
- 離線部署:
  1. 在可連網之電腦設 `W_BIN_CACHE=<空資料夾>`,呼叫 `WMousekey.ensureBins()` 一次(或使用到相關功能一次).
  2. 把該資料夾整個帶到內網電腦,設 `W_BIN_MIRROR=<該資料夾>`(全離線時另設 `W_BIN_OFFLINE=1`).
- 預先取得(部署前或建置時):

```js
import ensureBins from 'w-mousekey/src/ensureBins.mjs'

let bins = await ensureBins() // { 'AutoHotkey64.exe': '<絕對路徑>', 'zclick.ahk': '<絕對路徑>', ... }
let binsPart = await ensureBins({ names: ['AutoHotkey64.exe', 'zclick.ahk'] }) // 只取部分
```

- `WMousekey` 預設匯出(UMD)以屬性 `WMousekey.ensureBins` 提供同一函數.取不到時 reject 帶 `code` 之 Error(`E_OFFLINE_MISSING`、`E_HASH_MISMATCH`、`E_SIZE_MISMATCH`、`E_HTTP`、`E_NETWORK`、`E_TIMEOUT`、`E_MANIFEST`等,由 wsemi 之 `fsEnsureBins` 統一),訊息含檔名、來源與準備方法.
- `bin/AutoHotkey64.exe` 為 AutoHotkey v2 官方發行檔(https://www.autohotkey.com/download/ )原樣,AutoHotkey 以 GNU GPL v2 授權(https://github.com/AutoHotkey/AutoHotkey/blob/v2.0/license.txt ).

## Breaking changes

本版不保留舊版相容(程式碼品質優先,破壞性變更由下游連帶修正):

- 移除 `getAhk()`、`ensureAhk()`、`getScreenCapture()`、`ensureScreenCapture()`(原 `src/getAhk.mjs`、`src/getScreenCapture.mjs` 及 `WMousekey` 之同名屬性).改用 `ensureBins({ names })`,回傳 `{ [檔名]: 絕對路徑 }`;原回傳之 `ahkExePath`、`ahkScriptPathClick` 等欄位不再提供.
- 移除環境變數 `WMOUSEKEY_AHK_DIR`、`WMOUSEKEY_SCREENCAPTURE_EXE`(自行指定、不校驗之檔)與 `WMOUSEKEY_CACHE_DIR`.改用 `W_BIN_MIRROR`(本地資料夾或內網 HTTP,其內之檔仍以清單校驗)、`W_BIN_OFFLINE`、`W_BIN_CACHE`.
- 快取位置由 `%LOCALAPPDATA%\w-mousekey\<提交前 12 碼>\`(非 Windows 為 `$XDG_CACHE_HOME/w-mousekey/...`)改為 `<套件根>/bin-cache/<sha256>/<檔名>`(或 `W_BIN_CACHE`);舊快取夾不再使用,可自行刪除.
- 在本 repo 內開發時不再直接使用 repo 內檔案(原 `_autoHotkey/`、`_screenCapture/` 已移除,執行檔改在 `bin/`),同樣經清單校驗後自快取取得;不想連網時以 `W_BIN_MIRROR` 指向含 `bin/` 實檔之鏡像.修改 `bin/` 內檔案後須依規格重新產生清單(`node toolg/genBinManifest.mjs --commit <含新檔之提交>`).
- 原錯誤碼 `E_NOT_READY`、`E_OVERRIDE`、`E_BAD_FILE`、`E_NO_FETCH` 不再出現,改為上述 `fsEnsureBins` 之錯誤碼.
- 公開入口 `mousekey`、`screen`、`recScp`、`runScp` 等之函數簽名不變.
