/**
 * ListeningPotSystem — 听瓮系统
 * 模糊信号探测 + 多瓮三角定位 + 可信度评估
 */

export interface PotSignal {
  potId: string;
  potX: number;
  potY: number;
  intensity: 0 | 1 | 2 | 3;   // 无/远/中/近
  direction: number;            // 弧度, 量化到45度
  active: boolean;
}

export interface SuspiciousArea {
  id: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: number;          // 0-100
  markedAt: number;
}

// TODO: ListeningPotSystem class
// - update(): 遍历所有听瓮, 计算信号
// - triangulate(): 多瓮交叉定位
// - markSuspiciousArea(): 标记可疑区域
// - getConfidence(): 根据信号数据计算可信度
