// engine/src/core/system.ts
// System 类型定义

import type { World } from './world.js';
import type { Commands } from './commands.js';

/** 系统函数签名（内部使用，不对外导出） */
export type SystemFn = (world: World, dt: number, cmd: Commands) => void;

/** 系统对象 —— v1.0 唯一公开的 System 形态 */
export interface SystemObj {
  /** 系统名称（用于调试、诊断、调度图可视化） */
  name?: string;
  /** 每帧更新 */
  update: SystemFn;
}
