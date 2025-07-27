import get from 'lodash-es/get.js'
import size from 'lodash-es/size.js'
import isestr from 'wsemi/src/isestr.mjs'
import delay from 'wsemi/src/delay.mjs'
import ckPic from './ckPic.mjs'


let waitPic = async(names, opt = {}) => {
    let b = false

    //check
    if (isestr(names)) {
        names = [names]
    }

    //numMax
    let numMax = get(opt, 'numMax', 60)

    //timeDelay
    let timeDelay = get(opt, 'timeDelay', 1500)

    for (let i = 1; i <= numMax; i++) {
        console.log(`waitPic names[${names}]...${i}`)

        let bb = false
        for (let j = 0; j < size(names); j++) {

            //name
            let name = names[j]

            //ckPic
            bb = await ckPic(name, opt) //{ ...loc, threshold: 0.95 }
            if (bb) {
                break
            }
        }

        if (bb) {
            b = true
            break
        }

        await delay(timeDelay)
    }

    return b
}


export default waitPic
