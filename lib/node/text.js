'use strict';

/**
 * FFText - Text component-based display component
 *
 * ####Example:
 *
 *     const text = new FFText({ text: "hello world", x: 400, y: 300 });
 *     text.setColor("#ffffff");
 *     text.setBackgroundColor("#000000");
 *     text.addEffect("fadeIn", 1, 1);
 *     scene.addChild(text);
 *
 * ####Note:
 *     fontfile - The font file to be used for drawing text.
 *     The path must be included. This parameter is mandatory if the fontconfig support is disabled.
 *
 * @class
 */
const forEach = require('lodash/forEach');
const FFNode = require('./node');
const Utils = require('../utils/utils');
const FilterUtil = require('../utils/filter');
const FFContext = require('../core/context');

/**
 * 给定一个点和一个旋转角度（弧度），计算并返回旋转后的坐标
 */
function rotatePoint(x, y, theta) {
  const xPrime = x * Math.cos(theta) - y * Math.sin(theta);
  const yPrime = x * Math.sin(theta) + y * Math.cos(theta);
  return { x: xPrime, y: yPrime };
}

/**
 * 对于给定的长方形左上角坐标、宽高和旋转角度（度），计算旋转后最左侧和最上侧顶点的坐标
 */
function findRotatedRectangleVertices(x, y, w, h, theta) {
  // 计算原始顶点坐标
  const vertices = [
    { x, y }, // 左上角
    { x: x + w, y }, // 右上角
    { x: x + w, y: y + h }, // 右下角
    { x, y: y + h }, // 左下角
  ];

  // 旋转每个顶点
  const rotatedVertices = vertices.map(v => rotatePoint(v.x, v.y, theta));

  // 找到最左侧和最上侧的点
  let mostLeft = rotatedVertices[0].x;
  let mostRight = rotatedVertices[0].x;
  let mostTop = rotatedVertices[0].y;
  let mostBottom = rotatedVertices[0].y;

  rotatedVertices.forEach(v => {
    if (v.x < mostLeft) {
      mostLeft = v.x;
    }
    if (v.y < mostTop) {
      mostTop = v.y;
    }
    if (v.x > mostRight) {
      mostRight = v.x;
    }
    if (v.y > mostBottom) {
      mostBottom = v.y;
    }
  });

  console.log(
    `After rotation:\nMost Left X: ${mostLeft.toFixed(2)}, Most Top Y: ${mostTop.toFixed(2)}`,
  );
  return { mostLeft, mostRight, mostTop, mostBottom };
}

class FFText extends FFNode {
  constructor(conf = { x: 0, y: 0, animations: [] }) {
    super({ type: 'text', ...conf });

    const {
      color = 'black',
      backgroundColor,
      fontSize = 24,
      text = '',
      font,
      fontfile,
      fontFamily,
    } = conf;

    this.text = text;
    this.fontcolor = color;
    this.fontsize = fontSize;
    this.boxcolor = backgroundColor;
    this.fontfile = font || fontFamily || fontfile;
  }

  /**
   * Set text value
   * @param {string} text - text value
   * @public
   */
  setText(text) {
    this.text = text;
  }

  /**
   * Set background color
   * @param {string} backgroundColor - the background color value
   * @public
   */
  setBackgroundColor(backgroundColor) {
    this.boxcolor = backgroundColor;
  }

  /**
   * Set text color value
   * @param {string} color - the text color value
   * @public
   */
  setColor(color) {
    this.fontcolor = color;
  }

  /**
   * Set text font file path
   * @param {string} file - text font file path
   * @public
   */
  setFontFile(file) {
    this.fontfile = file;
  }

  /**
   * Set text font file path
   * @param {string} file - text font file path
   * @public
   */
  setFont(file) {
    return this.setFontFile(file);
  }

  /**
   * Set text style by object
   * @param {object} style - style by object
   * @public
   */
  setStyle(style) {
    if (style.color) this.fontcolor = style.color;
    if (style.fill) this.fontcolor = style.fill;
    if (style.opacity) this.alpha = style.opacity;
    if (style.border) this.borderw = style.border;
    if (style.borderSize) this.borderw = style.borderSize;
    if (style.fontSize) this.fontsize = parseInt(style.fontSize);
    if (style.borderColor) this.bordercolor = style.borderColor;
    if (style.backgroundColor) this.boxcolor = style.backgroundColor;
    if (style.lineHeight) this.line_spacing = parseInt(style.lineHeight);
    if (style.shadow && style.shadow.offsetX) this.shadowx = style.shadow.offsetX;
    if (style.shadow && style.shadow.offsetY) this.shadowy = style.shadow.offsetY;
    if (style.shadow && style.shadow.color) this.shadowcolor = style.shadow.color;
  }

  /**
   * Set text border value
   * @param {number} borderSize - style border width size
   * @param {string} borderColor - style border color
   * @public
   */
  setBorder(borderSize, borderColor) {
    this.borderw = borderSize;
    this.bordercolor = borderColor;
  }

