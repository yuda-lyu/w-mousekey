import size from 'lodash-es/size.js'
import isestr from 'wsemi/src/isestr.mjs'
import delay from 'wsemi/src/delay.mjs'
import ckPic from 'w-mousekey/src/ckPic.mjs'


let ckPics = async(names, opt = {}) => {
    //ckPics是偵測若有一張圖成功就可結束, 若都失敗一樣可結束
    let b

    if (isestr(names)) {
        names = [names]
    }

    for (let i = 0; i < size(names); i++) {

        let name = names[i]

        b = await ckPic(name, opt)
        await delay(1500)

        if (b) { //若有成功, 則可直接離開
            break
        }

    }

    return b
}


export default ckPics
