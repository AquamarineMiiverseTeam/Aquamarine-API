//thank you pretendo for the decoding

const pako = require('pako')
const TGA = require('tga')
const PNG = require('pngjs').PNG
const BMP = require('bmp-js')
const zlib = require('zlib')

const jpegLib = require('jpeg-js')
const JIMP = require('jimp')

const util = require('util')

const fs = require('fs')

function decodeParamPack(input) {
    let base64Result = Buffer.from(input, 'base64').toString();

    base64Result = base64Result.slice(1, -1).split("\\");

    const out = {};
    for (let i = 0; i < base64Result.length; i += 2) {
        out[base64Result[i].trim()] = base64Result[i + 1].trim();
    }
    return out;
}

function paintingProccess(painting, platform) {
    let paintingBuffer = Buffer.from(painting, 'base64');
    let output = '';
    try {
        output = pako.inflate(paintingBuffer);
    }
    catch (err) {
        console.error(err);
    }
    if (output[0] === 66) {
        const bitmap = BMP.decode(Buffer.from(output));
        const png = new PNG({
            width: bitmap.width,
            height: bitmap.height
        });

        const bpmBuffer = bitmap.getData();
        bpmBuffer.swap32();
        png.data = bpmBuffer;
        for (let i = 3; i < bpmBuffer.length; i += 4) {
            bpmBuffer[i] = 255;
        }
        return PNG.sync.write(png);
    } else {
        const tga = new TGA(Buffer.from(output));
        const png = new PNG({
            width: tga.width,
            height: tga.height
        });

        png.data = Buffer.from(tga.pixels);
        return PNG.sync.write(png);
    }
}

function decodeIcon(icon) {
    const icon2 = Buffer.from(icon, 'base64')

    var output = ''

    try {
        output = zlib.inflateSync(icon2)
    } catch (error) {
        console.log(error)
    }

    let tga = new TGA(Buffer.from(output))

    fs.writeFileSync('icon.tga', output)
}


async function encodeIcon(id) {
    return new Promise((resolve, reject) => {
        try {
            JIMP.read(__dirname + `/../../CDN_Files/img/icons/${id}.jpg`).then((image, err) => {
                if (err) { reject() }

                //Making sure every icon is the correct resolution.
                image.resize(128, 128);

                const tga = TGA.createTgaBuffer(image.bitmap.width, image.bitmap.height, image.bitmap.data)

                resolve(Buffer.from(pako.deflate(tga)).toString("base64"))
            })
        }
        catch {
            JIMP.read(__dirname + `/../CDN_Files/img/icons/default.jpg`).then((image, err) => {
                if (err) { reject() }

                const tga = TGA.createTgaBuffer(image.bitmap.width, image.bitmap.height, image.bitmap.data)

                resolve(Buffer.from(pako.deflate(tga)).toString("base64"))
            })
        }
    });
}

async function decodeIcon(icon) {
    let buffer = Buffer.from(icon, 'base64');
    let output = '';
    try {
        output = pako.inflate(buffer);
    }
    catch (err) {
        console.error(err);
    }
    const tga = new TGA(Buffer.from(output));

    const new_jpg = await new JIMP(tga.width, tga.height);
    new_jpg.bitmap.data = tga.pixels;

    return new_jpg.getBase64Async("image/jpeg")
}

module.exports = { decodeParamPack, paintingProccess, decodeIcon, encodeIcon }