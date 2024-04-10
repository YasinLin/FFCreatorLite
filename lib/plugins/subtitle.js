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
const FFText = require('../node/text');
const Utils = require('../utils/utils');
const path = require("node:path");
const FilterUtil = require('../utils/filter');


function convertColor(hexColor) {
  // 将 RGB 颜色代码转换为 BGR 颜色代码
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);

  // 格式化为FFmpeg字幕字体颜色格式
  const ffmpegColor = `&H00${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}&`;

  return ffmpegColor.toUpperCase();
}

class FFSubtitle extends FFText {
  constructor(conf = { x: 0, y: 0, animations: [] }) {
    super({ type: 'subtitle', ...conf });

    const {
      color = 'black',
      backgroundColor,
      fontSize = 24,
      text = '',
      font,
      fontfile,
      fontFamily,
      vertical,
    } = conf;

    this.text = text;
    this.fontcolor = color;
    this.fontsize = fontSize;
    this.boxcolor = backgroundColor;
    this.fontFamily = font || fontFamily;
    this.fontfile = fontfile;
    this.vertical = vertical;
  }

  /**
   * Set font
   * @param {string} font - font
   * @public
   */
  setFont(font) {
    this.fontFamily = font;
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
   * Set text style by object
   * @param {object} style - style by object
   * @public
   */
  setStyle(style) {
    super.setStyle(style);
    if (style.color) this.fontcolor = convertColor(style.color);
    if (style.fill) this.fontcolor = convertColor(style.fill);
    if (style.borderColor) this.bordercolor = convertColor(style.borderColor);
    if (style.backgroundColor) this.boxcolor = convertColor(style.backgroundColor);
    if (style.charSpacing) this.char_spacing = style.charSpacing;
    if (style.fontWeight && style.fontWeight == 'bold') this.bold = -1;
    if (style.shadow && style.shadow.color) this.boxcolor = convertColor(style.shadow.color);// 阴影颜色
  }

  /**
   * concatFilters - Core algorithm: processed into ffmpeg filter syntax
   * @param {object} context - context
   * @private
   */
  concatFilters(context) {
    this.animations.replaceEffectConfVal();

    this.filters = this.preFilters.concat(this.filters);
    this.filters = this.filters.concat(this.customFilters);
    const aniFilters = this.animations.concatFilters();
    this.resetXYByAnimations(aniFilters);
    this.resetAlphaByAnimations(aniFilters);

    const filter = this.toFilter();
    if (filter) {
      this.filters.push(filter);
      this.addInputsAndOutputs(context);
    }

    return this.filters;
  }

  /**
   * Converted to ffmpeg filter command line parameters
   * @private
   */
  toFilter() {
    // 判断是否是竖直对齐，如果是
    const rootw = this.rootConf().getVal('width');
    const rooth = this.rootConf().getVal('height');
    let angle = 0;
    let alignment = 2;
    let dpi = Math.sqrt(Math.pow(rootw, 2) + Math.pow(rooth, 2)) / 4.8;
    let marginl = 0;
    let marginv = ((this.rootConf().getVal('height') - (this.y + this.h)) / dpi) * 72;
    // let marginv = `${(rooth - (this.y + this.h)) / rooth}*ih`;
    // let marginv = 5;
    let borderStype = 1;
    if (this.vertical) {
      angle = 90;
      alignment = 7;
      marginl = (this.x / dpi) * 72;
      marginv = 0;
    }

    if (this.shadowx) this.shadowx = this.shadowx/ dpi * 72;
    if (this.shadowy) this.shadowy = (this.shadowy / dpi) * 72;

    const styles = {
      Spacing:
        (this.char_spacing && (((this.char_spacing / 1000) * this.fontsize) / dpi) * 72) ||
        undefined, //文字间的额外间隙. 为像素数
      Angle: angle, // 按Z轴进行旋转的度数, 原点由alignment进行了定义. 可以为小数
      ScaleX: this.scale, // 修改文字的宽度. 为百分数
      ScaleY: this.scale, // 修改文字的高度. 为百分数
      Bold: this.bold || 0, // -1为粗体, 0为常规
      Italic: this.italic || 0, //  -1为斜体, 0为常规
      Underline: this.underline || 0, // [-1 或者 0] 下划线
      Strikeout: this.strikeout || 0, // [-1 或者 0] 中划线/删除线
      BorderStyle: borderStype, // 1=边框+阴影, 3=纯色背景. 当值为3时, 文字下方为轮廓颜色的背景, 最下方为阴影颜色背景.
      Shadow: this.shadowx || this.shadowy || 0, //当BorderStyle为1时, 该值定义阴影的深度, 为像素数, 常见有0, 1, 2, 3, 4.
      Alignment: alignment, //定义字幕的位置. 字幕在下方时, 1=左对齐, 2=居中, 3=右对齐. 1, 2, 3加上4后字幕出现在屏幕上方. 1, 2, 3加上8后字幕出现在屏幕中间. 例: 11=屏幕中间右对齐. Alignment对于ASS字幕而言, 字幕的位置与小键盘数字对应的位置相同.
      OutlineColour: this.bordercolor, //设置轮廓颜色, 为蓝-绿-红三色的十六进制代码相排列, BBGGRR.
      Outline: (this.borderw && (this.borderw / dpi) * 72) || 0, //当BorderStyle为1时, 该值定义文字轮廓宽度, 为像素数, 常见有0, 1, 2, 3, 4.
      PrimaryColour: this.fontcolor, // 设置主要颜色, 为蓝-绿-红三色的十六进制代码相排列, BBGGRR. 为字幕填充颜色
      BackColour: this.boxcolor, //设置阴影颜色, 为蓝-绿-红三色的十六进制代码相排列, BBGGRR. ASS的这些字段还包含了alpha通道信息. (AABBGGRR), 注ASS的颜色代码要在前面加上&H
      Fontname: this.fontFamily, // 使用的字体名称, 区分大小写
      Fontsize: (this.fontsize / dpi) * 72, // 字体的字号
      MarginL: marginl, //字幕可出现区域与左边缘的距离, 为像素数
      MarginV: marginv, // 垂直距离
    };

    Utils.deleteUndefined(styles);

    const style_str = Object.keys(styles)
      .map(function (option) {
        let value = styles[option];
        return option + '=' + value;
      })
      .join(',');

    const options = {
      '': `${this.getPath()}`,
      force_style: `'${style_str}'`,
    };
    if (this.fontfile) {
      options['fontsdir'] = this.fontfile;
    }
    return "subtitles="+Object.keys(options)
      .map(option => {
        let value = options[option];
        if (!option){
          return value;
        }
        return option + '=' + value;
      })
      .join(':');
  }

  /**
   * Get subtitle path
   * @public
   */
  getPath() {
    return this.conf.path || this.conf.subtitle || this.conf.url;
  }
}

module.exports = FFSubtitle;