  /**
   * concatFilters - Core algorithm: processed into ffmpeg filter syntax
   * @param {object} context - context
   * @private
   */
  concatFilters(context) {
    const newContext = new FFContext();
    const filter = this.toFilter();
    if (filter) {
      this.preFilters.push(filter);
      // 3. add scale rotate filters
      if (this.rotate) {
        let rotate = this.rotate;
        let srFilter = `rotate=${rotate}:ow=${this.w}:oh=${this.h}:fillcolor=black@0`;
        this.preFilters.push(srFilter);
      }
    }

    this.animations.replaceEffectConfVal();
    this.filters = this.preFilters.concat(this.filters);
    this.filters = this.filters.concat(this.customFilters);
    const aniFilters = this.animations.concatFilters();
    this.resetXYByAnimations(aniFilters);
    this.resetAlphaByAnimations(aniFilters);

    this.addInputsAndOutputs(newContext);

    if (!FilterUtil.getOverlayFromFilters(this.filters)) {
      // 6. set overlay filter x/y
      const appearTime = this.appearTime || this.animations.getAppearTime();
      const duration = this.duration || this.animations.getDuration();
      const enable = FilterUtil.createFilterEnable({ appearTime, duration });
      let xyFilter = {
        filter: 'overlay',
        options: { x: this.x, y: this.y, enable },
      };
      this.genNewOutId();
      let outputs = this.getOutId();
      xyFilter = FilterUtil.setInputsAndOutputs({
        filter: xyFilter,
        inputs: newContext.input,
        outputs,
        contextInputs: context.input,
      });
      this.filters.push(xyFilter);
      context.input = this.getOutId();
    }
    return this.filters;
  }

  resetXYByAnimations(filters) {
    const { x, y } = this.getXYFromOverlay(filters);
    this.x = x;
    this.y = y;
  }

  resetAlphaByAnimations(filters) {
    const alpha = this.getAlphaFromFilters(filters);
    this.alpha = alpha;
  }

  getAlphaFromFilters(filters) {
    let alpha;
    forEach(filters, f => {
      if (f.filter == 'alpha') {
        alpha = f.options.alpha;
      }
    });
    return alpha;
  }

  getXYFromOverlay(filters) {
    let xy = { x: this.x, y: this.y };
    forEach(filters, filter => {
      if (filter.filter == 'overlay') {
        xy = { x: filter.options.x, y: filter.options.y };
      }
    });
    return xy;
  }

  /**
   * Converted to ffmpeg filter command line parameters
   * @private
   */
  toFilter() {
    // Usually FFMpeg text must specify the font file directory
    // if (!this.fontfile) {
    //   console.error('[FFCreatorLite] Sorry FFText no input font file!');
    //   return;
    // }

    const options = {
      line_spacing: this.line_spacing,
      bordercolor: this.bordercolor,
      borderw: this.borderw,
      fontcolor: this.fontcolor,
      fontfile: this.fontfile,
      fontsize: this.fontsize,
      boxcolor: this.boxcolor,
      shadowcolor: this.shadowcolor,
      shadowx: this.shadowx,
      shadowy: this.shadowy,
      text: `'${this.text.replace(':', '\\:')}'`,
      alpha: this.alpha,
      // x: this.x,
      // y: this.y,
      x: 0,
      y: 0,
    };

    Utils.deleteUndefined(options);
    if (options.boxcolor) options.box = 1;

    const style_str = Object.keys(options)
      .map(function (option) {
        let value = options[option];
        if ((value + '').indexOf(',') != -1) {
          return option + '=' + `'${value}'`;
        }
        return option + '=' + `${value}`;
      })
      .join(':');

    // const w = this.rootConf().getVal("width");
    // const h = this.rootConf().getVal('height');
    const w = parseInt(this.w);
    const h = parseInt(this.h);
    const filters = {
      color: `c=white@0:size=${w}*${h}`, //这里size不能是小数
      drawtext: `${style_str}`,
    };
    if (this.rotate) {
      const iw = this.w;
      const ih = this.h;
      const lt = findRotatedRectangleVertices(this.x, this.y, this.w, this.h, this.rotate);
      this.w = lt.mostRight - lt.mostLeft;
      this.h = lt.mostBottom - lt.mostTop;
      this.x = lt.mostLeft - (this.w - iw)/2;
      this.y = lt.mostTop + (this.h - ih) / 2;
    }

    // if (this.rotate){
    //   filters['rotate'] = `${this.rotate}:fillcolor=white@0`
    // }

    return Object.keys(filters)
      .map(option => {
        let value = filters[option];
        return option + '=' + value;
      })
      .join(',');

    // return { filter: 'drawtext', options };
  }

  /**
   * Add input param and output param to filter
   * @private
   */
  addInputsAndOutputs(context) {
    if (!this.filters.length) return;

    forEach(this.filters, (filter, index) => {
      let inputs = index == 0 ? context.input : this.getInId();
      this.genNewOutId();
      let outputs = this.getOutId();

      this.filters[index] = FilterUtil.setInputsAndOutputs({
        filter,
        inputs,
        outputs,
        contextInputs: context.input,
      });
    });

    // 5. set context input
    context.input = this.getOutId();
  }
}

module.exports = FFText;
