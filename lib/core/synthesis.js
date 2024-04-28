'use strict';

/**
 * Synthesis - A class for video synthesis.
 * Mainly rely on the function of ffmpeg to synthesize video and audio.
 *
 * ####Example:
 *
 *     const synthesis = new Synthesis(conf);
 *     synthesis.start();
 *
 *
 * @class
 */
const path = require('path');
const rmfr = require('rmfr');
const { promisify } = require('util');
const fs = require('fs-extra');
const FFBase = require('./base');
const isEmpty = require('lodash/isEmpty');
const forEach = require('lodash/forEach');
const some = require('lodash/some');
const Utils = require('../utils/utils');
const ScenesUtil = require('../utils/scenes');
const FFmpegUtil = require('../utils/ffmpeg');
const FilterUtil = require('../utils/filter');
const FFContext = require('../core/context');
const writeFileAsync = promisify(fs.writeFile);

class Synthesis extends FFBase {
  constructor(creator) {
    super({ type: 'synthesis' });

    this.creator = creator;
    this.conf = creator.rootConf();
    this.inputOptions = [];
    this.outputOptions = [];
    this.filters = [];
    this.duration = 0;
    this.txtpath = '';
    this.context = new FFContext();
    const threads = this.conf.getVal('threads');
    this.command = FFmpegUtil.createCommand({ threads });
  }

  /**
   * Set the ffcreator total duration
   * @param {number} duration - total duration time
   * @public
   */
  setDuration(duration) {
    this.duration = duration;
  }

  /**
   * Open ffmpeg production and processing
   * @public
   */
  async start() {
    const { creator, conf } = this;
    const upStreaming = conf.getVal('upStreaming');

    if (upStreaming) {
      this.liveOutput();
    } else if (ScenesUtil.isSingle(creator)) {
      this.mvOutput();
    } else {
      if (ScenesUtil.hasTransition(creator) && creator.scenes.length > 1) {
        ScenesUtil.fillTransition(creator);
        this.addXfadeInput();
        // 转场后音频需要单独重新处理
        this.addAudioFilter();
        if (this.filters && this.filters.length) {
          this.command.complexFilter(this.filters, this.context.input);
        }
      } else {
        await this.addConcatInput();
      }
      this.addOutputOptions();
      this.addCommandEvents();
      this.addOutput();
      this.command.run();
    }
  }

  liveOutput() {
    const { conf } = this;
    const output = conf.getVal('output');
    this.emits({ type: 'synthesis-complete', path: output, output });
  }

  /**
   * Produce final documents and move and save
   * @private
   */
  async mvOutput() {
    const { conf, creator } = this;
    const { scenes } = creator;

    const scene = scenes[0];
    const cacheFile = scene.getFile();
    const output = conf.getVal('output');
    await fs.move(cacheFile, output);

    const debug = conf.getVal('debug');
    if (!debug) this.deleteCacheFile();

    this.emits({ type: 'synthesis-complete', path: output, output });
  }

  /**
   * add audios to ffmpeg config
   * @public
   */
  addAudios(audios) {
    if (isEmpty(audios)) return;

    this.audios = audios;
  }

  /**
   * Add one or more background sounds
   * ##Note: Usage of adelay/volume filter
   * [1]adelay=5000|5000,volume=1[a];
   * [2]adelay=10000|10000,volume=10[b];
   * [3]adelay=15000|15000,volume=2[c];
   * [a][b][c]amix=3[a]
   * @param {array} audios - background sounds
   * @private
   */
  addAudioFilter() {
    const { conf, audios, duration, creator } = this;
    if (isEmpty(audios)) return;
    const { command } = this;
    forEach(audios, audio => {
      audio.addInput(command);
      this.inputCount++;
    });

    const normalizeAudio = conf.getVal('normalizeAudio');
    const length = audios.length;
    let outputs = '';
    let scenes_size = ScenesUtil.getLength(creator);

    forEach(audios, (audio, index) => {
      const output = `audio${scenes_size - 1 + index}`;
      const audioCommand = audio.toFilterCommand({ index: scenes_size - 1 + index, duration });
      this.filters.push(audioCommand);
      outputs += `[${output}]`;
    });

    if (normalizeAudio) {
      this.filters.push(`${outputs}amix=inputs=${length}:normalize=0[audio]`);
    } else {
      this.filters.push(`${outputs}amix=${length}[audio]`);
    }

    if (this.context.input) {
      this.filters.push(`[${this.context.input}][audio]concat=n=1:v=1:a=1[output]`);
      this.context.input = 'output';
    } else {
      this.filters.push(`[0][audio]concat=n=1:v=1:a=1[output]`);
      this.context.input = 'output';
    }
  }

