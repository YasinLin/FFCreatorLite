'use strict';

/**
 * FFVideo - Video component-based display component
 *
 * ####Example:
 *
 *     const video = new FFVideo({ path, width: 500, height: 350, loop: true });
 *     scene.addChild(video);
 *
 *
 * @class
 */
const FFNode = require('./node');
const DateUtil = require('../utils/date');

class FFAudio extends FFNode {
  constructor(conf) {
    super({ type: 'audio' });
    this.hasInput = true;

    conf = typeof conf === 'string' ? { path: conf } : conf;
    const {
      src,
      bg = false,
      path,
      loop = false,
      start,
      duration = -1,
      startTime,
      volume = -1,
      fadeIn = -1,
      fadeOut = -1,
      ss = -1,
      to = -1,
    } = conf;

    this.bg = bg;
    this.loop = loop;
    this.volume = volume;
    this.path = path || src;
    this.start = start || startTime || 0;
    this.fadeIn = fadeIn;
    this.fadeOut = fadeOut;
    this.ss = ss;
    this.to = to;
    this.duration = duration;
  }

  setLoop(loop) {
    this.loop = loop;
  }

  setVolume(volume) {
    this.volume = volume;
  }

  setFadeIn(fadeIn) {
    this.fadeIn = fadeIn;
  }

  setFadeOut(fadeOut) {
    this.fadeOut = fadeOut;
  }

  setSs(ss) {
    this.ss = ss;
  }

  setTo(to) {
    this.to = to;
  }

  addInput(command) {
    const { loop, ss, to, path } = this;

    command.addInput(path);
    if (loop) command.inputOptions(['-stream_loop', '-1']);
    if (this.hasSSTO()) {
      const s = DateUtil.secondsToHms(ss);
      const t = DateUtil.secondsToHms(to);
      command.addInputOption('-ss', s);
      command.addInputOption('-to', t);
    }
  }

  hasSSTO() {
    const { ss, to } = this;
    if (ss && ss !== -1 && to && to !== -1) {
      return true;
    }

    return false;
  }

  toFilter() {
    const delay = this.toDelayFilter();
    const volume = this.toVolumeFilter();
    const fadeIn = this.toFadeInFilter();
    if (this.loop && this.parent) {
      this.duration = this.parent.duration;
    }
    const fadeOut = this.toFadeOutFilter(this.duration);

    return `${delay}${volume}${fadeIn}${fadeOut}`;
  }

  toDelayFilter() {
    const delay = this.start * 1000;
    return `adelay=${delay}|${delay}`;
  }

  toVolumeFilter() {
    const { volume = -1 } = this;
    if (volume === -1) return '';
    return `,volume=${volume}`;
  }

  toFadeInFilter() {
    const { fadeIn = -1, start = 0 } = this;
    if (fadeIn === -1) return '';
    return `,afade=t=in:st=${start}:d=${fadeIn}`;
  }

  toFadeOutFilter(duration) {
    const { fadeOut = -1 } = this;
    if (fadeOut === -1) return '';

    const start = Math.max(0, duration - fadeOut);
    return `,afade=t=out:st=${start}:d=${fadeOut}`;
  }

  getFId(k = false) {
    const vid = `${this.index}:a`;
    return k ? `[${vid}]` : `${vid}`;
  }

  addOptions(command) {
    const inputs = this.getInId();
    command.outputOptions(`-map ${inputs} -c:a aac -shortest`.split(' '));
  }

  concatFilters() {
    const filter = this.toFilter();
    if(filter){
      this.filters.push(filter);
    }
    return this.filters;
  }
}

module.exports = FFAudio;
