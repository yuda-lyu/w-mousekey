import sc from './src/screen.mjs'


async function main() {

    //screenSave
    await sc.screenSave(0, 0, 600, 1000, './ztest.png')

}

main()

//node g.test_screen.mjs
