//R07接線測試(R-PW-WIRING): 本套件測試啟動瀏覽器之唯一入口test/tools/helper.mjs之launchBrowser, 確實經w-playwright, 送出之選項含守門
//以wpw.setBrowserTypeForTest之替身斷言(含替身確被呼叫); 另一案經next()走真路徑(完整流程後以headless shell實際啟動, 不啟動真Chrome/Edge/完整Chromium)
import assert from 'assert'
import wpw from 'w-playwright'
import { launchBrowser } from './tools/helper.mjs'

const GUARD = 'AutofillAiWalletPrivatePasses'

//功能開關名之集合(去前置*, 取<與:之前)
function featureNames(arg) {
    return new Set(arg.slice(arg.indexOf('=') + 1).split(',').map((s) => s.trim().replace(/^\*/, '').split(/[<:]/)[0]).filter((s) => s !== ''))
}

describe('R07: launchBrowser經w-playwright(接線)', function () {
    this.timeout(180000)

    let restore = null

    afterEach(function () {
        if (restore) {
            restore()
            restore = null
        }
    })

    it('R07-5 launchBrowser以有頭真Chrome之選項呼叫w-playwright, 送出之args含守門且恰一串--disable-features(最後一個元素)', async function () {
        //spec: 設計§5.1w-mousekey列(改用w-playwright之launchChromium, 選項headless為false且channel為chrome); 守門: 每次啟動恰一串--disable-features含Playwright預設與守門功能
        let seen = []
        let pageOpts = []
        let scripts = 0
        restore = wpw.setBrowserTypeForTest({
            launch: async (o) => {
                seen.push(o)
                return {
                    newPage: async (po) => {
                        pageOpts.push(po)
                        return {
                            addInitScript: async () => {
                                scripts++
                            },
                        }
                    },
                    close: async () => {},
                }
            },
        })
        let { browser, page } = await launchBrowser()
        assert(browser && page)

        //替身確被呼叫(依賴樹有兩份w-playwright時替身只作用於測試所引用之一份, 未斷言即可能空過)
        assert.strictEqual(seen.length, 1)
        let o = seen[0]
        assert.strictEqual(o.headless, false)
        assert.strictEqual(o.channel, 'chrome')

        //恰一串--disable-features(開關名大小寫與單連字號之變體一併計入), 且為args最後一個元素
        let dis = o.args.filter((a) => /^--?disable-features(=|$)/i.test(a))
        assert.strictEqual(dis.length, 1, JSON.stringify(o.args))
        assert.strictEqual(o.args[o.args.length - 1], dis[0])
        assert(dis[0].startsWith('--disable-features='))

        //集合 ⊇ Playwright預設 ∪ 守門
        let names = featureNames(dis[0])
        assert(names.has(GUARD))
        let info = wpw.getPlaywrightInfo()
        assert(info.defaultDisableFeatures.length > 0)
        for (let n of info.defaultDisableFeatures) {
            assert(names.has(n), `缺Playwright預設之${n}`)
        }

        //Playwright預設之那一串被去掉(ignoreDefaultArgs含一個--disable-features=開頭之項)
        assert(Array.isArray(o.ignoreDefaultArgs))
        assert(o.ignoreDefaultArgs.some((a) => a.startsWith('--disable-features=')))

        //頁面選項不變(本檔既有: 800x400, dsf 1), 並注入事件紀錄器
        assert.deepStrictEqual(pageOpts, [{ viewport: { width: 800, height: 400 }, deviceScaleFactor: 1 }])
        assert.strictEqual(scripts, 1)
        await browser.close()
    })

    it('R07-6 真路徑: 經next()走w-playwright完整流程(環境、版本、守門、合併)後以headless shell實際啟動, 頁面可用且事件紀錄器已注入', async function () {
        //spec: R-PW-WIRING至少一案不用替身處理選項(以next(o)走真Playwright); 不啟動真Chrome/Edge/完整Chromium(headless shell本即不觸發LogonUser)
        try {
            await wpw.ensureChromium()
        }
        catch (err) {
            //無法取得受管瀏覽器(離線且未安裝): 明確略過並寫明原因, 不當成通過
            this.skip()
        }
        let seen = []
        restore = wpw.setBrowserTypeForTest({
            launch: async (o, next) => {
                seen.push(o)
                return next({ ...o, headless: true, channel: undefined })
            },
        })
        let { browser, page } = await launchBrowser()
        try {
            assert.strictEqual(seen.length, 1) //替身確被呼叫
            assert(browser.isConnected())
            await page.goto('data:text/html,<div id="a">ok</div>')
            assert.strictEqual(await page.evaluate(() => document.getElementById('a').textContent), 'ok')
            assert.strictEqual(await page.evaluate(() => Array.isArray(window.__mkEv)), true)
        }
        finally {
            await browser.close()
        }
    })

})
