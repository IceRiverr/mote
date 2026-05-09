// engine/src/core/app.ts
// App —— ECS 装配门面，串联 World + Schedule + Plugin

import type { ComponentClass, Prefab } from './types.js';
import { ComponentRegistry } from './componentRegistry.js';
import { World } from './world.js';
import type { Plugin } from './plugin.js';
import type { SystemObj } from './system.js';
import { ScheduleLabel } from './schedule.js';
import { Commands } from './commands.js';

// ═════════════════════════════════════════════════════════════════════════════
// Time 资源（由 CorePlugin 注册，App 内部也依赖它）
// ═════════════════════════════════════════════════════════════════════════════

/** 时间管理资源 */
export class Time {
  /** 上一帧间隔（秒） */
  dt = 0;
  /** 固定时间步间隔（秒） */
  fixedDt = 0;
  /** 总运行时间（秒） */
  elapsed = 0;
  /** 帧计数 */
  frame = 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// App
// ═════════════════════════════════════════════════════════════════════════════

/** 系统错误回调签名 */
export type SystemErrorHandler = (
  name: string,
  error: Error,
  label: ScheduleLabel,
) => void;

export class App {
  /** 组件类型注册表 */
  readonly registry = new ComponentRegistry();

  /** ECS 世界实例 */
  readonly world: World;

  /** 已安装插件（name → Plugin） */
  private _plugins = new Map<string, Plugin>();

  /** 各阶段系统列表 */
  private _schedules = new Map<ScheduleLabel, SystemObj[]>();

  /** rAF 状态 */
  private _running = false;
  private _rafId = 0;
  private _lastTime = 0;

  /** 固定时间步 */
  private _fixedAccumulator = 0;
  private _fixedDt: number;

  /** Time 资源引用（内部使用） */
  private _time: Time;

  /** 系统错误回调 */
  private _systemErrorHandlers: SystemErrorHandler[] = [];

  /** 系统执行耗时（dev mode） */
  private _systemTimings = new Map<string, number>();

  constructor(options?: { fixedHz?: number }) {
    this.world = new World(this.registry);
    this._fixedDt = 1000 / (options?.fixedHz ?? 60);

    // 初始化所有 schedule
    for (const label of Object.values(ScheduleLabel)) {
      this._schedules.set(label, []);
    }

    // 内置 Time 资源
    this._time = new Time();
    this.insertResource('Time', this._time);
  }

  // ─── Plugin ───

