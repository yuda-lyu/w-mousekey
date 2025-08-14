import get from 'lodash-es/get.js'
import isestr from 'wsemi/src/isestr.mjs'
import fsIsFile from 'wsemi/src/fsIsFile.mjs'
import fsIsFolder from 'wsemi/src/fsIsFolder.mjs'
import fsCreateFolder from 'wsemi/src/fsCreateFolder.mjs'
import mk from './mousekey.mjs'
import sc from './screen.mjs'
import cp from './compare.mjs'


let getCenter = (r) => {
    let cx = r.x + r.width / 2
    let cy = r.y + r.height / 2
    return {
        cx,
        cy,
    }
}

let ckPic = async(name, opt = {}) => {
    let b = false

    //fdTar
    let fdTar = get(opt, 'fdTar', null)
    if (!isestr(fdTar)) {
        fdTar = './pic'
    }
    if (!fsIsFolder(fdTar)) {
        throw new Error(`opt.fdTar[${opt.fdTar}] is not a folder`)
    }

    //fdTmp
    let fdTmp = get(opt, 'fdTmp', null)
    if (!isestr(fdTmp)) {
        fdTmp = './_tmp'
    }
    if (!fsIsFolder(fdTmp)) {
        fsCreateFolder(fdTmp)
    }

    //modeCompare
    let modeCompare = get(opt, 'modeCompare', 'gray')

    //useToGray
    let useToGray = true
    if (modeCompare === 'color') {
        useToGray = false
    }

    //fpTar
    let fpTar = `${fdTar}/${name}.png`
    if (!fsIsFile(fpTar)) {
        throw new Error(`fpTar[${fpTar}] is not a file`)
    }

    //fpAll, fpDet
    let fpAll = `${fdTmp}/${name}.all.png`
    let fpDet = `${fdTmp}/${name}.det.png`

    let x = get(opt, 'x', 0)
    let y = get(opt, 'y', 0)
    let width = get(opt, 'width', 1920)
    let height = get(opt, 'height', 1080)

    let threshold = get(opt, 'threshold', 0.9)

    let withClick = get(opt, 'withClick', true)

    let withDrag = get(opt, 'withDrag', false)

    //screenSave
    await sc.screenSave(x, y, width, height, fpAll)

    //calcSimilarityAndDraw
    let r = await cp.calcSimilarityAndDraw(fpTar, fpAll, 1, fpDet, { useToGray })
    // console.log('calcSimilarityAndDraw',r)
    console.log(name, 'similarity', r.similarity)

    //getCenter
    let rr = getCenter(r)

    //merge
    r = {
        ...r,
        ...rr
    }
    // console.log('merge',r)

    if (r.similarity > threshold) {

        if (withClick) {

            let dx = get(opt, 'dx', 0)
            let dy = get(opt, 'dy', 0)

            //mouseClick
            await mk.mouseClick(r.cx + x + dx, r.cy + y + dy)
            // console.log('mouseClick',r.cx, r.cy)

        }

        if (withDrag) {

            let dx1 = get(opt, 'dx1', 0)
            let dy1 = get(opt, 'dy1', 0)
            let dx2 = get(opt, 'dx2', 0)
            let dy2 = get(opt, 'dy2', 0)

            //mouseDrag
            await mk.mouseDrag(r.cx + x + dx1, r.cy + y + dy1, r.cx + x + dx2, r.cy + y + dy2)
            // console.log('mouseDrag',r.cx, r.cy)

        }

        b = true
    }

    return b
}


export default ckPic
