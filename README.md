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
