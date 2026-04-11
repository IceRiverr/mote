// engine/src/core/event.ts
// 事件总线 —— 同步派发 + 队列延迟处理

export type EventHandler = (data: any) => void;

export class EventBus {
  /** 事件名 → 处理函数列表 */
  private handlers = new Map<string, EventHandler[]>();

  /** 延迟事件队列（在 processEvents 中统一处理） */
  private queue: Array<{ event: string; data: any }> = [];

  /**
   * 注册事件监听器
   */
  on(event: string, handler: EventHandler): void {
    let list = this.handlers.get(event);
    if (!list) {
      list = [];
      this.handlers.set(event, list);
    }
    list.push(handler);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, handler: EventHandler): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  /**
   * 立即派发事件（同步调用所有 handler）
   */
  emit(event: string, data?: any): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      list[i](data);
    }
  }

  /**
   * 将事件加入队列，延迟到 processEvents 时处理
   * 用于避免帧内事件处理顺序问题
   */
  enqueue(event: string, data?: any): void {
    this.queue.push({ event, data });
  }

  /**
   * 处理所有队列中的事件
   * 支持事件处理中产生新事件（drain 模式）
   */
  processQueue(): void {
    // 使用 while 循环，因为处理事件可能产生新事件
    let safety = 0;
    while (this.queue.length > 0 && safety < 1000) {
      const batch = this.queue.splice(0);
      for (const { event, data } of batch) {
        this.emit(event, data);
      }
      safety++;
    }

    if (safety >= 1000) {
      console.warn('[EventBus] Possible infinite event loop detected');
    }
  }

  /**
   * 清空所有监听器和队列
   */
  clear(): void {
    this.handlers.clear();
    this.queue.length = 0;
  }
}
