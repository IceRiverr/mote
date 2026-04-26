// engine/src/core/system.ts
// System 类型定义

import type { World } from './world.js';

/** 系统函数签名 */
export type SystemFn = (world: World, dt: number) => void;

/** 系统对象签名 */
export interface SystemObj {
  /** 系统名称（用于调试） */
  name?: string;
  /** 每帧更新 */
  update: SystemFn;
}

/** System 可以是函数或对象 */
export type System = SystemFn | SystemObj;
