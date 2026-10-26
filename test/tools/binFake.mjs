import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

export const toolsDir = path.dirname(fileURLToPath(import.meta.url))
export const testDir = path.resolve(toolsDir, '..')
export const repoDir = path.resolve(testDir, '..')
export const tmpRoot = path.join(testDir, '_tmp')

export const AHK_NAMES = ['AutoHotkey64.exe', 'zclick.ahk', 'zdrag.ahk', 'zsend.ahk', 'zsendcombo.ahk', 'zwheel.ahk', 'zrecord.ahk']
export const SCREEN_NAME = 'screenCapture_1.3.2.exe'

export function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex')
}

//假內容(內容與大小皆決定性), 供假manifest與假fetch使用
export function makeFake() {
    let commit = 'abcdef0123456789abcdef0123456789abcdef01'
    let rawBase = `https://example.invalid/fake/repo/${commit}/`
    let contents = {}
    let groups = { ahk: { dir: '_autoHotkey', files: {} }, screen: { dir: '_screenCapture', files: {} } }
    let add = (g, name) => {
        let buf = Buffer.from(`fake-content-of-${name}-`.repeat(g === 'screen' ? 50 : 3))
        groups[g].files[name] = { sha256: sha256(buf), size: buf.length }
        contents[`${rawBase}${groups[g].dir}/${name}`] = buf
    }
    AHK_NAMES.forEach((n) => add('ahk', n))
    add('screen', SCREEN_NAME)
    let manifest = { repo: 'fake/repo', commit, rawBase, groups }
    return { manifest, contents }
}

//假fetch: 依網址回傳內容, 並記錄呼叫; 可注入延遲, 或以handler覆寫單一網址之回應
export function makeFetch(contents, { delayMs = 0, handler = null } = {}) {
    let calls = []
    let fn = async (url) => {
        calls.push(url)
        if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
        if (handler) {
            let r = await handler(url, calls.filter((c) => c === url).length)
            if (r !== undefined) {
                return r
            }
        }
        if (!(url in contents)) {
            return new Response(null, { status: 404, statusText: 'Not Found' })
        }
        return new Response(contents[url], { status: 200 })
    }
    fn.calls = calls
    return fn
}

//每個測試一個乾淨資料夾(test/_tmp/<案名>/<序號>), 內含cache與cwd(空資料夾, 非開發repo)
let _seq = 0
export function makeSandbox(caseName) {
    _seq += 1
    let root = path.join(tmpRoot, caseName, `${process.pid}-${_seq}`)
    let cache = path.join(root, 'cache')
    let cwd = path.join(root, 'cwd')
    fs.mkdirSync(cache, { recursive: true })
    fs.mkdirSync(cwd, { recursive: true })
    return { root, cache, cwd, env: { WMOUSEKEY_CACHE_DIR: cache } }
}

export function removeDir(fd) {
    fs.rmSync(fd, { recursive: true, force: true })
}

//把假內容預先放進快取目錄
export function seedCache(sb, fake, groupName, names = null) {
    let g = fake.manifest.groups[groupName]
    let dir = path.join(sb.cache, fake.manifest.commit.slice(0, 12), g.dir)
    fs.mkdirSync(dir, { recursive: true })
    for (let name of Object.keys(g.files)) {
        if (names && !names.includes(name)) {
            continue
        }
        fs.writeFileSync(path.join(dir, name), fake.contents[`${fake.manifest.rawBase}${g.dir}/${name}`])
    }
    return dir
}

export function cacheDirOf(sb, fake, groupName) {
    return path.join(sb.cache, fake.manifest.commit.slice(0, 12), fake.manifest.groups[groupName].dir)
}

export function listDir(fd) {
    try {
        return fs.readdirSync(fd).sort()
    }
    catch (err) {
        return []
    }
}
