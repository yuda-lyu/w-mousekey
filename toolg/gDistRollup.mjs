import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import getFiles from 'w-package-tools/src/getFiles.mjs'


let fdSrc = './src'
let fdTar = './dist'


rollupFiles({
    fns: getFiles(fdSrc),
    fdSrc,
    fdTar,
    nameDistType: 'kebabCase',
    globals: {
        'path': 'path',
        'fs': 'fs',
        'os': 'os',
        'child_process': 'child_process',
        'util': 'util',
        '@u4/opencv4nodejs': '@u4/opencv4nodejs',
        'screenshot-desktop': 'screenshot-desktop',
        'sharp': 'sharp',
    },
    external: [
        'path',
        'fs',
        'os',
        'child_process',
        'util',
        '@u4/opencv4nodejs',
        'screenshot-desktop',
        'sharp',
    ],
})

