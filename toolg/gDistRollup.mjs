import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


rollupFiles({
    fns: 'WMousekey.mjs',
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        'path': 'path',
        'fs': 'fs',
        'os': 'os',
        'child_process': 'child_process',
        'util': 'util',
        '@techstark/opencv-js': '@techstark/opencv-js',
        'screenshot-desktop': 'screenshot-desktop',
        'sharp': 'sharp',
    },
    external: [
        'path',
        'fs',
        'os',
        'child_process',
        'util',
        '@techstark/opencv-js',
        'screenshot-desktop',
        'sharp',
    ],
})

