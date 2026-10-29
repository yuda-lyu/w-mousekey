import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'


export const toolsDir = path.dirname(fileURLToPath(import.meta.url))
export const testDir = path.resolve(toolsDir, '..')
export const repoDir = path.resolve(testDir, '..')
export const tmpRoot = path.join(testDir, '_tmp')

//清單內之名稱(須同bin/manifest.json與src內之常數)
export const AHK_EXE = 'AutoHotkey64.exe'
export const AHK_SCRIPTS = ['zclick.ahk', 'zdrag.ahk', 'zrecord.ahk', 'zsend.ahk', 'zsendcombo.ahk', 'zwheel.ahk']
export const SCREEN_EXE = 'screenCapture_1.3.2.exe'

let keys = ['W_BIN_MIRROR', 'W_BIN_CACHE', 'W_BIN_OFFLINE']


export function readManifest() {
    return JSON.parse(fs.readFileSync(path.join(repoDir, 'bin', 'manifest.json'), 'utf8'))
}


export function sha256Of(fp) {
    return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex')
}


//以repo內bin/之實檔建本機鏡像(<鏡像>/<pkg>/<sha256>/<name>, 規格O1), 回傳鏡像根
export function buildMirror(fdMirror) {
    let manifest = readManifest()
    for (let f of manifest.files) {
        let fd = path.join(fdMirror, manifest.pkg, f.sha256)
        fs.mkdirSync(fd, { recursive: true })
        fs.copyFileSync(path.join(repoDir, f.path), path.join(fd, f.name))
    }
    return fdMirror
}


//測試用: 建本機鏡像並設W_BIN_MIRROR、W_BIN_CACHE、W_BIN_OFFLINE=1, 使需要實際執行檔之功能測試不連外網即可取得(鏡像與快取皆在test/_tmp/<tag>/),
//回傳restore函數: 還原環境變數並刪除該資料夾
export function setBinEnv(tag) {
    let fdt = path.join(tmpRoot, tag)
    fs.rmSync(fdt, { recursive: true, force: true })
    buildMirror(path.join(fdt, 'mirror'))

    let bk = {}
    for (let k of keys) {
        bk[k] = process.env[k]
    }
    process.env.W_BIN_MIRROR = path.join(fdt, 'mirror')
    process.env.W_BIN_CACHE = path.join(fdt, 'cache')
    process.env.W_BIN_OFFLINE = '1'

    return function restore() {
        for (let k of keys) {
            if (bk[k] === undefined) {
                delete process.env[k]
            }
            else {
                process.env[k] = bk[k]
            }
        }
        fs.rmSync(fdt, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
        try {
            fs.rmdirSync(tmpRoot) //尚有其他測試之暫存時非空, 略過
        }
        catch (err) {
            //ignore
        }
    }
}
