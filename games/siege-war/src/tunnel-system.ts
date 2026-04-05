/**
 * TunnelSystem — 地道系统
 * 管理地下 Tile 层: 挖掘进度、路线、坍塌、遭遇战触发
 */

export interface TunnelRoute {
  id: string;
  side: 'attacker' | 'defender';
  purpose: 'penetrate' | 'collapse' | 'reconnaissance';
  tiles: Array<{ col: number; row: number; dug: boolean }>;
  progress: number;        // 0-1
  engineerCount: number;
  hasSupport: boolean;
  hasVentilation: boolean;
  detected: boolean;
}

// TODO: TunnelSystem class
// - startDigging(): 创建路线, 分配工兵
// - update(dt): 推进挖掘进度, 检测坍塌风险
// - getActiveDigging(): 返回所有活跃挖掘点(供听瓮检测)
// - checkEncounter(): 攻守地道交汇判定 → 触发遭遇战
