// engine/src/core/schedule.ts
// Schedule 标签 —— 系统执行分层

/** 系统执行阶段标签 */
export enum ScheduleLabel {
  /** 启动时执行一次 */
  Startup = 'Startup',
  /** 每帧最先执行 */
  First = 'First',
  /** 输入处理 */
  PreUpdate = 'PreUpdate',
  /** 固定时间步逻辑（每帧 0~N 次） */
  FixedUpdate = 'FixedUpdate',
  /** 游戏逻辑 */
  Update = 'Update',
  /** 状态同步 */
  PostUpdate = 'PostUpdate',
  /** 相机更新 */
  PreRender = 'PreRender',
  /** 渲染提交 */
  Render = 'Render',
  /** 帧尾清理 */
  Last = 'Last',
}
