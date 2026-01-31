import rec from './src/recScp.mjs'


let main = async () => {
    await rec(`./script.json`)
}
main()
    .catch((err) => {
        console.log(err)
    })

//node g_rec.mjs