  /**
   * add input by xfade filter i case
   * @private
   */
  addXfadeInput() {
    const { scenes } = this.creator;
    let filter = '';

    forEach(scenes, (scene, index) => {
      const file = scene.getFile();
      this.command.addInput(file);
      this.inputCount++;

      // if (index >= scenes.length - 1) return;
      filter +=
        '[' +
        index +
        ':v]split[' +
        index +
        'split0][' +
        index +
        'split1];' +
        '[' +
        index +
        'split0]trim=0:' +
        (scene.duration - 1) +
        '[' +
        index +
        'trim0];' +
        '[' +
        index +
        'split1]trim=' +
        (scene.duration - 1) +
        ':' +
        scene.duration +
        '[' +
        index +
        'trim1_tmp];' +
        '[' +
        index +
        'trim1_tmp]setpts=PTS-STARTPTS[' +
        index +
        'trim1];';
    });
    forEach(scenes, (scene, index) => {
      if (index>0){
        const f = scene.toTransFilter(0);
        f.inputs = [index - 1 + 'trim1', index + 'trim0'];
        f.outputs = [index + 'trans'];
        filter +=
          FilterUtil.makeFilterStrings([
            f,
            // `[${index + 'trans'}]scale=${scene.conf.w}*${scene.conf.h}[${index + 'scale'}]`,
          ]) + ';';
      }
    });
    forEach(scenes, (scene, index) => {
      if (index == 0) {
        filter += '[' + index + 'trim0]';
      } else {
        filter += '[' + index + 'trans]';
      }
      if (index == scenes.length - 1) {
        filter += '[' + index + 'trim1]';
        filter += 'concat=n=' + (scenes.length + 1) + '[gl]';
      }
    });
    this.filters.push(filter);
    this.context.input = 'gl';
  }

  /**
   * add input by concat multiple videos case
   * @private
   */
  async addConcatInput() {
    // create path txt
    const { creator } = this;
    const cacheDir = creator.rootConf('cacheDir').replace(/\/$/, '');
    this.txtpath = path.join(cacheDir, `${Utils.uid()}.txt`);

    let text = '';
    forEach(creator.scenes, scene => (text += `file '${scene.getFile()}'\n`));
    await writeFileAsync(this.txtpath, text, {
      encoding: 'utf8',
    });

    // Add the intermediate pictures processed in the cache directory to ffmpeg input
    this.command.addInput(this.txtpath);
    this.inputCount += creator.scenes.length;
    this.command.inputOptions(['-f', 'concat', '-safe', '0']);
  }

  /**
   * Get default ffmpeg output configuration
   * @private
   */
  getDefaultOutputOptions() {
    const { conf } = this;
    const fps = conf.getVal('fps');
    const crf = conf.getVal('crf');
    const opts = []
      // misc
      .concat([
        '-hide_banner', // hide_banner - parameter, you can display only meta information
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
      ])

      // video
      .concat([
        // '-c',
        // 'copy',
        '-c:v',
        'libx264', // c:v - H.264
        '-profile:v',
        'main', // profile:v - main profile: mainstream image quality. Provide I / P / B frames
        '-preset',
        'medium', // preset - compromised encoding speed
        '-crf',
        crf, // crf - The range of quantization ratio is 0 ~ 51, where 0 is lossless mode, 23 is the default value, 51 may be the worst
        '-movflags',
        'faststart',
        '-pix_fmt',
        'yuv420p',
        '-r',
        fps,
      ]);

    return opts;
  }

  /**
   * Add ffmpeg output configuration
   * @private
   */
  addOutputOptions() {
    const { conf, audios, duration } = this;
    const defaultOutputOptions = conf.getVal('defaultOutputOptions');

    // custom
    const customOpts = conf.getVal('outputOptions');
    if (customOpts) FFmpegUtil.concatOpts(this.outputOptions, customOpts);

    // default
    const defaultOpts = this.getDefaultOutputOptions(defaultOutputOptions);
    if (defaultOutputOptions) FFmpegUtil.concatOpts(this.outputOptions, defaultOpts);

    // audios
    if (!isEmpty(audios)) {
      FFmpegUtil.concatOpts(this.outputOptions, ['-c:a', 'aac']);
    }

    this.command.outputOptions(this.outputOptions);

    // set max duration
    this.command.setDuration(duration);
  }

  /**
   * Set ffmpeg input path
   * @private
   */
  addOutput() {
    const { conf } = this;
    const output = conf.getVal('output');
    const dir = path.dirname(output);
    fs.ensureDir(dir);
    this.command.output(output);
  }

  /**
   * Add FFmpeg event to command
   * @private
   */
  addCommandEvents() {
    const { conf, command, creator } = this;
    const totalFrames = creator.getTotalFrames();
    const debug = conf.getVal('debug');

    // start
    command.on('start', commandLine => {
      const log = conf.getVal('log');
      if (log) console.log(commandLine);
      this.emits({ type: 'synthesis-start', command: commandLine });
    });

    // progress
    command.on('progress', progress => {
      const percent = progress.frames / totalFrames;
      this.emits({ type: 'synthesis-progress', percent });
    });

    // complete
    command.on('end', () => {
      if (!debug) this.deleteCacheFile();
      const output = conf.getVal('output');
      this.emits({ type: 'synthesis-complete', path: output, output });
    });

    // error
    command.on('error', (error, stdout, stderr) => {
      if (!debug) this.deleteCacheFile();
      // const log = conf.getVal('log');
      // if (logFFmpegError)

      this.emits({
        type: 'synthesis-error',
        error: `${error} \n stdout: ${stdout} \n stderr: ${stderr}`,
        pos: 'Synthesis',
      });
    });
  }

  deleteCacheFile() {
    if (this.txtpath) rmfr(this.txtpath);
  }

  async destroy() {
    this.conf = null;
    this.creator = null;
    this.command = null;
    await super.destroy();
  }
}

module.exports = Synthesis;
