/**
 * CommandSystem -- 传令系统
 *
 * Core mechanic: Player issues a command -> messenger runs with delay (2-5s game
 * time based on distance) -> command delivered to target unit for execution.
 *
 * Global commands (鸣金 SoundGong / 擂鼓 BeatDrum) bypass the messenger queue
 * and execute immediately on all units.
 *
 * The system owns a simple EventEmitter so other subsystems (AI, UI, audio) can
 * react to command lifecycle events without tight coupling.
 */

// ── Vec2 helper (lightweight, no engine dependency) ─────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ── EventEmitter ────────────────────────────────────────────────────────────

export type EventHandler = (...args: unknown[]) => void;

export class EventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    const list = this.listeners.get(event);
    if (list) {
      list.push(handler);
    } else {
      this.listeners.set(event, [handler]);
    }
  }

  off(event: string, handler: EventHandler): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    if (list.length === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const handler of list) {
      handler(...args);
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// ── Command enums & interfaces ──────────────────────────────────────────────

/**
 * All 24 command types.
 * 11 defender commands + 11 attacker commands + 2 global commands.
 */
export enum CommandType {
  // ── Defender (守方) 11 commands ──
  Deploy         = 'deploy',           // 部署: 移动单位至指定城墙段/区域
  FocusedFire    = 'focused_fire',     // 集中射击: +50% 火力集火指定区域
  FreeFire       = 'free_fire',        // 自由射击: AI 自选目标 (默认)
  Pour           = 'pour',             // 倾倒: 火油/粪水/滚石
  PushLadder     = 'push_ladder',      // 推倒云梯: 需 2 名士兵
  CloseGate      = 'close_gate',       // 关闭闸门: 瓮城, 一次性
  Repair         = 'repair',           // 修复: 消耗石材修城墙
  Sortie         = 'sortie',           // 出城突袭: 精锐小队出击
  CounterTunnel  = 'counter_tunnel',   // 反地道: 部署听瓮/挖反地道
  Reinforce      = 'reinforce',        // 增援: 调预备队上墙
  ScatterCaltrops = 'scatter_caltrops', // 撒铁蒺藜: 墙基区域

  // ── Attacker (攻方) 11 commands ──
  Advance        = 'advance',          // 推进: 器械/单位向城墙推进
  Charge         = 'charge',           // 冲锋: 全速冲向城墙, 无视伤亡
  SetLadder      = 'set_ladder',       // 架设云梯: 工兵在城墙段架梯
  RamGate        = 'ram_gate',         // 撞门: 攻城锤持续撞击城门
  Volley         = 'volley',           // 齐射: 压制指定城墙段
  Bombard        = 'bombard',          // 投石: 投石机轰击城墙/建筑
  FillMoat       = 'fill_moat',        // 填壕: 工兵填壕
  DigTunnel      = 'dig_tunnel',       // 挖地道: 工兵挖掘
  Feint          = 'feint',            // 佯攻: 引诱守方火力
  Retreat        = 'retreat',          // 撤退: 后撤至安全区
  BuildBridge    = 'build_bridge',     // 搭桥: 护城河上搭建简易桥

  // ── Global (全局) 2 commands ──
  SoundGong      = 'sound_gong',       // 鸣金: 全军撤退 (即时)
  BeatDrum       = 'beat_drum',        // 擂鼓: 全军进攻 (即时)
}

/**
 * A command issued by the player (主将).
 */
export interface Command {
  /** Unique command identifier. */
  id: string;
  /** The command type to execute. */
  type: CommandType;
  /** Game time (seconds) when the command was issued. */
  issuedAt: number;
  /** ID of the unit/officer issuing the command (usually the commander). */
  sourceUnit?: string;
  /** ID of the target unit to receive this command. */
  targetUnit?: string;
  /** ID of the target wall segment (城墙段). */
  targetSegment?: string;
  /** World position target for the command. */
  targetPosition?: Vec2;
  /** Additional parameters (resource type, quantity, etc.). */
  params?: Record<string, unknown>;
}

/**
 * A command currently being carried by a messenger (传令兵).
 */
export interface CommandInTransit {
  /** The command being delivered. */
  command: Command;
  /** Game time at which the command will be delivered. */
  deliveryTime: number;
  /** Delivery progress 0..1 (for UI messenger animation). */
  progress: number;
  /** Total delay in seconds for this delivery. */
  totalDelay: number;
}

/**
 * Minimal game state interface required by the CommandSystem.
 * Decoupled from the full SiegeWarContext to keep this module self-contained.
 */
export interface CommandGameState {
  /** Current game time in seconds. */
  gameTime: number;
  /** World position of the commander (主将). */
  commanderPos: Vec2;
  /** Active skill set -- used for delay reduction. */
  skills: Set<string>;
  /** Event bus for dispatching command lifecycle events. */
  events: EventEmitter;
}

// ── CommandSystem ───────────────────────────────────────────────────────────

/** Counter for generating unique command IDs. */
let commandIdCounter = 0;

/** Generate a unique command ID. */
export function generateCommandId(): string {
  return `cmd_${++commandIdCounter}_${Date.now().toString(36)}`;
}

/**
 * CommandSystem manages the full lifecycle of player commands:
 *
 * 1. **Issue** -- player picks a command; system calculates messenger delay.
 * 2. **In-transit** -- messenger runs across the battlefield (2-5 s game time).
 * 3. **Deliver** -- command reaches the target unit; event emitted.
 * 4. **Cancel** -- player may cancel a pending command before delivery.
 *
 * Events emitted:
 * - `command:dispatched`  -- command enters the messenger queue
 * - `command:delivered`   -- command reached its target
 * - `command:cancelled`   -- command was cancelled before delivery
 * - `command:immediate`   -- global command executed immediately (gong/drum)
 */
export class CommandSystem {
  /** Messenger queue -- commands currently being delivered. */
  private queue: CommandInTransit[] = [];

  /** Internal game clock (seconds). */
  private gameTime: number = 0;

  /** Cross-system event bus. */
  public readonly events: EventEmitter = new EventEmitter();

  /** History of delivered commands (most recent N for debugging / replay). */
  private history: Command[] = [];
  private readonly maxHistory: number = 100;

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Issue a command from the player.
   *
   * Global commands (SoundGong / BeatDrum) execute immediately.
   * All others enter the messenger queue with a distance-based delay.
   */
  issueCommand(cmd: Command, gameState: CommandGameState): void {
    // Stamp issue time
    cmd.issuedAt = this.gameTime;

    // Global commands -- no delay, immediate execution
    if (cmd.type === CommandType.SoundGong || cmd.type === CommandType.BeatDrum) {
      this.executeImmediately(cmd, gameState);
      return;
    }

    // Calculate messenger travel delay
    const targetPos = cmd.targetPosition ?? { x: 0, y: 0 };
    const distance = this.calcDistance(gameState.commanderPos, targetPos);
    const delay = this.calcDelay(distance, gameState.skills);

    const transit: CommandInTransit = {
      command: cmd,
      deliveryTime: this.gameTime + delay,
      progress: 0,
      totalDelay: delay,
    };

    this.queue.push(transit);

    // Notify listeners -- UI spawns messenger sprite, audio plays horn
    this.events.emit('command:dispatched', {
      command: cmd,
      delay,
      messengerStart: { ...gameState.commanderPos },
      messengerEnd: targetPos,
    });
  }

  /**
   * Advance the game clock and process all pending commands.
   * Called once per frame from the main game loop.
   *
   * @param dt - Delta time in seconds since last frame.
   */
  processQueue(dt: number): void {
    this.gameTime += dt;

    // Iterate backwards so splice doesn't skip entries
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      // Update progress (0..1) for UI messenger animation
      const elapsed = this.gameTime - (item.deliveryTime - item.totalDelay);
      item.progress = Math.min(1, Math.max(0, elapsed / item.totalDelay));

      // Deliver if time has come
      if (this.gameTime >= item.deliveryTime) {
        this.deliverCommand(item.command);
        this.queue.splice(i, 1);
      }
    }
  }

  /**
   * Cancel a pending command by its ID.
   * Returns true if the command was found and removed.
   */
  cancelCommand(cmdId: string): boolean {
    const idx = this.queue.findIndex((t) => t.command.id === cmdId);
    if (idx === -1) return false;

    const cancelled = this.queue.splice(idx, 1)[0];
    this.events.emit('command:cancelled', {
      command: cancelled.command,
      progress: cancelled.progress,
    });
    return true;
  }

  /**
   * Get a snapshot of all commands currently in transit.
   * Used by the UI to render messenger positions and progress bars.
   */
  getMessengerQueue(): ReadonlyArray<CommandInTransit> {
    return this.queue;
  }

  /**
   * Get the current internal game time.
   */
  getGameTime(): number {
    return this.gameTime;
  }

  /**
   * Manually set the game time (for loading saves, rewinding, etc.).
   */
  setGameTime(t: number): void {
    this.gameTime = t;
  }

  /**
   * Get the most recent delivered commands (for debugging / replay UI).
   */
  getHistory(): ReadonlyArray<Command> {
    return this.history;
  }

  /**
   * Clear the messenger queue (e.g. on phase change or level reset).
   */
  clearQueue(): void {
    this.queue.length = 0;
  }

  /**
   * Return the number of commands currently in transit.
   */
  getPendingCount(): number {
    return this.queue.length;
  }

  // ── Delay Calculation ───────────────────────────────────────────────────

  /**
   * Calculate messenger delivery delay based on distance and skills.
   *
   * Formula: baseDelay = 2 + (distance / 200) * 3
   * This maps distance 0 -> 2 s, distance 200 -> 5 s (linear interpolation).
   *
   * Skill modifiers:
   * - 运筹 (Strategic Planning): delay * 0.8 (-20%)
   *
   * Result is clamped to [1, 8] seconds to prevent extremes.
   */
  calcDelay(distance: number, skills: Set<string>): number {
    const baseDelay = 2 + (distance / 200) * 3;

    let modifier = 1.0;
    if (skills.has('运筹')) {
      modifier *= 0.8;
    }

    const finalDelay = baseDelay * modifier;
    return Math.max(1, Math.min(8, finalDelay));
  }

  /**
   * Euclidean distance between two points.
   */
  calcDistance(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  /**
   * Deliver a command: emit the `command:delivered` event so the target
   * unit's script (or the AI system) can begin execution.
   */
  private deliverCommand(cmd: Command): void {
    // Push to history ring buffer
    this.history.push(cmd);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.events.emit('command:delivered', { command: cmd });
  }

  /**
   * Execute a global command immediately (SoundGong / BeatDrum).
   * These affect ALL units on the issuing side without messenger delay.
   */
  private executeImmediately(cmd: Command, gameState: CommandGameState): void {
    // Push to history
    this.history.push(cmd);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.events.emit('command:immediate', { command: cmd });

    // Also emit delivered so unit scripts can react uniformly
    this.events.emit('command:delivered', { command: cmd });
  }
}
