/*!
 * screen v1.0.16
 * (c) 2018-2021 yuda-lyu(semisphere)
 * Released under the MIT License.
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t(require("fs"),require("screenshot-desktop"),require("sharp")):"function"==typeof define&&define.amd?define(["fs","screenshot-desktop","sharp"],t):(e="undefined"!=typeof globalThis?globalThis:e||self).screen=t(e.fs,e["screenshot-desktop"],e.sharp)}(this,function(e,t,n){"use strict";let r=!1,i=null;async function o(){let e;if(e=r&&i?await i():await t({format:"png"}),!e||0===e.length)throw console.log("img",e),new Error("can not get the screenshot");return e}return{init:function(e={}){"function"==typeof e.screenshot&&(i=e.screenshot,r=!0)},screenFull:async function(){return await o()},screen:async function(e,t,r,i){let s=await o();return await n(s).extract({left:e,top:t,width:r,height:i}).toBuffer()},screenFullSave:async function(t){let n=await o();return e.writeFileSync(t,n),n},screenSave:async function(t,r,i,s,c){let a=await o(),f=await n(a).extract({left:t,top:r,width:i,height:s}).toBuffer();return e.writeFileSync(c,f),f}}});
//# sourceMappingURL=screen.umd.js.map
