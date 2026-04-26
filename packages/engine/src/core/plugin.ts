// engine/src/core/plugin.ts
// Plugin 接口 —— Bevy 风格的对象形态插件

import type { App } from './app.js';

/** 插件接口 —— 所有功能扩展的统一入口 */
export interface Plugin {
  /** 全局唯一标识，用于依赖解析 */
  readonly name: string;

  /** 依赖的其它 Plugin（App 会先装它们） */
  readonly dependencies?: readonly Plugin[];

  /** 构建：注册组件、系统、资源 */
  build(app: App): void | Promise<void>;

  /** 可选：卸载时清理 */
  teardown?(app: App): void;
}
