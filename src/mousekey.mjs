import { execFile } from 'child_process'
import { promisify } from 'util'
import genPm from 'wsemi/src/genPm.mjs'
import getAhk from './getAhk.mjs'


//execFileAsync
let execFileAsync = promisify(execFile)

let _initialized = false
let _moukeyExternal = null


/**
 * @param {Object} opt
 * @param {Function} opt.moukey - async (action, args) => void
 *   action: 'click' | 'drag' | 'sendKey' | 'sendString'
 *   args: 依action而定
 */
function init(opt = {}) {
    if (typeof opt.moukey === 'function') {
        _moukeyExternal = opt.moukey
        _initialized = true
    }
}


async function moukeyAhk(action, args = []) {
    let ak = getAhk()
    let pm = genPm()

    let ahkExePath = ak.ahkExePath
    let ahkScriptPath = null
    switch (action) {
    case 'click':
        ahkScriptPath = ak.ahkScriptPathClick
        break
    case 'drag':
        ahkScriptPath = ak.ahkScriptPathDrag
        break
    case 'sendKey':
    case 'sendString':
        ahkScriptPath = ak.ahkScriptPathSend
        break
    default:
        throw new Error(`unknown action: ${action}`)
    }

    try {
        let { stdout, stderr } = await execFileAsync(ahkExePath, ['/force', ahkScriptPath, ...args])
        if (stderr) {
            pm.reject(stderr)
        }
        else {
            pm.resolve(stdout)
        }
    }
    catch (err) {
        pm.reject(err)
    }

    return pm
}


function getMoukey() {
    if (_initialized && _moukeyExternal) {
        return _moukeyExternal
    }
    return moukeyAhk
}


async function mouseClick(x, y) {
    let mkc = getMoukey()
    await mkc('click', [x, y])
}

async function mouseDrag(x1, y1, x2, y2) {
    let mkc = getMoukey()
    await mkc('drag', [x1, y1, x2, y2])
}

async function sendKey(char) {
    let mkc = getMoukey()
    await mkc('sendKey', [`${char}`])
}

async function sendString(str) {
    let mkc = getMoukey()
    await mkc('sendString', [`${str}`])
}

let obj = {
    init,
    mouseClick,
    mouseDrag,
    sendKey,
    sendString,
}


export default obj
