// engine/src/core/types.ts
// 微尘引擎 ECS 核心类型定义

// ─── Entity ───

/** 实体数字 ID —— 引擎内部的核心标识 */
export type EntityId = number;

// ─── Component ───

/** 组件类约束：必须是无参构造函数 */
export type ComponentClass<T = any> = new () => T;

/**
 * ComponentMap 接口 —— 通过 declaration merging 扩展
 * 各组件文件通过 declare module 向此接口添加 key-type 映射
 * 为 SpawnConfig 提供编译时类型检查
 */
export interface ComponentMap {
  [key: string]: any;
}

/** Prefab 创建和组件初始化的统一配置形状 */
export type SpawnConfig = {
  [K in keyof ComponentMap]?: Partial<ComponentMap[K]>;
};

// ─── System ───

/** 系统函数签名 */
export type SystemFn = (world: any, dt: number) => void;

/** 系统对象签名 */
export interface SystemObj {
  /** 系统名称（用于调试） */
  name?: string;
  /** 每帧更新 */
  update: SystemFn;
}

/** System 可以是函数或对象 */
export type System = SystemFn | SystemObj;

// ─── Plugin ───

/** 插件函数，可同步或异步，可接受选项参数 */
export type Plugin = (world: any, options?: any) => void | Promise<void>;

// ─── Prefab ───

/** 预制体定义（运行时，不存储资源标识） */
export interface Prefab {
  /** 预制体唯一标识 */
  id?: string;
  /** 显示名称 */
  name?: string;
  /** 组件配置 */
  components: SpawnConfig;
  /** 子实体 */
  children?: Prefab[];
}

// ─── Utility Types ───

/** 从 ComponentClass 元组提取实例类型元组 */
export type InstanceTypes<T extends ComponentClass[]> = {
  [K in keyof T]: T[K] extends ComponentClass<infer U> ? U : never;
};
