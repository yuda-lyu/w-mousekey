import fs from 'fs'
import JSON5 from 'json5'


let getSettings = () => {
    let fp = './setting.json'
    let s = {}
    try {
        let j = fs.readFileSync(fp, 'utf8')
        s = JSON5.parse(j)
    }
    catch (err) {}
    return s
}


export default getSettings
