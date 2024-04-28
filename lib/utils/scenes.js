'use strict';

/**
 * ScenesUtil - A scene manager with some functions.
 *
 * ####Example:
 *
 *     ScenesUtil.isSingle(creator)
 *
 *
 * @class
 */
const forEach = require('lodash/forEach');

const ScenesUtil = {
  isSingle(creator) {
    const { scenes } = creator;
    const conf = creator.rootConf();
    const speed = conf.getVal('speed');
    return speed === 'high' && scenes.length === 1;
  },

  hasTransition(creator) {
    if (!creator.scenes.length){
      return false;
    }
    let hasTransition = true;
    creator.scenes.forEach(item=>{
      hasTransition &= !!item.transition;
    })
    return hasTransition;
  },

  fillTransition(creator) {
    const { scenes } = creator;
    forEach(scenes, scene => scene.fillTransition());
  },

  getLength(creator) {
    const { scenes } = creator;
    return scenes.length;
  },
};

module.exports = ScenesUtil;