  /** 注册单个 Plugin（自动展开依赖，去重，检测循环依赖） */
  async addPlugin(plugin: Plugin, stack?: Set<string>): Promise<this> {
    if (this._plugins.has(plugin.name)) return this;

    const s = stack ?? new Set<string>();
    if (s.has(plugin.name)) {
      const chain = [...s, plugin.name].join(' -> ');
      throw new Error(`[App] Circular plugin dependency detected: ${chain}`);
    }
    s.add(plugin.name);

    // 先装依赖
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this._plugins.has(dep.name)) {
          await this.addPlugin(dep, s);
        }
      }
    }

    s.delete(plugin.name);

    // 执行 build
    await plugin.build(this);
    this._plugins.set(plugin.name, plugin);
    return this;
  }

  /** 批量注册 Plugin */
  async addPlugins(plugins: readonly Plugin[]): Promise<this> {
    for (const p of plugins) {
      await this.addPlugin(p);
    }
    return this;
  }

  // ─── Component ───

  /** 注册组件到类型表（name 可选，默认使用 ctor.name） */
  registerComponent<T>(ctor: ComponentClass<T>, name?: string): this {
    this.registry.register(ctor, name);
    return this;
  }

  // ─── System ───

  /** 添加系统到指定 Schedule */
  addSystems(label: ScheduleLabel, systems: readonly SystemObj[]): this {
    const list = this._schedules.get(label)!;
    for (const sys of systems) {
      list.push(sys);
    }
    return this;
  }

  // ─── Resource ───

  /**
   * 插入全局资源（按值类型自动推断 key）
   * ```ts
   * app.insertResource(new InputManager(canvas));
   * ```
   */
  insertResource<T>(value: T): this;

  /**
   * 插入全局资源（显式指定 key）
   * ```ts
   * app.insertResource('input', manager);
   * app.insertResource(MyClass, instance);
   * ```
   */
  insertResource<T>(key: string | ComponentClass<T>, value: T): this;

  insertResource<T>(...args: any[]): this {
    if (args.length === 1) {
      const value = args[0];
      const key = value?.constructor?.name ?? 'anonymous';
      this.world.addResource(key, value);
    } else {
      const [key, value] = args;
      const k = typeof key === 'string' ? key : key.name;
      this.world.addResource(k, value);
    }
    return this;
  }

  /** 获取全局资源 */
  getResource<T>(key: string | ComponentClass<T>): T {
    const k = typeof key === 'string' ? key : key.name;
    return this.world.getResource<T>(k);
  }

  // ─── Prefab ───

  /** 注册 Prefab */
  registerPrefab(id: string, prefab: Prefab): this {
    this.world.registerPrefab(id, prefab);
    return this;
  }

  // ─── 运行 ───

  // ─── 诊断 ───

  /** 注册系统错误回调 */
  onSystemError(handler: SystemErrorHandler): this {
    this._systemErrorHandlers.push(handler);
    return this;
  }

  /** 获取系统执行耗时（dev mode，毫秒） */
  getSystemTimings(): Map<string, number> {
    return new Map(this._systemTimings);
  }

  /** @internal 执行单个系统，带 try-catch 和计时 */
  private _runSystem(
    sys: SystemObj,
    label: ScheduleLabel,
    dt: number,
    cmd: Commands,
  ): void {
    const name = sys.name ?? 'anonymous';

    const start = performance.now();

    try {
      sys.update(this.world, dt, cmd);
    } catch (e) {
      for (const h of this._systemErrorHandlers) {
        h(name, e as Error, label);
      }
    }

    const elapsed = performance.now() - start;
    this._systemTimings.set(name, elapsed);
  }

  // ─── 运行 ───

  /** 启动 rAF 循环 */
  run(): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();

    // Startup 阶段
    const startupCmd = new Commands(this.world);
    for (const sys of this._schedules.get(ScheduleLabel.Startup)!) {
      this._runSystem(sys, ScheduleLabel.Startup, 0, startupCmd);
    }
    startupCmd.flush();

    this._tick(performance.now());
  }

  /** 停止 rAF 循环 */
  stop(): void {
    this._running = false;
    cancelAnimationFrame(this._rafId);

    // 反向遍历已安装插件，调用 teardown（可选）
    const pluginNames = Array.from(this._plugins.keys()).reverse();
    for (const name of pluginNames) {
      const plugin = this._plugins.get(name);
      if (plugin?.teardown) {
        plugin.teardown(this);
      }
    }
  }

  /** 单帧更新（供外部驱动；内部 run() 也调用它） */
  update(dt: number): void {
    this._time.dt = dt;
    this._time.elapsed += dt;
    this._time.frame++;

    const cmd = new Commands(this.world);

    // First
    for (const sys of this._schedules.get(ScheduleLabel.First)!) {
      this._runSystem(sys, ScheduleLabel.First, dt, cmd);
    }

    // PreUpdate
    for (const sys of this._schedules.get(ScheduleLabel.PreUpdate)!) {
      this._runSystem(sys, ScheduleLabel.PreUpdate, dt, cmd);
    }

    // FixedUpdate（可能多次）
    this._fixedAccumulator += dt * 1000;
    while (this._fixedAccumulator >= this._fixedDt) {
      this._time.fixedDt = this._fixedDt / 1000;
      for (const sys of this._schedules.get(ScheduleLabel.FixedUpdate)!) {
        this._runSystem(sys, ScheduleLabel.FixedUpdate, this._time.fixedDt, cmd);
      }
      this.world.processEvents();
      this._fixedAccumulator -= this._fixedDt;
    }

    // Update
    for (const sys of this._schedules.get(ScheduleLabel.Update)!) {
      this._runSystem(sys, ScheduleLabel.Update, dt, cmd);
    }

    // PostUpdate
    for (const sys of this._schedules.get(ScheduleLabel.PostUpdate)!) {
      this._runSystem(sys, ScheduleLabel.PostUpdate, dt, cmd);
    }

    this.world.processEvents();
    cmd.flush();
  }

  /** 渲染帧（run() 自动调用；也可外部驱动） */
  render(): void {
    const cmd = new Commands(this.world);

    // PreRender
    for (const sys of this._schedules.get(ScheduleLabel.PreRender)!) {
      this._runSystem(sys, ScheduleLabel.PreRender, 0, cmd);
    }

    // Render
    for (const sys of this._schedules.get(ScheduleLabel.Render)!) {
      this._runSystem(sys, ScheduleLabel.Render, 0, cmd);
    }

    // Last
    for (const sys of this._schedules.get(ScheduleLabel.Last)!) {
      this._runSystem(sys, ScheduleLabel.Last, 0, cmd);
    }

    cmd.flush();
  }

  // ─── 内部 ───

  private _tick = (now: number): void => {
    if (!this._running) return;

    let dt = now - this._lastTime;
    this._lastTime = now;

    // 防止标签页切换后 dt 爆炸
    if (dt > 200) dt = 200;

    this.update(dt / 1000);
    this.render();

    this._rafId = requestAnimationFrame(this._tick);
  };
}
