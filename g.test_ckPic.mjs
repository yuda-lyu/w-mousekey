import ckPic from './src/ckPic.mjs'


setTimeout(async() => {
    let r

    r = await ckPic('view', { threshold: 0.95 })
    console.log('ckPic', r)


}, 2000) //2s內須開啟指定畫面供偵測測試


//node g.test_ckPic.mjs
