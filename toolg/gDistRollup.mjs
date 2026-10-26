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
        'crypto': 'crypto',
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
        'crypto',
        '@techstark/opencv-js',
        'screenshot-desktop',
        'sharp',
    ],
})

