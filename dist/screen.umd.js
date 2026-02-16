/*!
 * screen v1.0.13
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t(require("fs"),require("screenshot-desktop"),require("sharp")):"function"==typeof define&&define.amd?define(["fs","screenshot-desktop","sharp"],t):(e="undefined"!=typeof globalThis?globalThis:e||self).screen=t(e.fs,e["screenshot-desktop"],e.sharp)}(this,function(e,t,n){"use strict";async function r(){let e=await t({format:"png"});if(!e||0===e.length)throw console.log("img",e),new Error("can not get the screenshot");return e}return{screenFull:async function(){return await r()},screen:async function(e,t,i,o){let s=await r();return await n(s).extract({left:e,top:t,width:i,height:o}).toBuffer()},screenFullSave:async function(t){let n=await r();return e.writeFileSync(t,n),n},screenSave:async function(t,i,o,s,a){let c=await r(),f=await n(c).extract({left:t,top:i,width:o,height:s}).toBuffer();return e.writeFileSync(a,f),f}}});
//# sourceMappingURL=screen.umd.js.map
