const path = require('path');
// const colors = require('colors');
const axios = require('axios');
const FS = require('../utils/fs');

const fsExtra = require('fs-extra');
const Utils = require('../utils/utils');
const Perf = require('../utils/perf');
const DateUtil = require('../utils/date');
// const FFEventer = require('../event/eventer');
const _ = require('lodash');
const fs = require('fs');
const sizeOf = require('image-size');
// const fabric = require('fabric').fabric;
const FFScene = require('../node/scene');
const FFImage = require('../node/image');
const FFCreator = require('../creator');
const FFText = require('../node/text');
const FFVideo = require('../node/video');
const FFmpegUtil = require('../utils/ffmpeg');
const { EventEmitter } = require('eventemitter3');

// const transitions = [
//   'fade',
//   'fadeblack',
//   'fadewhite',
//   'distance',
//   'wipeleft',
//   'wiperight',
//   'wipeup',
//   'wipedown',
//   'slideleft',
//   'slideright',
//   'slideup',
//   'slidedown',
//   'smoothleft',
//   'smoothright',
//   'smoothup',
//   'smoothdown',
//   'rectcrop',
//   'circlecrop',
//   'circleclose',
//   'circleopen',
//   'horzclose',
//   'horzopen',
//   'vertclose',
//   'vertopen',
//   'diagbl',
//   'diagbr',
//   'diagtl',
//   'diagtr',
//   'hlslice',
//   'hrslice',
//   'vuslice',
//   'vdslice',
//   'dissolve',
//   'pixelize',
//   'radial',
//   'hblur',
//   'wipetl',
//   'wipetr',
//   'wipebl',
//   'wipebr',
//   'fadegrays',
//   'squeezev',
//   'squeezeh',
// ];

const transitions = [
  'Bounce',
  'BowTieHorizontal',
  'BowTieVertical',
  'ButterflyWaveScrawler',
  'CircleCrop',
  'ColourDistance',
  'CrazyParametricFun',
  'CrossZoom',
  'Directional',
  'DoomScreenTransition',
  'Dreamy',
  'DreamyZoom',
  'GlitchDisplace',
  'GlitchMemories',
  'GridFlip',
  'InvertedPageCurl',
  'LinearBlur',
  'Mosaic',
  'PolkaDotsCurtain',
  'Radial',
  'SimpleZoom',
  'Swirl',
  'ZoomInCircles',
  'angular',
  'burn',
  'cannabisleaf',
  'circle',
  'circleopen',
  'colorphase',
  'crosshatch',
  'crosswarp',
  'cube',
  'directionalwarp',
  'directionalwipe',
  'displacement',
  'doorway',
  'fade',
  'fadecolor',
  'fadegrayscale',
  'flyeye',
  'heart',
  'hexagonalize',
  'kaleidoscope',
  'luma',
  'luminance_melt',
  'morph',
  'multiply_blend',
  'perlin',
  'pinwheel',
  'pixelize',
  'polar_function',
  'randomsquares',
  'ripple',
  'rotate_scale_fade',
  'squareswire',
  'squeeze',
  'swap',
  'undulatingBurnOut',
  'wind',
  'windowblinds',
  'windowslice',
  'wipeDown',
  'wipeLeft',
  'wipeRight',
  'wipeUp',
];

/**
 * 字幕时间格式化
 * @param {*} totalSeconds
 * @returns
 */
