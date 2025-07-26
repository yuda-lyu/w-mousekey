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
> `w-mousekey` is basing on `AutoHotkey`.

## Installation
### Using npm(ES6 module):
```alias
npm i w-mousekey
```
#### Example for collection
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-mousekey/blob/master/g.mjs)]
```alias
import getSettings from './getSettings.mjs'
import mk from './src/mousekey.mjs'
import sc from './src/screen.mjs'
import cp from './src/compare.mjs'
import ckPic from './src/ckPic.mjs'

setTimeout(async() => {
    let r

    // let st = getSettings()
    // console.log('st', st)

    // //mouseClick
    // await mk.mouseClick(215, 905)
    // await mk.mouseClick(100, 100)
    // await mk.mouseClick(676, 908)

    // //sendString
    // await mk.sendString('Hello World!')
    // await mk.sendString('abc中文')

    // //screenSave
    // await sc.screenSave(0,0,600,1000,'./ztest.png')

    // //calcSimilarity
    // r = await cp.calcSimilarity('./screen/首頁.png',  './zscreen.png', 1)
    // console.log('calcSimilarity',r)

    // //calcSimilarityAndDraw
    // r = await cp.calcSimilarityAndDraw('./screen/掉落.png', './zscreen.png', 1, './ztest.png')
    // console.log('calcSimilarityAndDraw', r)

    r = await ckPic('view', { threshold: 0.95 })
    console.log('ckPic', r)

    // let loc = {
    //     'x': 480,
    //     'y': 0,
    //     'width': 480,
    //     'height': 1080,
    // }
    // r = await ckPic('view', { ...loc, threshold: 0.95 })
    // console.log('ckPic(loc)', r)

}, 2000) //2s內須開啟指定畫面供偵測測試
```