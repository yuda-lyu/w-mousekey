import mousekey from './mousekey.mjs'
import screen from './screen.mjs'
import compare from './compare.mjs'
import action from './action.mjs'
import ckPic from './ckPic.mjs'
import ckPics from './ckPics.mjs'
import waitPics from './waitPics.mjs'
import keySyntax from './keySyntax.mjs'
import getAhk, { ensureAhk } from './getAhk.mjs'
import getScreenCapture, { ensureScreenCapture } from './getScreenCapture.mjs'
import getSettings from './getSettings.mjs'
import recScp from './recScp.mjs'
import runScp from './runScp.mjs'


let WMousekey = {
    mousekey,
    screen,
    compare,
    action,
    ckPic,
    ckPics,
    waitPics,
    keySyntax,
    getAhk,
    ensureAhk,
    getScreenCapture,
    ensureScreenCapture,
    getSettings,
    recScp,
    runScp,
}


export default WMousekey