function formatTime(totalMilliseconds) {
  const hours = Math.floor(totalMilliseconds / 3600000);
  const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
  const milliseconds = parseInt(totalMilliseconds % 1000);

  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)},${padZero(milliseconds, 3)}`;
}

/**
 * 补零
 * @param {*} num
 * @param {*} size
 * @returns
 */
function padZero(num, size = 2) {
  const s = '000' + num;
  return s.substr(s.length - size);
}

/**
 *
 * @returns 获取图片宽高
 */
async function getImageDimensions(p) {
  return new Promise((resolve, reject) => {
    sizeOf(p, (err, dimensions) => {
      if (!err) {
        const width = dimensions.width;
        const height = dimensions.height;
        return resolve({ width, height });
      }
      return reject(err);
    });
  });
}

// 假设base64Data是一个Base64编码的字符串，包含在data:image/png;base64,或data:image/jpeg;base64,等中
function getFileTypeFromBase64(base64Data) {
  // 正则表达式匹配data:image/[a-z]+;base64,
  const matches = base64Data.match(/data:image\/([a-z]+);base64,/);
  return matches && matches.length > 1 ? matches[1] : 'png'; // 返回例如 'png' 或 'jpeg'
}

async function get_image_by_base64(url, cache_dir) {
  let base64Data = url.replace(/^data:image\/\w+;base64,/, '');
  //获取扩展名
  let extname = getFileTypeFromBase64(url);
  let imgData = Buffer.from(base64Data, 'base64');
  const out_path = path.resolve(cache_dir, `${Utils.uid()}.${extname}`);
  fs.writeFileSync(out_path, imgData);
  return Promise.resolve(out_path);
}
/**
 * 文件预处理
 * @param {*} url
 * @param {*} cache_dir 临时文件路径
 * @param {*} dataurl base64
 * @returns
 */
const preload_file = async (url, cache_dir, dataurl) => {
  if (dataurl) {
    return get_image_by_base64(dataurl, cache_dir);
  }
  // return Promise.resolve(url);
  if (url.indexOf('http') != 0) {
    return Promise.resolve(url);
  }
  const file_name = path.basename(url).split('?')[0];
  const ext = path.extname(file_name);
  const dir = cache_dir;
  const file_path = path.resolve(dir, `${Utils.uid()}${ext}`);
  return download_file(url, file_path);
};

/**
 * 下载文件
 * @param {*} url
 * @param {*} file_path
 * @returns
 */
const download_file = async (url, file_path) => {
  if (fs.existsSync(file_path)) {
    return Promise.resolve(file_path);
  }
  const response = await axios({
    url: url,
    method: 'GET',
    responseType: 'stream', // 设置响应数据类型为流
  });
  const writer = fs.createWriteStream(file_path); // 创建可写流
  response.data.pipe(writer); // 将响应数据流写入文件
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(file_path));
    writer.on('error', reject);
  });
};

/**
 * 根据纵横比是否保持获取对象宽高
 * @param {*} width
 * @param {*} height
 * @param {*} wlv
 * @param {*} hlv
 * @param {*} cover
 * @returns
 */
function keep_wh_fun(width, height, wlv, hlv, cover) {
  let keep_width = width;
  let keep_height = height;
  if ((wlv <= hlv && !cover) || (wlv > hlv && cover)) {
    keep_height = wlv * height;
    keep_width = wlv * width;
  } else {
    keep_height = hlv * height;
    keep_width = hlv * width;
  }
  return { w: keep_width, h: keep_height };
}
/**
 * 通用解析坐标 默认原点都是左上角
 * @param {*} width
 * @param {*} height
 * @param {*} object
 * @param {*} lefttop center
 * @returns
 */
const parse_x_y = (width, height, object, is_center) => {
  const left = object.left,
    top = object.top,
    w = object.width,
    h = object.height;
  if (is_center === undefined) {
    is_center = object.originX == 'center' && object.originY == 'center';
  }
  var x = 0,
    y = 0;
  if (is_center) {
    // 输入原点是中心位置，则需要换算成左上角
    x = (left - w / 2) * width;
    y = (top - h / 2) * height;
  } else {
    x = left * width;
    y = top * height;
  }
  return [x, y];
};

class FFExector extends EventEmitter {
  constructor(conf = {}) {
    super();
    this.conf = { ...conf};
    const {
      outputDir = './output',
      cacheDir = './cache',
      render = 'canvas',
      ffmpeg,
      ffprobe,
    } = this.conf;
    this.outputDir = outputDir;
    this.cacheDir = cacheDir;
    this.render = render;
    // this.tempid = 'sync_by_temp';
    // this.create_temp(this.tempid);
    if (ffmpeg) {
      this.setFFmpegPath(ffmpeg);
    }
    if (ffprobe) {
      this.setFFprobePath(ffprobe);
    }
    this.video = '';
    this.step = 0;
    this.cur_step = 0;
    this.progress = {};
  }

  /**
   *
   * @returns 保存进度
   */
  setProgress(path, p) {
    this.progress[path] = p;
  }

  /**
   *
   * @returns 获取进度
   */
  getProgress() {
    const progresses = Object.values(this.progress);
    const sum = progresses.map(p => p).reduce((a, b) => a + b);
    // console.log(progresses, sum, progresses.length, sum / progresses.length);
    return sum / progresses.length;
  }

  /**
   * 解析fabric层 - dataurl
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_fabric_dataurl(creator, m_width, m_height, scene, layer, time) {
    const cache_dir = creator.rootConf('detailedCacheDir');
    const width = m_width;
    const height = m_height;
    const object = layer.object;
    const dataurl = layer.dataurl;

    if (dataurl === 'data:,' || (object.type == 'textbox' && !object.text)) {
      return Promise.resolve({});
    }

    var x_y = parse_x_y(width, height, object);
    // 图片
    const w = object.width * width;
    const h = object.height * height;
    const imgpath = await preload_file(null, cache_dir, dataurl);
    const fimg = new FFImage({
      path: imgpath,
      x: x_y[0],
      y: x_y[1],
      w: w,
      h: h,
      resetXY: false,
    });
    // fimg.setScale(object.scaleX);
    return Promise.resolve({ obj: fimg, duration: 0 });
  }

  /**
   * 解析fabric层 - 图片
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_fabric_image(creator, m_width, m_height, scene, layer, time) {
    const cache_dir = creator.rootConf('detailedCacheDir');
    const width = m_width;
    const height = m_height;
    const object = layer.object;
    var x_y = parse_x_y(width, height, object);
    // 图片
    const w = object.width * width;
    const h = object.height * height;
    const imgpath = await preload_file(object.src, cache_dir);
    const fimg = new FFImage({
      path: imgpath,
      x: x_y[0],
      y: x_y[1],
      w: w,
      h: h,
      resetXY: false,
    });
    // TODO 需要细化的所有属性
    fimg.addPreFilter(`scale=${w}:${h}`);
    fimg.setScale(object.scaleX);
    return Promise.resolve({ obj: fimg, duration: 0 });
  }

  /**
   * 解析fabric层 - 文字
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_fabric_text(creator, m_width, m_height, scene, layer, time) {
    const cache_dir = creator.rootConf('detailedCacheDir');
    const width = m_width;
    const height = m_height;
    const object = layer.object;
    if (!object.text) {
      return Promise.resolve({});
    }
    // object.originX = 'center';
    // object.originY = 'center';
    var x_y = parse_x_y(width, height, object);
    const x = x_y[0];
    const y = x_y[1];
    /// 文字
    const text_conf = {
      text: object.text,
      x,
      y,
      w: object.width * width,
      h: object.height * height,
    };
    const text = new FFText(text_conf);

    // if (object.shadow && object.shadow.blur) {
    //   text.addFilter(`boxblur=${object.shadow.blur}:${object.shadow.blur}`);
    // }

    text.setColor(object.fill); // 文字颜色
    if (object.backgroundColor) {
      text.setBackgroundColor(object.backgroundColor); // 背景色
    }
    // TODO 需要细化文字的所有属性
    text.setScale(object.scaleX);

    if (object.angle) {
      // text.setRotate(object.angle);
      text.setRotate(Utils.angleToRadian(object.angle));
    }

    // 其他样式处理
    let style = object;
    const borderColor = object.stroke;
    const borderSize = object.strokeWidth;
    const align = object.textAlign;
    const lineJoin = object.strokeLineJoin;
    const miterLimit = object.strokeMiterLimit;
    style = { ...style, align, lineJoin, miterLimit, borderSize, borderColor };
    text.setStyle(style); // 设置样式object

    // 字体处理
    let fontPath = layer.fontPath;
    if (fontPath && fontPath.length > 0) {
      try {
        const font_path = await preload_file(fontPath, cache_dir);
        text.setFont(font_path);
      } catch (err) {}
    }
    return Promise.resolve({ obj: text, duration: 0 });
  }

  /**
   * 解析fabric层
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_fabric(creator, m_width, m_height, scene, layer, time) {
    const object = layer.object;
    if (object.type == 'image') {
      return this.parse_fabric_image(creator, m_width, m_height, scene, layer, time);
    } else if (layer.dataurl) {
      return this.parse_fabric_dataurl(creator, m_width, m_height, scene, layer, time);
    } else if (object.type == 'textbox') {
      return this.parse_fabric_text(creator, m_width, m_height, scene, layer, time);
    }
  }

  /**
   * 解析video层
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_video(creator, m_width, m_height, scene, layer, time) {
    const cache_dir = creator.rootConf('detailedCacheDir');
    let { cutFrom, cutTo, width, height, silent = false } = layer;
    const w = m_width * width;
    const h = m_height * height;
    var x_y = parse_x_y(m_width, m_height, layer);
    let file = layer.path;
    file = await preload_file(file, cache_dir);
    const ss = DateUtil.secondsToHms(cutFrom);
    const to = DateUtil.secondsToHms(cutTo);

    const fvideo = new FFVideo({
      path: file,
      w: w,
      h: h,
      x: x_y[0],
      y: x_y[1],
      audio: silent,
      ss,
      to,
      resetXY: false,
    });
    fvideo.addPreFilter(`scale=${w}:${h}`);
    // this.on('panel_complete', () => {
    // 幻灯片播放完成后再执行
    fvideo.setDuration(cutTo);
    // });
    return Promise.resolve({ obj: fvideo, duration: 0 });
  }

  /**
   * 解析数字人层
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_digital(creator, m_width, m_height, scene, layer, time) {
    let object = {
      width: layer.object.width,
      height: layer.object.height,
      left: layer.object.left,
      top: layer.object.top,
      originX: layer.object.originX,
      originY: layer.object.originY,
      duration: scene.duration || 0,
      path: layer.object.src,
    };
    if (layer.digital) {
      // 云剪辑，需要提交预处理
      object = {
        ...object,
        silent: true,
        path: (layer.digital && layer.digital.path) || layer.object.src,
        cutFrom: 0,
        cutTo: (layer.digital && layer.digital.duration) || object.duration,
      };
      return this.parse_video(creator, m_width, m_height, scene, object, time);
    } else {
      //
      object = {
        ...object,
        width: layer.object.width * m_width,
        height: layer.object.height * m_height,
      };
      return this.parse_image(creator, m_width, m_height, scene, object, time);
    }
  }

  /**
   * 解析image层
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_image(creator, m_width, m_height, scene, layer, time) {
    const cache_dir = creator.rootConf('detailedCacheDir');
    let { resizeMode, zoomDirection, width, height, duration = scene.duration } = layer;
    let file = layer.path;
    file = await preload_file(file, cache_dir);
    if (width === undefined && height === undefined) {
      let dimensions = await getImageDimensions(file);
      width = dimensions.width;
      height = dimensions.height;
    }
    let wlv = m_width / width;
    let hlv = m_height / height;

    let keep_wh = { w: width, h: height };
    var fimg1;
    switch (resizeMode) {
      case 'contain':
        // 所有图像或者视频都将包含在幻灯片中（保留纵横比）
        keep_wh = keep_wh_fun(width, height, wlv, hlv, false);
        break;
      case 'contain-blur':
        // 类似于contain，但以高斯模糊来填充空白部分 （保留纵横比）
        keep_wh = keep_wh_fun(width, height, wlv, hlv, false);
        var keep_wh_cover = {
          w: keep_wh.w * (wlv <= hlv ? 1 : 1.5),
          h: keep_wh.h * (wlv > hlv ? 1 : 1.5),
        };

        var img1_x = m_width / 2 - keep_wh_cover.w / 2;
        var img1_y = m_height / 2 - keep_wh_cover.h / 2;
        if (layer.originX && layer.originY) {
          let img1_x_y = parse_x_y(m_width, m_height, {
            ...layer,
            width: (layer.width * (wlv <= hlv ? 1 : 1.5)) / m_width,
            height: (layer.height * (wlv > hlv ? 1 : 1.5)) / m_height,
          });
          img1_x = img1_x_y[0];
          img1_y = img1_x_y[1];
        }
        fimg1 = new FFImage({
          path: file,
          x: img1_x,
          y: img1_y,
          opacity: 0.5,
          ...keep_wh_cover,
          resetXY: false,
        });
        fimg1.addPreFilter(`scale=${keep_wh_cover.w}:${keep_wh_cover.h}`);
        fimg1.addPreFilter(`boxblur=25:25`);
        // fimg1.setBlur(25);
        break;
      case 'cover':
        //裁剪图片或者视频以覆盖整个幻灯片（保留纵横比）
        keep_wh = keep_wh_fun(width, height, wlv, hlv, true);
        break;
      case 'stretch':
        //视频将被拉伸以覆盖整个幻灯片（忽略纵横比）。
        keep_wh = { w: m_width, h: m_height };
        break;
      default:
        break;
    }
    // 默认是在视频的正中间
    let x = m_width / 2 - keep_wh.w / 2;
    let y = m_height / 2 - keep_wh.h / 2;
    if (layer.originX && layer.originY) {
      let x_y = parse_x_y(m_width, m_height, {
        ...layer,
        width: layer.width / m_width,
        height: layer.height / m_height,
      });
      x = x_y[0];
      y = x_y[1];
    }
    const fimg = new FFImage({
      path: file,
      x,
      y,
      ...keep_wh,
      resetXY: true,
    });
    fimg.addPreFilter(`scale=${keep_wh.w}:${keep_wh.h}`);
    // 转场特效
    const max_scale = 2; // 最大放大比率
    const max_scale_animate_time = 6; // 最大放大比率对应的最佳时间
    const speed = max_scale / max_scale_animate_time; // 默认速度
    const min_scale = 1.5; // 最小放大比率
    let scalex = speed * duration;

    if (scalex > max_scale) {
      scalex = max_scale;
    } else if (scalex < min_scale) {
      scalex = min_scale;
    }
    switch (zoomDirection) {
      case 'in':
        fimg.setScale(scalex);
        fimg.addEffect({ type: 'zoomingIn', time: duration, delay: 0 });
        // fimg1 && fimg1.addEffect({ type: 'zoomIn', time: duration, delay: 0 });
        break;
      case 'out':
        fimg.setScale(scalex);
        fimg.addEffect({ type: 'zoomingOut', time: duration, delay: 0 });
        // fimg1 && fimg1.addEffect({ type: 'zoomOut', time: duration, delay: 0 });
        break;
      case 'left':
        fimg.setScale(scalex);
        // fimg.setXY(x + (x * scalex) / 2, y - ((scalex - 1) / 2) * keep_wh.h);
        // fimg.addEffect({
        //   type: 'moveingLeft',
        //   time: duration,
        //   delay: 0,
        // });
        fimg.addAnimate({
          type: 'move',
          showType: 'in',
          time: duration,
          delay: 0,
          from: { x: x + (keep_wh.w * (scalex - 1)) / 2, y: y - ((scalex - 1) / 2) * keep_wh.h },
          to: { x: x - keep_wh.w * (scalex - 1), y: y - ((scalex - 1) / 2) * keep_wh.h },
        });
        // fimg1 && fimg1.addEffect({ type: 'slideInLeft', time: duration, delay: 0 });
        break;
      case 'right':
        fimg.setScale(scalex);
        // fimg.setXY(x - (x * scalex) / 2, y - ((scalex - 1) / 2) * keep_wh.h);
        // fimg.addEffect({ type: 'moveingRight', time: duration, delay: 0 });
        fimg.addAnimate({
          type: 'move',
          showType: 'in',
          time: duration,
          delay: 0,
          from: { x: x - (keep_wh.w * (scalex - 1)) / 2, y: y - ((scalex - 1) / 2) * keep_wh.h },
          to: { x: x + keep_wh.w * (scalex - 1), y: y - ((scalex - 1) / 2) * keep_wh.h },
        });
        // fimg1 && fimg1.addEffect({ type: 'slideInRight', time: duration, delay: 0 });
        break;
      default:
        break;
    }
    fimg1 && scene.addChild(fimg1);
    return Promise.resolve({ obj: fimg, duration: 0 });
  }

  /**
   * 解析layers
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} default_p_layer
   * @param {*} layers
   * @param {*} time 执行了多长时间
   */
  async parse_layers(creator, m_width, m_height, scene, default_p_layer, layers, p_time) {
    let layers_duration = p_time;
    for (const index in layers) {
      try {
        const layer = layers[index];
        const { obj: fflayer, duration } = await this.parse_layer(
          creator,
          m_width,
          m_height,
          scene,
          { ...default_p_layer, ...layer },
          layers_duration,
        );
        if (fflayer) {
          layers_duration += duration;
          // 设置动画效果
          const effect = layer.effect;
          if (effect) {
            const start = layer.start || 0;
            fflayer.addEffect(effect.type, effect.time, start);
            if (layer.end) {
              //   // 幻灯片播放完成后再执行
              fflayer.setDuration(layer.end);
            }
          } else {
            if (layer.start) {
              fflayer.addEffect('fadeIn', 0.3, layer.start);
              if (layer.end) {
                //   // fflayer.remove(layer.end, creator.id);
                fflayer.setDuration(layer.end);
              }
            }
          }
          scene.addChild(fflayer);
          if (layer.overlayBackground) {
            const cacheDir = creator.rootConf('cacheDir');
            const width = parseInt(m_width * layer.width);
            const height = parseInt(m_height * layer.height);
            const file = await preload_file(layer.overlayBackground, cacheDir);
            const fimg = new FFImage({
              path: file,
              x: m_width / 2 - width / 2,
              y: m_height / 2 - height / 2,
              w: width,
              h: height,
              resetXY: false,
            });
            fimg.addPreFilter(`scale=${width}:${height}`);
            scene.addChild(fimg);
          }
        }
      } catch (err) {
        console.log(err);
        // return Promise.reject(err);
      }
    }
    return Promise.resolve(layers_duration);
  }

  /**
   * 解析slide_panel layer
   * @param {*} p_creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_slide_panel(p_creator, m_width, m_height, scene, layer, time) {
    this.step += 1;
    const FFSlide = require('./slide');
    const width = parseInt(m_width * layer.width);
    const height = parseInt(m_height * layer.height);
    const fps = p_creator.rootConf('fps');
    const log = p_creator.rootConf('log');
    const parallel = p_creator.rootConf('parallel');
    let x_y = parse_x_y(m_width, m_height, layer);
    const outputDir = p_creator.rootConf('outputDir');
    const cacheDir = p_creator.rootConf('cacheDir');
    const render = p_creator.rootConf('render');
    const slide = new FFSlide({
      w: width,
      h: height,
      fps,
      parallel,
      render,
      log,
      outputDir,
      cacheDir,
      x: x_y[0],
      y: x_y[1],
      step: this.step,
    });
    let duration = 0;
    if (layer.clips.length) {
      duration += await this.parse_clips(slide.creator, width, height, {}, layer.clips, 0);
    }
    slide.creator.on('start', () => {
      this.time = 0;
      // this.emit('start');
    });

    slide.creator.on('error', e => {
      this.emit('error', e);
    });

    slide.creator.on('progress', async e => {
      const percent = e.percent || 0;
      await this.setProgress(slide.creator.id, percent);
      e.percent = await this.getProgress();
      this.emit('progress', e);
    });

    slide.creator.on('complete', e => {
      // this.emit('complete', e);
      this.time += Perf.t;
      // this.emit('panel_complete'); // 解决creator声明多次导致的时间轴更新错误 TimelineUpdate是全局的，注册事件后开始计时
    });
    return Promise.resolve({ obj: slide, duration: duration });
  }

  /**
   * 解析layer层
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} layer
   * @param {*} time 执行了多长时间
   */
  async parse_layer(creator, m_width, m_height, scene, layer, time) {
    switch (layer.type) {
      case 'image':
        return this.parse_image(creator, m_width, m_height, scene, layer, time);
      // case 'audio':
      //   return this.parse_audio(creator, m_width, m_height, scene, layer, time);
      case 'digital':
        return this.parse_digital(creator, m_width, m_height, scene, layer, time);
      case 'video':
        return this.parse_video(creator, m_width, m_height, scene, layer, time);
      case 'fabric':
        return this.parse_fabric(creator, m_width, m_height, scene, layer, time);
      case 'slide-panel':
        if (layer.clips.length > 0) {
          return this.parse_slide_panel(creator, m_width, m_height, scene, layer, time);
        } else {
          return Promise.resolve({ obj: null, duration: 0 });
        }
      default:
        return Promise.reject(`未支持类型${layer.type}`);
    }
  }

  /**
   * 解析字幕
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} scene
   * @param {*} subtitle
   */
  async parse_subtitle(creator, m_width, m_height, scene, subtitle) {
    // return this.parse_fabric_text(creator, m_width, m_height, scene, subtitle).then((layer)=>Promise.resolve(layer.obj));
    const FFSubtitle = require('./subtitle');
    const cache_dir = creator.rootConf('detailedCacheDir');
    const width = m_width;
    const height = m_height;
    const { audio, texts, object, fontPath } = subtitle;
    let duration = subtitle.duration;
    // texts 转 srt格式
    let srtContent = '';
    let text = '';
    texts.forEach((subtitle, index) => {
      const srtIndex = index + 1;
      const startTime = formatTime(subtitle.begin_time);
      const endTime = formatTime(subtitle.end_time);

      srtContent += `${srtIndex}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${subtitle.text}\n\n`;

      text = subtitle.text;
    });
    // 字幕文件
    const srt = path.resolve(cache_dir, `${Utils.uid()}.srt`);
    fs.writeFileSync(srt, srtContent);
    // 设置字幕文件
    const xy = parse_x_y(width, height, object, true);
    const ffsubtitle = new FFSubtitle({
      comma: true, // 是否逗号分割
      // backgroundColor: object.backgroundColor,
      color: object.fill,
      vertical: object.vertical,
      fontFamily: object.fontFamily,
      fontSize: object.fontSize,
      x: xy[0],
      y: xy[1],
      w: object.width * width,
      h: object.height * height,
      // 1. srt方式
      text: text,
      path: srt,
      resetXY: false,
    });
    // TODO 需要细化下，暂时不区分
    let style = object;
    ffsubtitle.setColor(object.fill); // 文字颜色

    if (object.backgroundColor) {
      ffsubtitle.setBackgroundColor(object.backgroundColor); // 背景色
    }
    // TODO 需要细化文字的所有属性
    ffsubtitle.setScale(object.scaleX);

    if (object.angle) {
      ffsubtitle.setRotate(object.angle);
    }

    const borderColor = object.stroke;
    const borderSize = object.strokeWidth;
    const align = object.textAlign;
    const lineJoin = object.strokeLineJoin;
    const miterLimit = object.strokeMiterLimit;
    style = { ...style, align, lineJoin, miterLimit, borderSize, borderColor };
    ffsubtitle.setStyle(style); // 设置样式object
    ffsubtitle.setScale(object.scaleX);

    if (object.angle) {
      ffsubtitle.setRotate(object.angle * (3.1415927 / 180));
    }

    // 字体处理
    if (fontPath) {
      // 需要下载下来
      const local_file_path = await preload_file(fontPath, cache_dir);
      // const file_name = path.basename(fontPath).split('?')[0];
      // const dir = cache_dir;
      // let local_file_path = path.resolve(dir, `${file_name}`);
      // await download_file(fontPath, local_file_path);
      const file_name = path.basename(local_file_path);
      ffsubtitle.setFontFile(cache_dir);
      ffsubtitle.setFont(file_name);
    }
    // ffsubtitle.frameBuffer = ffsubtitle.rootConf('fps'); // 缓存帧
    // 声音处理
    if (audio) {
      const tts = await preload_file(audio, cache_dir);
      scene.addAudio({
        path: tts,
        // volume: 2,
        duration: duration || scene.duration,
        fadeIn: 0.5,
        fadeOut: 0.5,
      });
    }
    if (duration) {
      ffsubtitle.setDuration(duration);
      scene.setDuration(duration);
    }
    return Promise.resolve(ffsubtitle);
  }

  /**
   * 解析所有场景
   * @param {*} creator
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} default_p 默认参数
   * @param {*} clips
   * @param {*} time 经过了多长时间
   * @returns
   */
  async parse_clips(creator, m_width, m_height, default_p, clips, time) {
    var duration = 0;
    for (let index in clips) {
      let clip = _.merge({}, default_p, clips[index]);
      const scene = await this.parse_clip(creator, m_width, m_height, clip, time);
      if (index == 0) {
        duration += scene.getNormalDuration();
      } else {
        duration += scene.duration;
      }
      //  场景中的声音是混合在单独一个aduioTracks,所以这个参数可以控制场景中的aduioTracks和上面相对于音频轨道，的相对大小
      scene.audios.forEach(audio => {
        if (audio.volume == -1) {
          audio.volume = 1;
        }
        audio.volume = audio.volume * clip.mixVolume;
      });
      creator.addChild(scene);
    }
    return Promise.resolve(duration);
  }

  /**
   * 解析clip场景
   * @param {*} creator root
   * @param {*} m_width 主窗体width
   * @param {*} m_height 主窗体height
   * @param {*} clip
   * @param {*} time 经过了多长时间
   * @returns
   */
  async parse_clip(creator, m_width, m_height, clip, time) {
    const width = m_width;
    const height = m_height;
    let { duration, transition, subtitle, background, backgroundDataurl, layer } = clip;
    // 场景对象
    const scene = new FFScene({ w: width, h: height });
    const cache_dir = creator.rootConf('detailedCacheDir');

    // 场景时间
    scene.setDuration(duration);

    // 转场特效
    let transition_name = transition.name;
    if (transition_name == 'random') {
      transition_name = transitions[Math.floor(Math.random() * transitions.length)];
    }

    // 背景
    if (background || backgroundDataurl) {
      if (background.indexOf('#') == 0) {
        scene.setBgColor(background);
      } else {
        const file = await preload_file(background, cache_dir);
        // console.log(file);
        const fimg = new FFImage({
          path: file,
          x: 0,
          y: 0,
          w: width,
          h: height,
          resetXY: false,
        });
        fimg.addPreFilter(`scale=${width}:${height}`);
        scene.addChild(fimg);
      }
    }

    //转场
    if (transition_name) {
      scene.setTransition(transition_name, transition.duration || 0.5);
    }

    // 场景层
    let layers = clip.layers;
    let layer_duration = await this.parse_layers(
      creator,
      m_width,
      m_height,
      scene,
      layer || {},
      layers,
      time,
    );
    if (layer_duration && layer_duration > 0) {
      scene.setDuration(layer_duration);
    }

    // 字幕
    if (subtitle && subtitle.texts && subtitle.texts.length > 0) {
      const ffsubtitle = await this.parse_subtitle(creator, m_width, m_height, scene, subtitle);
      scene.addChild(ffsubtitle);
    }

    return Promise.resolve(scene);
  }

  async info(path, cacheDir) {
    return FFmpegUtil.getFfmpegInfo(path, cacheDir);
  }

  /**
   *   按模版视频合成
   * @param {*} json
   * @returns
   */
  async sync(json) {
    const {
      width,
      height,
      fps,
      loopAudio,
      clips,
      log = false,
      audioFilePath,
      threads = 2,
      backgroundAudioVolume = 100, // 背景音
      clipsAudioVolume = 100, // 场景中的声音是混合在单独一个aduioTracks,所以这个参数可以控制场景中的aduioTracks和上面相对于音频轨道，的相对大小
    } = json;
    const default_p = { mixVolume: clipsAudioVolume / 100, ...json.default }; // 场景中的默认参数
    const volume = backgroundAudioVolume / 100;
    const creator_conf = {
      w: parseInt(width),
      h: parseInt(height),
      fps,
      render: this.render,
      // parallel: 2,
      log,
      threads,
      audioLoop: loopAudio,
      outputDir: this.outputDir,
      cacheDir: this.cacheDir,
    };

    // if (audioFilePath) {
    //   creator_conf['audio'] = { path: audioFilePath, volume, fadeIn: 0.5, fadeOut: 0.5 };
    // }

    // 实例化
    const creator = new FFCreator(creator_conf);

    //缓存目录检查
    const cache_dir = creator.rootConf('detailedCacheDir');
    fsExtra.ensureDirSync(cache_dir);

    // 添加 'SIGINT' 事件监听器来捕获中断事件
    process.on('SIGINT', e => {
       clear_env(true);
    });

    creator.inCenter = true;
    creator.generateOutput();

    // creator.destroy = ()=>{}
    // creator.deleteAllCacheFile=()=>{}

    // 解析场景
    this.parse_clips(creator, parseInt(width), parseInt(height), default_p, clips, 0)
      .then(duration => {
        if (audioFilePath) {
          creator.addAudio({ path: audioFilePath, volume, duration, fadeIn: 0.5, fadeOut: 0.5 });
        }
        // 开始合成
        creator.start();
      })
      .catch(e => {
        this.emit('error', e);
      });

    creator.on('start', () => {
      this.emit('start');
      this.setProgress(creator.id, 0);
    });

    /**
     * 清理工作空间
     * @param {*} err 错误的话要清理视屏
     */
    const clear_env = async err => {
      const cache_dir = creator.rootConf('detailedCacheDir');
      await FS.rmDir(cache_dir);
      if (err) {
        if (this.video) {
          await FS.rmDir(this.video);
        }
      }
    };

    creator.on('error', e => {
      clear_env(true).finally(() => {
        this.emit('error', e);
      });
    });

    creator.on('progress', e => {
      const percent = e.percent || 0;
      this.setProgress(creator.id, percent);
      e.percent = this.getProgress();
      this.emit('progress', e);
      if (creator.renderer.synthesis) {
        this.setVideo(creator.renderer.synthesis.getOutputPath('cur'));
      }
    });

    creator.on('complete', e => {
      this.time += Perf.t;
      clear_env().finally(() => {
        this.setVideo(e.output)
        this.emit('complete', e);
        this.destroy();
      });
    });

    return this;
  }

  async destroy() {
    await FFmpegUtil.destroy(this.command);
    this.removeAllListeners();
    this.context = null;
    this.command = null;
  }

  setFFmpegPath(ffmpeg_path) {
    FFmpegUtil.setFFmpegPath(ffmpeg_path);
  }

  setFFprobePath(ffprobe_path) {
    FFmpegUtil.setFFprobePath(ffprobe_path);
  }

  setVideo(path) {
    this.video = path;
  }
}
module.exports = FFExector;
