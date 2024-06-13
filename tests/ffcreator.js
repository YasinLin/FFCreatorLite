const { FFExector } = require('../lib');
const colors = require('colors');
const path = require("path");
const fs = require('fs');
const cacheDir = path.join(__dirname, './cache/');
const outputDir = path.join(__dirname, './output/');

const vs = new FFExector({
  render: 'gl',
  ffmpeg: '/Users/yasin/Library/Application Support/woqi-pc/VideoSDK/ffmpeg',
  ffprobe: '/Users/yasin/Library/Application Support/woqi-pc/VideoSDK/ffprobe',
  cacheDir,
  outputDir,
});
vs.on('start', () => {
  console.log(`FFExector start`);
});

vs.on('error', e => {
  console.error(e,colors.red(`FFExector error: ${e.error}`));
});

vs.on('progress', e => {
  console.log(colors.yellow(`FFExector progress: ${(e.percent * 100) >> 0}%`));
});

vs.on('complete', e => {
  console.log(colors.magenta(`FFExector completed: \n USEAGE: ${vs.time} \n PATH: ${e.output} `));
});
const file = fs.readFileSync(path.resolve(__dirname, './test.json'));
vs.sync(JSON.parse(file));
