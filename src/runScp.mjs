import fs from 'fs'
import JSON5 from 'json5'
import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isobj from 'wsemi/src/isobj.mjs'
import isarr from 'wsemi/src/isarr.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import isp0int from 'wsemi/src/isp0int.mjs'
import isint from 'wsemi/src/isint.mjs'
import cint from 'wsemi/src/cint.mjs'
import delay from 'wsemi/src/delay.mjs'
import pmSeries from 'wsemi/src/pmSeries.mjs'
import mk from './mousekey.mjs'


let loadScript = async (fp) => {

    let j = fs.readFileSync(fp, 'utf8')
    let data = JSON5.parse(j)

    if (isobj(data)) {
        data = [data]
    }

    if (!isearr(data)) {
        return []
    }

    return data
}

let runSps = async (sps) => {

    let n = size(sps)
    for (let ii = 0; ii < sps.length; ii++) {

        let sp = sps[ii]
        // console.log('sp', sp)

        let repeat = get(sp, 'repeat', 1)
        if (!isint(repeat)) {
            repeat = 1
        }
        repeat = cint(repeat)

        let inf = repeat < 0

        let steps = get(sp, 'steps', [])
        if (!isarr(steps)) {
            steps = []
        }

        if (steps.length === 0) {
            continue
        }

        let i = 0
        while (inf || i < repeat) {

            //執行steps
            let j = 0
            let nj = size(steps)
            await pmSeries(steps, async(st) => {

                let x = get(st, 'x')
                if (!isint(x)) {
                    throw new Error(`invalid x[${x}]`)
                }

                let y = get(st, 'y')
                if (!isint(y)) {
                    throw new Error(`invalid y[${y}]`)
                }

                let timeDelaySt = get(st, 'delay')
                if (!isint(timeDelaySt)) {
                    timeDelaySt = 0
                }
                timeDelaySt = cint(timeDelaySt)

                console.log(`sp(${ii + 1}/${n}) rp(${i + 1}/${inf ? 'inf' : repeat}) step(${j + 1}/${nj}) clicking at (${x}, ${y})`)
                await mk.mouseClick(x, y)

                //執行delay
                if (timeDelaySt > 0) {
                    console.log(`sp(${ii + 1}/${n}) rp(${i + 1}/${inf ? 'inf' : repeat}) step(${j + 1}/${nj}) waiting ${timeDelaySt}ms`)
                    await delay(timeDelaySt)
                }

                j++
            })

            let timeDelay = get(sp, 'delay', 0)
            if (!isp0int(timeDelay)) {
                timeDelay = 0
            }

            //執行delay
            if (timeDelay > 0) {
                console.log(`sp(${ii + 1}/${n}) rp(${i + 1}/${inf ? 'inf' : repeat}) waiting ${timeDelay}ms`)
                await delay(timeDelay)
            }

            i++

        }

    }
}

let runScp = async (inputFile) => {

    let sps = await loadScript(inputFile)

    if (!isearr(sps)) {
        console.log('no content found or empty script.')
        return
    }

    console.log(`running...(Press Ctrl+C to abort.)`)
    await runSps(sps)

    console.log('finish')
}


export default runScp
