// engine/src/plugins/render/types.ts
// 渲染插件类型定义

import type { ComponentClass } from '../../core/types';
import type { IGfxDevice, IGfxTexture } from './IGfxDevice.js';
import { Color } from '../../Math.js';

export type { IGfxDevice, IGfxTexture, IGfxBuffer, IGfxPipeline } from './IGfxDevice.js';
export { TextureAtlas, type AtlasRegion } from './SpriteBatch.js';
export { Color } from '../../Math.js';

// ═════════════════════════════════════════════════════════════════════════════
// 渲染组件
// ═════════════════════════════════════════════════════════════════════════════

/** 精灵渲染组件 */
export class Sprite {
  /** 图集名称 */
  atlas: string = '';
  /** 区域/帧名称 */
  region: string = '';
  /** 颜色/色调 */
  color: Color = Color.white();
  /** 是否水平翻转 */
  flipX = false;
  /** 是否垂直翻转 */
  flipY = false;
  /** 排序层级 */
  layer = 0;
  /** 层级内的排序值（越大越靠前） */
  order = 0;
}

/** 相机组件 —— 标记主相机 */
export class Camera {
  /** 视口宽度（像素） */
  width = 800;
  /** 视口高度（像素） */
  height = 600;
  /** 缩放比例 @default 1 */
  zoom = 1;
  /** 背景色 */
  backgroundColor: Color = Color.fromHex('87CEEB');
}

/** 动画组件 */
export class SpriteAnimation {
  /** 当前动画名称 */
  currentAnim: string = '';
  /** 动画播放速度 @default 1 */
  speed = 1;
  /** 是否循环 @default true */
  loop = true;
  /** 是否正在播放 @default true */
  playing = true;
  /** 内部：当前帧索引 */
  _frameIndex = 0;
  /** 内部：累积时间 */
  _accumulatedTime = 0;
}

/** 动画定义（存储在资源中） */
export interface AnimationDef {
  /** 帧列表：每个帧是图集中的 region 名称 */
  frames: string[];
  /** 每帧持续时间（毫秒） */
  frameDuration: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// 声明组件类型
// ═════════════════════════════════════════════════════════════════════════════

declare module '../../core/component' {
  interface ComponentMap {
    Sprite: Sprite;
    Camera: Camera;
    SpriteAnimation: SpriteAnimation;
  }
}
