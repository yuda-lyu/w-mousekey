
import mk from './src/mousekey.mjs'
import sc from './src/screen.mjs'
import cp from './src/compare.mjs'
import ckPic from './src/ckPic.mjs'


setTimeout(async() => {
    let r

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


//node g.mjs
