import fs from 'fs'
import _ from 'lodash-es'
import w from 'wsemi'
import mk from './mousekey.mjs'
import sc from './screen.mjs'
import cp from './compare.mjs'


let action = (rtx, rty, rtw, rth, fpScreen) => {

    // let screenSave = async() => {
    //     await sc.screenSave(rtx, rty, rtw, rth, fpScreen)
    // }

    // let getCenter = (r) => {
    //     let cx = r.x + r.width / 2
    //     let cy = r.y + r.height / 2
    //     return {
    //         cx,
    //         cy,
    //     }
    // }

    // let findTarget = async(name, opt = {}) => {

    //     //scale
    //     let scale = _.get(opt, 'scale', 1)
    //     // console.log('scale',scale)

    //     //useToGray
    //     let useToGray = _.get(opt, 'useToGray', null)
    //     // console.log('useToGray',useToGray)

    //     //fp
    //     let fp = _.get(opt, 'fp')
    //     // console.log('fp',fp)

    //     //r
    //     if (w.isestr(fp)) {

    //         //calcSimilarityAndDraw
    //         r = await cp.calcSimilarityAndDraw(`./screen/${name}.png`, fpScreen, scale, fp, { useToGray })
    //         // console.log('calcSimilarityAndDraw',r)

    //     }
    //     else {

    //         //calcSimilarity
    //         r = await cp.calcSimilarity(`./screen/${name}.png`, fpScreen, scale, { useToGray })
    //         // console.log('calcSimilarity',r)

    //     }

    //     //getCenter
    //     let c = getCenter(r)
    //     // console.log('c',c)

    //     return {
    //         ...r,
    //         ...c,
    //     }
    // }

    // let findTargetAndClick = async(name, opt = {}) => {

    //     //scale
    //     let scale = _.get(opt, 'scale', 1)
    //     // console.log('scale',scale)

    //     //useToGray
    //     let useToGray = _.get(opt, 'useToGray', null)
    //     // console.log('useToGray',useToGray)

    //     //fpFind
    //     let fpFind = _.get(opt, 'fpFind')
    //     // console.log('fpFind',fpFind)

    //     //fpClick
    //     let fpClick = _.get(opt, 'fpClick')
    //     // console.log('fpClick',fpClick)

    //     //sx, sy
    //     let sx = _.get(opt, 'sx', 0)
    //     let sy = _.get(opt, 'sy', 0)
    //     // console.log('sx',sx)
    //     // console.log('sy',sy)

    //     //threshold
    //     let threshold = _.get(opt, 'threshold', 0.9)
    //     if (!w.isnum(threshold)) {
    //         threshold = 0.9
    //     }
    //     threshold = w.cdbl(threshold)

    //     //findTarget
    //     let r = await findTarget(name, { scale, useToGray, fp: fpFind })
    //     // console.log('findTarget',r)

    //     //check
    //     if (r.similarity < threshold) {
    //         console.log('r', r)
    //         throw new Error(`can not find name[${name}] for click`)
    //         // return Promise.reject(`can not find name[${name}] for click`)
    //     }

    //     await w.delay(1500)

    //     let px = r.cx + sx
    //     let py = r.cy + sy

    //     //點擊前預先繪製與存圖
    //     if (w.isestr(fpClick)) {
    //         await cp.screenAndDrawCircle(rtx, rty, rtw, rth, px, py, fpClick)
    //     }

    //     //mouseClick
    //     await mk.mouseClick(px, py)
    //     // console.log('mouseClick',px, py)

    //     return r
    // }

    // let r = {
    //     screenSave,
    //     getCenter,
    //     findTarget,
    //     findTargetAndClick,
    // }
    // return r
}

export default action
