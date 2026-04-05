/**
 * CommandSystem — 传令系统
 * 核心机制: 命令下达 → 传令延迟(2-5秒) → 传达执行
 */

export enum CommandType {
  // 守方
  Deploy, FocusedFire, FreeFire, Pour, PushLadder, CloseGate,
  Repair, Sortie, CounterTunnel, Reinforce, ScatterCaltrops,
  // 攻方
  Advance, Charge, SetLadder, RamGate, Volley, Bombard,
  FillMoat, DigTunnel, Feint, Retreat, BuildBridge,
  // 全局
  SoundGong, BeatDrum,
}

export interface Command {
  id: string;
  type: CommandType;
  issuedAt: number;
  sourceUnit?: string;
  targetUnit?: string;
  targetSegment?: string;
  targetPosition?: { x: number; y: number };
  params?: Record<string, unknown>;
}

// TODO: CommandSystem class implementation
// - issueCommand(): 计算传令延迟, 加入传令队列
// - processQueue(dt): 更新传令进度, 到达后执行
// - calcDelay(): 基于距离 2-5 秒, 受运筹技能影响
