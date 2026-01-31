import { execFile } from 'child_process'
import { promisify } from 'util'
import genPm from 'wsemi/src/genPm.mjs'
import getAhk from './getAhk.mjs'


//execFileAsync
let execFileAsync = promisify(execFile)

//getAhk
let ak = getAhk()

async function runAhkScript(ahkExePath, ahkScriptPath, args = []) {
    let pm = genPm()

    try {
        let { stdout, stderr } = await execFileAsync(ahkExePath, ['/force', ahkScriptPath, ...args])
        if (stderr) {
            // console.error('AHK error', stderr);
            pm.reject(stderr)
        }
        else {
            // console.log('AHK success', stdout);
            pm.resolve(stdout)
        }
    }
    catch (err) {
        // console.error('AHK error', err);
        pm.reject(err)
    }

    return pm
}

async function mouseClick(x, y) {
    await runAhkScript(ak.ahkExePath, ak.ahkScriptPathClick, [x, y])
}

async function mouseDrag(x1, y1, x2, y2) {
    await runAhkScript(ak.ahkExePath, ak.ahkScriptPathDrag, [x1, y1, x2, y2])
}

// async function mouseDown(x, y) {
// }

// async function mouseUp(x, y) {
// }

// async function keyDown(char) {
// }

// async function keyUp(char) {
// }

async function sendKey(char) {
    await runAhkScript(ak.ahkExePath, ak.ahkScriptPathSend, [`${char}`])
}

async function sendString(str) {
    await runAhkScript(ak.ahkExePath, ak.ahkScriptPathSend, [`${str}`])
}

let obj = {
    // mouseDown,
    // mouseUp,
    mouseClick,
    mouseDrag,
    // keyDown,
    // keyUp,
    sendKey,
    sendString,
}


export default obj
