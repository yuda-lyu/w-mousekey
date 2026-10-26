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

### First use: AutoHotkey and screen capture executables are downloaded
The npm package contains **no executables or script files** (no `.exe`, `.ahk`, `.bat`, `.cmd`, `.chm`) and has no `postinstall` script, so `npm i` downloads nothing. The helper files are fetched **on first use** (the first call of a `w-mousekey` mouse/keyboard function or of a `screen` function) and then reused:

| Files | Used by |
| --- | --- |
| `AutoHotkey64.exe`, `zclick.ahk`, `zdrag.ahk`, `zsend.ahk`, `zsendcombo.ahk`, `zwheel.ahk`, `zrecord.ahk` (folder `_autoHotkey`) | `mousekey`, `recScp` |
| `screenCapture_1.3.2.exe` (folder `_screenCapture`) | `screen` (Windows) |

- **Source**: `https://raw.githubusercontent.com/yuda-lyu/w-mousekey/<commit>/_autoHotkey/<file>` and `.../_screenCapture/<file>`, pinned to one commit of this repository (the commit is fixed in [`src/binManifest.mjs`](src/binManifest.mjs), it is not a branch name).
- **Verification**: every file has its SHA-256 and size hard-coded in `src/binManifest.mjs`. A download is written to a temporary name, verified, and only then atomically renamed to its final name. A file that does not match is deleted and an error is thrown; it is never used. Files already on disk are verified again each time before use, and a mismatching one is deleted and downloaded again.
- **Location**: the per-user cache directory, not the package directory (which may be read-only, is wiped by every reinstall, and is duplicated per project): `%LOCALAPPDATA%\w-mousekey\<commit>\` on Windows, `$XDG_CACHE_HOME/w-mousekey/<commit>/` (default `~/.cache`) elsewhere. Set the environment variable `WMOUSEKEY_CACHE_DIR` to use another root.
- **Concurrency**: several first calls at the same time, in one process or in several processes, are safe: each download uses its own temporary file, the file is verified before the rename, and an already complete file is never damaged.
- **Failure**: if the download fails (offline, proxy, HTTP error) or the content does not match, an error is thrown whose message contains the URL and how to use your own files (below).
- **Preparing in advance** (for example in a build step or before going offline):

```js
import { ensureAhk } from 'w-mousekey/src/getAhk.mjs'
import { ensureScreenCapture } from 'w-mousekey/src/getScreenCapture.mjs'

let ak = await ensureAhk() // { ahkExePath, ahkScriptPathClick, ... }
let fpExe = await ensureScreenCapture() // path of the screen capture exe
```

The synchronous `getAhk()` (also exported by `WMousekey`) keeps working and never downloads: it returns the paths when the verified files are already available, otherwise it throws an error that tells you to call `ensureAhk()` first.

### Using your own files (offline or restricted environments)
Set environment variables before the first call. Files taken from these variables are used **as they are, without SHA-256 verification**, and nothing is downloaded. If a variable is set but its files are missing, an error is thrown instead of falling back to a download.

| Environment variable | Value |
| --- | --- |
| `WMOUSEKEY_AHK_DIR` | A folder that contains `AutoHotkey64.exe` (AutoHotkey v2) and the six scripts `zclick.ahk`, `zdrag.ahk`, `zsend.ahk`, `zsendcombo.ahk`, `zwheel.ahk`, `zrecord.ahk`, i.e. a copy of the [`_autoHotkey`](https://github.com/yuda-lyu/w-mousekey/tree/1bb3f051465e7dc96416fd5eaf2f069e27514941/_autoHotkey) folder |
| `WMOUSEKEY_SCREENCAPTURE_EXE` | Path of the screen capture exe, i.e. a copy of [`screenCapture_1.3.2.exe`](https://github.com/yuda-lyu/w-mousekey/tree/1bb3f051465e7dc96416fd5eaf2f069e27514941/_screenCapture) |

```bash
set WMOUSEKEY_AHK_DIR=D:\tools\w-mousekey\_autoHotkey
set WMOUSEKEY_SCREENCAPTURE_EXE=D:\tools\w-mousekey\_screenCapture\screenCapture_1.3.2.exe
```

Offline: run the "Preparing in advance" snippet once on a machine with internet access and copy the cache directory (`%LOCALAPPDATA%\w-mousekey`) to the offline machine, or copy the two folders from the repository and set the variables above.

When working inside a clone of this repository (current directory has this `package.json` and the `_autoHotkey`, `_screenCapture` folders), those folders are used directly and nothing is downloaded or verified.

### Upgrade Notes
- The npm package no longer contains `_autoHotkey/` and `_screenCapture/` (nor `docs/`, `test/` and other development files). The helper files are downloaded and verified on first use as described above, so the first call needs access to `raw.githubusercontent.com` unless you use your own files.
- `${cwd}/node_modules/w-mousekey/_autoHotkey/` and any unrelated `${cwd}/_autoHotkey/` are no longer searched. Use `WMOUSEKEY_AHK_DIR` for a custom folder.
- Public API is unchanged. New exports: `ensureAhk`, `getScreenCapture`, `ensureScreenCapture`.

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
