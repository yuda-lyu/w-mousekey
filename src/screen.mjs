import fs from 'fs'
import screenshot from 'screenshot-desktop'
import sharp from 'sharp'


async function screenFull() {

    //screenshot
    let img = await screenshot({ format: 'png' })

    return img
}

async function screen(x, y, width, height) {

    //screenshot
    let img = await screenshot({ format: 'png' })

    //cut
    let buffer = await sharp(img)
        .extract({ left: x, top: y, width, height })
        .toBuffer()

    return buffer
}

async function screenFullSave(fp) {

    //screenshot
    let img = await screenshot({ format: 'png' })

    //writeFileSync
    fs.writeFileSync(fp, img)

    return img
}

async function screenSave(x, y, width, height, fp) {

    //screenshot
    let img = await screenshot({ format: 'png' })

    //cut
    let buffer = await sharp(img)
        .extract({ left: x, top: y, width, height })
        .toBuffer()

    //writeFileSync
    fs.writeFileSync(fp, buffer)

    return buffer
}

let obj = {
    screenFull,
    screen,
    screenFullSave,
    screenSave,
}


export default obj
