import runScp from './src/runScp.mjs'


let main = async () => {
    // await runScp(`./script_steps.json`)
    // await runScp(`./script_p1_steps.json`)
    // await runScp(`./script_p2_steps.json`)
    await runScp(`./script_inf_steps.json`)
}
main()
    .catch((err) => {
        console.log(err)
    })

//node g_run.mjs
