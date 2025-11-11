/*!
 * screen v1.0.9
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t(require("fs"),require("screenshot-desktop"),require("sharp")):"function"==typeof define&&define.amd?define(["fs","screenshot-desktop","sharp"],t):(e="undefined"!=typeof globalThis?globalThis:e||self).screen=t(e.fs,e["screenshot-desktop"],e.sharp)}(this,function(e,t,n){"use strict";return{screenFull:async function(){return await t({format:"png"})},screen:async function(e,r,i,o){let s=await t({format:"png"});return await n(s).extract({left:e,top:r,width:i,height:o}).toBuffer()},screenFullSave:async function(n){let r=await t({format:"png"});return e.writeFileSync(n,r),r},screenSave:async function(r,i,o,s,a){let f=await t({format:"png"}),c=await n(f).extract({left:r,top:i,width:o,height:s}).toBuffer();return e.writeFileSync(a,c),c}}});
//# sourceMappingURL=screen.umd.js.map
