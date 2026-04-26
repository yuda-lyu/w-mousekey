import { execFile } from 'child_process'
import { promisify } from 'util'
import genPm from 'wsemi/src/genPm.mjs'
import getAhk from './getAhk.mjs'
import ks from './keySyntax.mjs'


//execFileAsync
let execFileAsync = promisify(execFile)

let _initialized = false
let _moukeyExternal = null


/**
 * @param {Object} opt
 * @param {Function} opt.moukey - async (action, args) => void
 *   action: 'click' | 'drag' | 'scroll' | 'sendChar' | 'sendString' | 'sendCombo'
 *   args: 依action而定
 *     click:      [x, y, btn?, count?]      btn: 'left'|'right'|'middle' (default 'left'), count: int (default 1)
 *     drag:       [x1, y1, x2, y2, btn?]    btn: 同click (default 'left')
 *     scroll:     [x, y, dir, amount?]      dir: 'up'|'down'|'left'|'right', amount: int (default 3)
 *     sendChar:   [char]                    純文字單字元 (SendText)
 *     sendString: [str]                     純文字字串 (SendText)
 *     sendCombo:  [combo]                   xdotool風格組合鍵字串 (如 'ctrl+v', 'F5')
 */
function init(opt = {}) {
    if (typeof opt.moukey === 'function') {
        _moukeyExternal = opt.moukey
        _initialized = true
    }
}


//按鈕名稱正規化
let VALID_BTNS = new Set(['left', 'right', 'middle'])
function normalizeBtn(btn) {
    let s = String(btn).toLowerCase()
    if (!VALID_BTNS.has(s)) {
        throw new Error(`unknown button: ${btn}`)
    }
    return s
}

//滾輪方向正規化
let VALID_DIRS = new Set(['up', 'down', 'left', 'right'])
function normalizeDir(dir) {
    let s = String(dir).toLowerCase()
    if (!VALID_DIRS.has(s)) {
        throw new Error(`unknown direction: ${dir}`)
    }
    return s
}


async function moukeyAhk(action, args = []) {
    let ak = getAhk()
    let pm = genPm()

    let ahkExePath = ak.ahkExePath
    let ahkScriptPath = null
    let scriptArgs = args
    switch (action) {
    case 'click':
        ahkScriptPath = ak.ahkScriptPathClick
        break
    case 'drag':
        ahkScriptPath = ak.ahkScriptPathDrag
        break
    case 'scroll':
        ahkScriptPath = ak.ahkScriptPathWheel
        break
    case 'sendChar':
    case 'sendString':
        ahkScriptPath = ak.ahkScriptPathSend
        break
    case 'sendCombo':
        ahkScriptPath = ak.ahkScriptPathSendCombo
        //中性語法翻譯為AHK Send語法
        scriptArgs = [ks.xdotoolToAhk(args[0])]
        break
    default:
        throw new Error(`unknown action: ${action}`)
    }

    //execFile要求args為string
    let argsStr = scriptArgs.map((a) => String(a))

    try {
        let { stdout, stderr } = await execFileAsync(ahkExePath, ['/force', ahkScriptPath, ...argsStr])
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


async function mouseClick(x, y, button = 'left', count = 1) {
    let mkc = getMoukey()
    let btn = normalizeBtn(button)
    await mkc('click', [x, y, btn, count])
}

async function mouseDblClick(x, y, button = 'left') {
    let mkc = getMoukey()
    let btn = normalizeBtn(button)
    await mkc('click', [x, y, btn, 2])
}

async function mouseDrag(x1, y1, x2, y2, button = 'left') {
    let mkc = getMoukey()
    let btn = normalizeBtn(button)
    await mkc('drag', [x1, y1, x2, y2, btn])
}

async function mouseScroll(x, y, direction, amount = 3) {
    let mkc = getMoukey()
    let dir = normalizeDir(direction)
    await mkc('scroll', [x, y, dir, amount])
}

async function sendChar(char) {
    let mkc = getMoukey()
    await mkc('sendChar', [`${char}`])
}

async function sendString(str) {
    let mkc = getMoukey()
    await mkc('sendString', [`${str}`])
}

async function sendCombo(combo) {
    let mkc = getMoukey()
    await mkc('sendCombo', [`${combo}`])
}


let obj = {
    init,
    mouseClick,
    mouseDblClick,
    mouseDrag,
    mouseScroll,
    sendChar,
    sendString,
    sendCombo,
}


export default obj
