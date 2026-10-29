//測試用替身: 取代AutoHotkey64.exe與screenCapture exe被啟動(以node執行本檔), 不產生任何桌面副作用
//截圖exe之唯一參數為輸出png路徑, 替身寫入一小段內容供截圖流程讀取; 其餘情形(AutoHotkey)什麼都不做, 結束碼0
import fs from 'fs'


let args = process.argv.slice(2)
if (args.length === 1 && args[0].endsWith('.png')) {
    fs.writeFileSync(args[0], Buffer.from('stub-screen-capture'))
}
