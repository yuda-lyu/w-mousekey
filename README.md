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
> `w-mousekey` is basing on `OpenCV`, `@u4/opencv4nodejs` and `AutoHotkey`.

## Installation
### Using npm(ES6 module):
```alias

1.下載OpenCV，下載網址：
  https://github.com/opencv/opencv/releases選opencv-4.12.0-windows.exe
 windows.exe為免安裝版，下載後解壓縮(不要複製本機檔案，可能因編譯導致檔案格式變更，而無法讓對方編譯)至C:\tools
 注意須確保路徑有效：
   C:\tools\opencv\build\include
   C:\tools\opencv\build\x64\vc16\bin
   C:\tools\opencv\build\x64\vc16\lib

2.於package.json內新增opencv4nodejs所需opencv路徑
  "opencv4nodejs": {
    "disableAutoBuild": "1",
    "opencvIncludeDir": "C:\\tools\\opencv\\build\\include",
    "opencvLibDir": "C:\\tools\\opencv\\build\\x64\\vc16\\lib",
    "opencvBinDir": "C:\\tools\\opencv\\build\\x64\\vc16\\bin"
  }

3.於終端機(PowerShell)視窗內輸入設定參數
  $Env:OPENCV4NODEJS_DISABLE_AUTOBUILD = "1"
  $Env:OPENCV_INCLUDE_DIR = "C:\tools\opencv\build\include"
  $Env:OPENCV_LIB_DIR    = "C:\tools\opencv\build\x64\vc16\lib"
  $Env:OPENCV_BIN_DIR    = "C:\tools\opencv\build\x64\vc16\bin"
  $Env:Path = "$Env:OPENCV_BIN_DIR;$Env:Path"

4.輸出變數確認
  echo $Env:OPENCV_INCLUDE_DIR
  echo $Env:OPENCV_LIB_DIR
  echo $Env:OPENCV_BIN_DIR
  要能出現路徑才算完成安裝

4.輸出變數確認
   echo $Env:OPENCV_INCLUDE_DIR
   echo $Env:OPENCV_LIB_DIR
   echo $Env:OPENCV_BIN_DIR
   要能出現路徑才算完成安裝

5.下載與安裝Python3，開啟自訂設定勾選Add Python.exe to PATH
   使用cmd輸入以下指令測試:
   python --version
   where python
   要能出現安裝版本與執行檔路徑才算完成安裝

6.下載安裝Visual Studio Build Tools
   下載網址: https://visualstudio.microsoft.com/zh-hant/downloads/
   下載Community版即可
   安裝時要勾選「使用 C++ 的桌面開發」，其內右側會勾選Windows SDK與MSVC，MSVC內會提供MSBuild

7.執行npm i -g node-gyp

8.執行npm i @u4/opencv4nodejs，若msvs有多版本則須指定npm i @u4/opencv4nodejs --msvs_version=2022

9.執行npm i w-mousekey

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