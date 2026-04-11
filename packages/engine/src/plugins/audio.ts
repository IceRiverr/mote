// engine/src/plugins/audio.ts
// 音频插件 —— 音效和背景音乐管理

import type { World } from '../core/world';
import { ComponentRegistry } from '../core/component';

// ═════════════════════════════════════════════════════════════════════════════
// 组件定义
// ═════════════════════════════════════════════════════════════════════════════

/** 音频发射器组件 —— 实体发出音效 */
export class AudioEmitter {
  /** 音效资源键 */
  soundKey: string = '';
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
  currentTrack: string = '';
  /** 目标BGM键（用于切换） */
  nextTrack: string = '';
  /** 切换时的淡入淡出时间（秒） */
  fadeDuration = 0.5;
  /** 音量 */
  volume = 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// 音频管理器
// ═════════════════════════════════════════════════════════════════════════════

export interface SoundAsset {
  key: string;
  url?: string;
  urls?: string[];
}

export interface PlayOptions {
  volume?: number;
  pitch?: number;
  loop?: boolean;
  pan?: number;
}

export class AudioManager {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  readonly sfxGain: GainNode;
  readonly musicGain: GainNode;

  private cache = new Map<string, AudioBuffer>();
  private currentBGM: AudioBufferSourceNode | null = null;
  private currentBGMGain: GainNode | null = null;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.setupAutoResume();
  }

