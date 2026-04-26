import assert from 'assert'
import ks from '../src/keySyntax.mjs'


describe('keySyntax.xdotoolToAhk', function () {

    it('單字元', function () {
        assert.strictEqual(ks.xdotoolToAhk('a'), 'a')
        assert.strictEqual(ks.xdotoolToAhk('Z'), 'Z')
        assert.strictEqual(ks.xdotoolToAhk('1'), '1')
    })

    it('ctrl+v -> ^v', function () {
        assert.strictEqual(ks.xdotoolToAhk('ctrl+v'), '^v')
    })

    it('ctrl+shift+t -> ^+t', function () {
        assert.strictEqual(ks.xdotoolToAhk('ctrl+shift+t'), '^+t')
    })

    it('alt+F4 -> !{F4}', function () {
        assert.strictEqual(ks.xdotoolToAhk('alt+F4'), '!{F4}')
    })

    it('Return -> {Enter}', function () {
        assert.strictEqual(ks.xdotoolToAhk('Return'), '{Enter}')
    })

    it('Enter -> {Enter}', function () {
        assert.strictEqual(ks.xdotoolToAhk('Enter'), '{Enter}')
    })

    it('Escape / Esc -> {Escape}', function () {
        assert.strictEqual(ks.xdotoolToAhk('Escape'), '{Escape}')
        assert.strictEqual(ks.xdotoolToAhk('Esc'), '{Escape}')
    })

    it('BackSpace / Delete', function () {
        assert.strictEqual(ks.xdotoolToAhk('BackSpace'), '{Backspace}')
        assert.strictEqual(ks.xdotoolToAhk('Delete'), '{Delete}')
    })

    it('方向鍵', function () {
        assert.strictEqual(ks.xdotoolToAhk('Up'), '{Up}')
        assert.strictEqual(ks.xdotoolToAhk('Down'), '{Down}')
        assert.strictEqual(ks.xdotoolToAhk('Left'), '{Left}')
        assert.strictEqual(ks.xdotoolToAhk('Right'), '{Right}')
    })

    it('super/win修飾鍵', function () {
        assert.strictEqual(ks.xdotoolToAhk('super+l'), '#l')
        assert.strictEqual(ks.xdotoolToAhk('win+r'), '#r')
    })

    it('Page_Up / Page_Down -> {PgUp} / {PgDn}', function () {
        assert.strictEqual(ks.xdotoolToAhk('Page_Up'), '{PgUp}')
        assert.strictEqual(ks.xdotoolToAhk('Page_Down'), '{PgDn}')
    })

    it('F1 ~ F24', function () {
        assert.strictEqual(ks.xdotoolToAhk('F1'), '{F1}')
        assert.strictEqual(ks.xdotoolToAhk('F24'), '{F24}')
    })

    it('組合鍵+特殊鍵', function () {
        assert.strictEqual(ks.xdotoolToAhk('ctrl+Return'), '^{Enter}')
        assert.strictEqual(ks.xdotoolToAhk('ctrl+shift+Tab'), '^+{Tab}')
    })

    it('未知modifier拋錯', function () {
        assert.throws(() => ks.xdotoolToAhk('xyz+v'), /unknown modifier/)
    })

    it('空字串/非字串拋錯', function () {
        assert.throws(() => ks.xdotoolToAhk(''))
        assert.throws(() => ks.xdotoolToAhk(null))
        assert.throws(() => ks.xdotoolToAhk(undefined))
    })

})
