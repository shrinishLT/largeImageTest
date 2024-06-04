const compareImages = require('resemblejs/compareImages');
const fs = require("mz/fs");
const Jimp = require('jimp');
const mergeImg = require('merge-img');


const THRESHOLD = 4000

async function splitImage(image, segmentHeight) {
    const { width, height } = image.bitmap;
    const segments = [];
    const heights = [];

    for (let y = 0; y < height; y += segmentHeight) {
        const segment = image.clone().crop(0, y, width, Math.min(segmentHeight, height - y));
        const buffer = await segment.getBufferAsync(Jimp.MIME_PNG);
        segments.push(buffer);
        heights.push(Math.min(segmentHeight, height - y));
    }

    return {segments,heights};
}

async function compareTwoImages(index) {
    try {
        const options = {
            largeImageThreshold: 0,
        };

        const baseImagePath = `./images/base/base${index}.png`;
        const compareImagePath = `./images/compare/compare${index}.png`;

        const baseImage = await Jimp.read(baseImagePath);
        const compareImage = await Jimp.read(compareImagePath);

        const width = baseImage.bitmap.width;


        let baseSegments = [],compareSegments = [],outputSegments =[],baseHeights = [],compareHeights = [];

        if(baseImage.bitmap.height > THRESHOLD || compareImage.bitmap.height > THRESHOLD){

            let splitImageResults = await splitImage(baseImage, THRESHOLD);
            baseSegments = splitImageResults.segments;
            baseHeights = splitImageResults.heights;

            splitImageResults = await splitImage(compareImage, THRESHOLD);
            compareSegments = splitImageResults.segments;
            compareHeights = splitImageResults.heights;
        }
        else {
            baseSegments = [baseImage]
            compareSegments = [compareImage]
            baseHeights = [baseImage.bitmap.height]
            compareHeights = [compareImage.bitmap.height]
        }

        const maxSegments = Math.max(baseSegments.length, compareSegments.length);
        let totalPixels = 0,totalMismatchPixels=0;

        for (let i = 0; i < maxSegments; i++) {
            const baseSegment = baseSegments[i] || await createWhiteImage(width, compareHeights[i]);
            const compareSegment = compareSegments[i] || await createWhiteImage(width, baseHeights[i]);

            const compareResults = await compareImages(
                baseSegment,
                compareSegment,
                options
            );
            
            const segmentHeight = baseSegments[i] ? baseHeights[i] : compareHeights[i];
            const segmentPixels = segmentHeight * width;
            const mismatchPixels = (compareResults.misMatchPercentage / 100) * segmentPixels;
            totalMismatchPixels += mismatchPixels;
            totalPixels += segmentPixels;

            outputSegments.push(compareResults.getBuffer());
        }
        mergeImg(outputSegments,{direction:true})
        .then((img) => {
            img.write(`./images/output/output${index}.png`, () => console.log('done'));
        })
        .catch((err) => {
            console.log(err);
        })
        misMatchPercentage = (totalMismatchPixels / totalPixels) * 100;
        console.log(`Mismatch Percentage: ${misMatchPercentage}`);
    } catch (error) {
        console.error('Error comparing images:', error);
    }
}

async function createWhiteImage(width, height) {
    const whiteImage = new Jimp(width, height, 0xffffffff);
    return await whiteImage.getBufferAsync(Jimp.MIME_PNG);
}

compareTwoImages(1);


// ISSUES :
// empty images are filled with white pixels and can match and overall mismatch can be wrong 
// slow enough for large images that request might timeout and we need to use polling or something for results 