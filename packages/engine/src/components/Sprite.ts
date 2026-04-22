// ═══════════════════════════════════════════════════════════════
// Sprite.ts - 精灵组件
// 定义实体的视觉表现
// ═══════════════════════════════════════════════════════════════

/**
 * 精灵组件 - 渲染 2D 图像
 * 
 * 使用图集（Atlas）系统：
 * 1. 加载 .mote-sprite.json 图集文件
 * 2. 通过 atlas + frame 引用具体图像
 * 3. 支持翻转、染色、层级排序
 */
export class Sprite {
  /**
   * 图集 ID（对应 .mote-sprite.json 的 id 字段）
   * @default ""
   */
  atlas = '';

  /**
   * 帧 ID（对应图集 frames 数组中的 id）
   * @default ""
   */
  frame = '';

  /**
   * 渲染层级（数值越大越靠前）
   * @default 0
   * @range [-100, 100]
   * @step 1
   */
  layer = 0;

  /**
   * 颜色叠加（CSS 颜色格式）
   * @default "#ffffff"
   * @type color
   */
  tint = '#ffffff';

  /**
   * 水平翻转
   * @default false
   */
  flipX = false;

  /**
   * 垂直翻转
   * @default false
   */
  flipY = false;

  /**
   * 透明度（0-1）
   * @default 1
   * @range [0, 1]
   * @step 0.1
   */
  alpha = 1;

  /**
   * 是否可见
   * @default true
   */
  visible = true;
}


