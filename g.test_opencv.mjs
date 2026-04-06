import cvModule from '@techstark/opencv-js'

//使用@techstark/opencv-js(基於WASM), 不需要本機安裝OpenCV, 不受Node.js版本限制
//安裝: npm i @techstark/opencv-js

async function getCv() {
    let cv
    if (cvModule instanceof Promise) {
        cv = await cvModule
    }
    else if (cvModule.Mat) {
        //WASM已初始化完成, 直接使用
        cv = cvModule
    }
    else {
        await new Promise((resolve) => {
            cvModule.onRuntimeInitialized = () => resolve()
        })
        cv = cvModule
    }
    return { cv }
}

async function main() {
    let { cv } = await getCv()

    let mat = new cv.Mat(3, 3, cv.CV_8UC1)
    console.log('Mat created:', mat.rows, 'x', mat.cols)
    mat.delete()

    console.log('OpenCV.js build info:', cv.getBuildInformation ? 'available' : 'N/A')

    console.log('OpenCV.js is ready')

    // process.exit(0)
}

main()

//node g.test_opencv.mjs
