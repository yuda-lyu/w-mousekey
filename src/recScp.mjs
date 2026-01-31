import { spawn } from 'child_process'
import get from 'lodash-es/get.js'
import split from 'lodash-es/split.js'
import size from 'lodash-es/size.js'
import cint from 'wsemi/src/cint.mjs'
import fsWriteJson from 'wsemi/src/fsWriteJson.mjs'
import getAhk from './getAhk.mjs'


//getAhk
let ak = getAhk()

let recScp = async (fp) => {

    let child = spawn(ak.ahkExePath, ['/force', ak.ahkScriptPathRecord])

    let steps = []
    let lastTime = Date.now()

    child.stdout.on('data', (data) => {
        // console.log('data', data)
        let text = data.toString().trim()
        // console.log('text', text)
        let lines = text.split('\\')
        for (let line of lines) {
            if (line.startsWith('Click')) {
                // console.log('line', line)
                let parts = split(line, ' ')
                // console.log('parts', parts)
                if (size(parts) >= 3) {
                    let x = cint(get(parts, 1))
                    let y = cint(get(parts, 2))
                    let now = Date.now()
                    let delay = now - lastTime
                    lastTime = now
                    let step = { x, y, delay }
                    steps.push(step)
                    console.log(`recorded: click at (${x}, ${y}), delay: ${delay}ms`)
                }
            }
        }
    })

    child.stderr.on('data', (data) => {
        console.error('AHK Error:', data.toString())
    })

    //監聽中止(Ctrl+C)事件
    process.on('SIGINT', async () => {
        console.log('\nstopping recording...')

        //kill
        child.kill()

        //fsWriteJson
        fsWriteJson(fp, { steps }, { useFormat: true })

        //exit
        process.exit(0)

    })

    //強制等待, 須通過process.exit停止
    await new Promise(() => { })

}


export default recScp
