// engine/src/plugins/transform/plugin.ts
// Transform 插件 —— 注册最基础的变换与标识组件

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { Transform, Name } from './components.js';

export { Transform, Name } from './components.js';

/**
 * Transform 插件 —— 注册 Transform 和 Name 组件。
 *
 * 几乎所有 Plugin（Render, Physics, Input 等）都依赖这些组件，
 * 但它们是 ECS 核心之外的具体业务组件，不属于 core。
 */
export const TransformPlugin: Plugin = {
  name: 'transform',

  build(app: App) {
    app.registerComponent(Transform);
    app.registerComponent(Name);
  },
};
