// engine/src/plugins/audio/components.ts
// 音频组件

/** 音频发射器组件 —— 实体发出音效 */
export class AudioEmitter {
  /** 音效资源键 */
  soundKey = '';
  /** 音量 (0..1) */
  volume = 1;
  /** 音调 (0.5..2) */
  pitch = 1;
  /** 是否循环 */
  loop = false;
  /** 是否自动播放 */
  autoPlay = false;
  /** 播放触发后是否自动移除组件 */
  oneShot = true;
  /** 空间音效：最大可听距离 */
  maxDistance?: number;
  /** 空间音效：当前实体位置X（由系统更新） */
  x = 0;
  /** 空间音效：当前实体位置Y（由系统更新） */
  y = 0;
}

/** 背景音乐组件 —— 只有一个实体应该拥有此组件 */
export class BGMPlayer {
  /** 当前播放的BGM键 */
  currentTrack = '';
  /** 目标BGM键（用于切换） */
  nextTrack = '';
  /** 切换时的淡入淡出时间（秒） */
  fadeDuration = 0.5;
  /** 音量 */
  volume = 1;
}

// 声明组件类型
declare module '../../core/componentRegistry' {
  interface ComponentMap {
    AudioEmitter: AudioEmitter;
    BGMPlayer: BGMPlayer;
  }
}
