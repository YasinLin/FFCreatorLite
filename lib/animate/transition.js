'use strict';

/**
 * FFTransition - Class used to handle scene transition animation
 *
 * ####Example:
 *
 *     const transition = new FFTransition({ name, duration, params });
 *     // https://trac.ffmpeg.org/wiki/Xfade
 *
 * @object
 */
const path = require('node:path');
const FFBase = require('../core/base');
const DateUtil = require('../utils/date');
const fs = require('node:fs');

class FFTransition extends FFBase {
  constructor(conf) {
    super({ type: 'transition', ...conf });

    const { name = 'fade', duration = 600 } = this.conf;
    this.name = name;
    this.offset = 0;
    this.duration = DateUtil.toSeconds(duration);
  }

  /**
   * Converted to ffmpeg command line parameters
   * @private
   */
  toFilter(aoffset) {
    const { offset, duration, name } = this;
    const file_path = `'${path.resolve(
      path.dirname(__filename),
      'transitions/' + name + '.glsl',
    )}'`;
    const isFile = false;
    const isDir = false;
    try {
      const stat = fs.statSync(file_path);
      isFile = stat.isFile();
      isDir = stat.isDirectory();
    } catch (ex) {}
    if (isDir) {
      file_path = path.resolve(file_path, 'transitions/' + name + '.glsl');
    }
    return {
      filter: 'gltransition',
      options: {
        source: file_path,
        duration,
        offset: offset + aoffset,
      },
    };
  }

  /**
   * Converted to ffmpeg command line parameters
   * @private
   */
  // toFilter(aoffset) {
  //   const { offset, duration, name } = this;
  //   return {
  //     filter: 'xfade',
  //     options: {
  //       transition: name,
  //       duration,
  //       offset: offset + aoffset,
  //     },
  //   };
  // }

  destroy() {}
}

module.exports = FFTransition;