  /** 加载音效 */
  async load(key: string, url: string): Promise<void> {
    if (this.cache.has(key)) return;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load sound: ${url}`);

    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
    this.cache.set(key, audioBuf);
  }

  /** 批量加载 */
  async loadBatch(assets: SoundAsset[]): Promise<void> {
    await Promise.all(assets.map(a => {
      const url = a.url ?? this.pickSupportedUrl(a.urls ?? []);
      if (url) return this.load(a.key, url);
      console.warn(`No supported format for: ${a.key}`);
    }));
  }

  /** 播放音效 */
  play(key: string, options?: PlayOptions): void {
    const buffer = this.cache.get(key);
    if (!buffer) {
      console.warn(`Sound not loaded: ${key}`);
      return;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options?.pitch ?? 1;

    const gain = this.ctx.createGain();
    gain.gain.value = options?.volume ?? 1;

    if (options?.pan !== undefined) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = options.pan;
      source.connect(gain).connect(panner).connect(this.sfxGain);
    } else {
      source.connect(gain).connect(this.sfxGain);
    }

    source.start(0);
  }

  /** 播放背景音乐（带淡入淡出切换） */
  playBGM(key: string, fadeDuration = 0.5): void {
    const buffer = this.cache.get(key);
    if (!buffer) {
      console.warn(`BGM not loaded: ${key}`);
      return;
    }

    // 淡出当前BGM
    if (this.currentBGM && this.currentBGMGain) {
      const now = this.ctx.currentTime;
      this.currentBGMGain.gain.setValueAtTime(this.currentBGMGain.gain.value, now);
      this.currentBGMGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      this.currentBGM.stop(now + fadeDuration);
    }

    // 淡入新BGM
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.musicGain);
    source.connect(gain);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeDuration);

    source.start(0);
    this.currentBGM = source;
    this.currentBGMGain = gain;
  }

  /** 停止BGM */
  stopBGM(fadeDuration = 0.5): void {
    if (this.currentBGM && this.currentBGMGain) {
      const now = this.ctx.currentTime;
      this.currentBGMGain.gain.setValueAtTime(this.currentBGMGain.gain.value, now);
      this.currentBGMGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      this.currentBGM.stop(now + fadeDuration);
      this.currentBGM = null;
      this.currentBGMGain = null;
    }
  }

  /** 停止所有音效 */
  stopAllSFX(): void {
    // 简化实现：断开并重新连接 sfxGain 会停止所有连接到它的源
    this.sfxGain.disconnect();
    this.sfxGain.connect(this.masterGain);
  }

  get masterVolume(): number { return this.masterGain.gain.value; }
  set masterVolume(v: number) { this.masterGain.gain.value = v; }

  get sfxVolume(): number { return this.sfxGain.gain.value; }
  set sfxVolume(v: number) { this.sfxGain.gain.value = v; }

  get musicVolume(): number { return this.musicGain.gain.value; }
  set musicVolume(v: number) { this.musicGain.gain.value = v; }

  destroy(): void {
    this.stopBGM(0);
    this.cache.clear();
    this.ctx.close();
  }

  private pickSupportedUrl(urls: string[]): string | null {
    const a = document.createElement('audio');
    for (const url of urls) {
      const ext = url.split('.').pop()?.toLowerCase();
      if (ext === 'wav' && a.canPlayType('audio/wav')) return url;
      if (ext === 'ogg' && a.canPlayType('audio/ogg; codecs="vorbis"')) return url;
      if (ext === 'mp3' && a.canPlayType('audio/mpeg')) return url;
    }
    return urls[0] ?? null;
  }

  private setupAutoResume(): void {
    if (this.ctx.state === 'running') return;

    const unlock = () => {
      this.ctx.resume().then(() => {
        // iOS Safari 解锁需要播放一个空 buffer
        const buf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.ctx.destination);
        src.start(0);
      });

      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };

    document.addEventListener('click', unlock);
    document.addEventListener('touchstart', unlock);
    document.addEventListener('keydown', unlock);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════════════════════════════════

/** 处理 AudioEmitter 组件 */
function audioEmitterSystem(world: World, dt: number): void {
  const audio = world.getResource<AudioManager>('audio');
  if (!audio) return;

  // 获取监听器位置（有 Camera 组件的实体，或第一个有 Transform 的实体）
  let listenerX = 0;
  let listenerY = 0;
  // TODO: 从 Camera 组件读取

  for (const eid of world.query(AudioEmitter)) {
    const emitter = world.get(eid, AudioEmitter);

    // 更新位置（如果有 Transform 组件）
    // TODO: 读取 Transform 位置

    if (emitter.autoPlay) {
      const options: PlayOptions = {
        volume: emitter.volume,
        pitch: emitter.pitch,
        loop: emitter.loop,
      };

      // 空间音效计算
      if (emitter.maxDistance !== undefined) {
        const dx = emitter.x - listenerX;
        const dy = emitter.y - listenerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < emitter.maxDistance) {
          options.volume *= 1 - dist / emitter.maxDistance;
          options.pan = dx / emitter.maxDistance;
          audio.play(emitter.soundKey, options);
        }
      } else {
        audio.play(emitter.soundKey, options);
      }

      if (emitter.oneShot) {
        world.remove(eid, AudioEmitter);
      } else {
        emitter.autoPlay = false;
      }
    }
  }
}

/** 处理 BGMPlayer 组件 */
function bgmPlayerSystem(world: World, dt: number): void {
  const audio = world.getResource<AudioManager>('audio');
  if (!audio) return;

  for (const eid of world.query(BGMPlayer)) {
    const player = world.get(eid, BGMPlayer);

    if (player.nextTrack && player.nextTrack !== player.currentTrack) {
      audio.playBGM(player.nextTrack, player.fadeDuration);
      player.currentTrack = player.nextTrack;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 插件导出
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 音频插件
 * 
 * ```ts
 * world.use(AudioPlugin);
 * 
 * // 播放音效
 * entity.add(AudioEmitter, { soundKey: 'explosion', oneShot: true });
 * 
 * // 切换BGM
 * bgmEntity.add(BGMPlayer, { nextTrack: 'battle_theme' });
 * ```
 */
export function AudioPlugin(world: World): void {
  const manager = new AudioManager();
  world.addResource('audio', manager);
  world.addSystem(audioEmitterSystem);
  world.addSystem(bgmPlayerSystem);

  world.on('destroy', () => manager.destroy());
}

// 声明组件类型
declare module '../core/component' {
  interface ComponentMap {
    AudioEmitter: AudioEmitter;
    BGMPlayer: BGMPlayer;
  }
}
