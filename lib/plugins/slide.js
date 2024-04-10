'use strict';

/**
 * FFVideoAlbum - A Videos Album component that supports multiple switching animation effects
 *
 * ####Example:
 *
 *     const album = new FFVideoAlbum({
 *        list: [v01, v01, v01, v01],
 *        x: 100,
 *        y: 100,
 *        width: 500,
 *        height: 300
 *    });
 *
 *
 * @class
 */
const FS = require('../utils/fs');
const fs = require('fs');
const FFCreator = require('../creator');
const FFVideo = require('../node/video');

class FFSlide extends FFVideo {
  constructor(conf = {}) {
    super({ ...conf });

    this.creator = new FFCreator({ ...conf });
    this.creator_destroy = this.creator.destroy;
    this.creator.destroy = () => {};
    this.step = conf.step || 1;
  }

  /**
   * Get the path to get the Image
   * @return {string} img path
   * @public
   */
  getPath() {
    return this.conf.path;
  }

  async gen_video() {
    this.creator.inCenter = true;
    this.creator.generateOutput();

    return new Promise((resolve, reject) => {
      this.creator.on('start', () => {
        // console.log(`FFCreator start`);
      });
      this.creator.on('error', err => {
        reject(err);
      });
      this.creator.on('progress', () => {
        // this.emitProgress({ percent:e.percent });
        // console.log(colors.yellow(`FFCreator progress: ${(e.percent * 100) >> 0}%`));
        if (this.creator.renderer.synthesis) {
          this.conf.path = this.creator.renderer.synthesis.getOutputPath('cur');
        }
      });
      this.creator.on('complete', e => {
        // console.log(
        //   colors.magenta(`FFCreator completed: \n USEAGE: ${e.useage} \n PATH: ${e.output} `),
        // );
        // console.log(colors.green(`\n --- You can press the s key or the w key to restart! --- \n`));
        this.conf.path = e.output;
        resolve(e.output);
      });
      this.creator.start();
    });
  }

  isReady() {
    return this.gen_video();
  }

  addInput(command) {
    super.addInput(command)
  }

  destroy() {
    // console.log('开始清理工作空间');
    try {
      const cache_dir = this.creator.rootConf('detailedCacheDir');
      FS.rmDir(cache_dir);
      // 视频要清除
      if (this.conf.path) {
        FS.rmDir(this.conf.path);
      }
    } catch (err) {}
    super.destroy();
    this.creator.destroy = this.creator_destroy;
    this.creator.destroy();
    this.creator_destroy = null;
    this.creator = null;
  }
}

module.exports = FFSlide;
