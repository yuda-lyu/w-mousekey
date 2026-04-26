// xdotool風格按鍵組合語法 → AHK Send語法
// 範例:
//   'ctrl+v'      -> '^v'
//   'ctrl+shift+t' -> '^+t'
//   'alt+F4'      -> '!{F4}'
//   'Return'      -> '{Enter}'
//   'super+l'     -> '#l'

let MODIFIERS = {
    'ctrl': '^',
    'control': '^',
    'control_l': '^',
    'control_r': '^',
    'shift': '+',
    'shift_l': '+',
    'shift_r': '+',
    'alt': '!',
    'alt_l': '!',
    'alt_r': '!',
    'super': '#',
    'super_l': '#',
    'super_r': '#',
    'meta': '#',
    'win': '#',
}

let SPECIALS = {
    'return': 'Enter',
    'enter': 'Enter',
    'tab': 'Tab',
    'escape': 'Escape',
    'esc': 'Escape',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'del': 'Delete',
    'insert': 'Insert',
    'ins': 'Insert',
    'home': 'Home',
    'end': 'End',
    'page_up': 'PgUp',
    'pageup': 'PgUp',
    'prior': 'PgUp',
    'page_down': 'PgDn',
    'pagedown': 'PgDn',
    'next': 'PgDn',
    'up': 'Up',
    'down': 'Down',
    'left': 'Left',
    'right': 'Right',
    'space': 'Space',
    'caps_lock': 'CapsLock',
    'capslock': 'CapsLock',
    'num_lock': 'NumLock',
    'numlock': 'NumLock',
    'print': 'PrintScreen',
    'printscreen': 'PrintScreen',
    'pause': 'Pause',
}

//F1~F24
for (let i = 1; i <= 24; i++) {
    SPECIALS[`f${i}`] = `F${i}`
}


function xdotoolToAhk(input) {
    if (typeof input !== 'string' || input.length === 0) {
        throw new Error(`xdotoolToAhk: invalid input: ${input}`)
    }

    let tokens = input.split('+').map((t) => t.trim()).filter((t) => t.length > 0)
    if (tokens.length === 0) {
        throw new Error(`xdotoolToAhk: empty input`)
    }

    let mainKey = tokens[tokens.length - 1]
    let mods = tokens.slice(0, -1)

    let prefix = ''
    for (let m of mods) {
        let p = MODIFIERS[m.toLowerCase()]
        if (!p) {
            throw new Error(`xdotoolToAhk: unknown modifier: ${m}`)
        }
        prefix += p
    }

    let mainAhk
    if (mainKey.length === 1) {
        //單ASCII字元(英數符號), 直接使用
        mainAhk = mainKey
    }
    else {
        let special = SPECIALS[mainKey.toLowerCase()]
        if (special) {
            mainAhk = `{${special}}`
        }
        else {
            //未知多字元名稱, 包進大括號讓AHK嘗試解析
            mainAhk = `{${mainKey}}`
        }
    }

    return prefix + mainAhk
}


let obj = {
    xdotoolToAhk,
}


export default obj
