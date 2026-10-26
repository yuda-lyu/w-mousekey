//執行檔與腳本檔清單(npm包不含這些檔, 首次使用時自GitHub釘選提交下載, 並以此處寫死之SHA-256驗證)
//
//更新方式: 修改repo內_autoHotkey/或_screenCapture/之檔案並推上GitHub後,
//          將commit改為新提交, sha256與size改為該提交內各檔(git blob, 即LF換行)之值.
//          test/unit-binManifest.test.mjs會比對repo內檔案與此清單是否同步.
let repo = 'yuda-lyu/w-mousekey'
let commit = '1bb3f051465e7dc96416fd5eaf2f069e27514941'

let manifest = {
    repo,
    commit,
    rawBase: `https://raw.githubusercontent.com/${repo}/${commit}/`,
    groups: {

        //AutoHotkey v2免安裝檔與本套件之腳本
        //https://www.autohotkey.com/download/
        ahk: {
            dir: '_autoHotkey',
            files: {
                'AutoHotkey64.exe': {
                    sha256: '3880f9ec464dfe78c16bbd8b9f30560227154c292280337346a30c8fd92871fe',
                    size: 1279488,
                },
                'zclick.ahk': {
                    sha256: '831697bab3048e489e39a09b12c4173d1fdbb3d5481868302f2f97a64802a32b',
                    size: 203,
                },
                'zdrag.ahk': {
                    sha256: '0d2222611066bf927e3d97bcaa56620d6751f73c5003215ee42cbf38da5b0b90',
                    size: 230,
                },
                'zsend.ahk': {
                    sha256: '564a69ee00c6f0ae7026f09b622228c03239ac740351987ec90ba8467504f1ae',
                    size: 70,
                },
                'zsendcombo.ahk': {
                    sha256: '3ec587435a271a34ee5de324f46e8cd7884a1b233b547998cfa8975130b44c44',
                    size: 37,
                },
                'zwheel.ahk': {
                    sha256: '3a7b64fcae3b2b56340fa0f819f57477601a18909d50c6f2d66de92d59e8004b',
                    size: 321,
                },
                'zrecord.ahk': {
                    sha256: '1f8201131fc3022710b9d48b18f86878af468f538d1790080c13f1f43b3a63f7',
                    size: 226,
                },
            },
        },

        //Windows截圖exe
        screen: {
            dir: '_screenCapture',
            files: {
                'screenCapture_1.3.2.exe': {
                    sha256: 'fa44d971ea48720b83b02e4b8bac58b716fca8c54ca4d9a8eef56242b73b73be',
                    size: 12800,
                },
            },
        },

    },
}


export default manifest
