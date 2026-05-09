// engine/src/plugins/audio/plugin.ts
// 音频插件 —— 音效和背景音乐管理

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { ScheduleLabel } from '../../core/schedule.js';
import { AudioEmitter, BGMPlayer } from './components.js';
import { audioEmitterSystem, bgmPlayerSystem } from './systems.js';

export { AudioEmitter, BGMPlayer } from './components.js';

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

  async load(key: string, url: string): Promise<void> {
    if (this.cache.has(key)) return;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load sound: ${url}`);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
    this.cache.set(key, audioBuf);
  }

  async loadBatch(assets: SoundAsset[]): Promise<void> {
    await Promise.all(assets.map(a => {
      const url = a.url ?? this.pickSupportedUrl(a.urls ?? []);
      if (url) return this.load(a.key, url);
      console.warn(`No supported format for: ${a.key}`);
    }));
  }

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

  playBGM(key: string, fadeDuration = 0.5): void {
    const buffer = this.cache.get(key);
    if (!buffer) {
      console.warn(`BGM not loaded: ${key}`);
      return;
    }
    if (this.currentBGM && this.currentBGMGain) {
      const now = this.ctx.currentTime;
      this.currentBGMGain.gain.setValueAtTime(this.currentBGMGain.gain.value, now);
      this.currentBGMGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
      this.currentBGM.stop(now + fadeDuration);
    }
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

  stopAllSFX(): void {
    this.sfxGain.disconnect();
    this.sfxGain.connect(this.masterGain);
  }

  get masterVolume(): number { return this.masterGain.gain.value; }
  set masterVolume(v: number) { this.masterGain.gain.value = v; }
  get sfxVolume(): number { return this.sfxGain.gain.value; }
  set sfxVolume(v: number) { this.sfxGain.gain.value = v; }
  get musicVolume(): number { return this.musicGain.gain.value; }
  set musicVolume(v: number) { this.musicGain.gain.value = v; }

  register(key: string, buffer: AudioBuffer): void {
    this.cache.set(key, buffer);
  }

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
// AudioPlugin
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 音频插件
 *
 * ```ts
 * app.addPlugin(AudioPlugin);
 *
 * // 播放音效
 * entity.add(AudioEmitter, { soundKey: 'explosion', oneShot: true });
 *
 * // 切换BGM
 * bgmEntity.add(BGMPlayer, { nextTrack: 'battle_theme' });
 * ```
 */
export const AudioPlugin: Plugin = {
  name: 'audio',

  build(app: App) {
    const manager = new AudioManager();
    app.insertResource('audio', manager);
    app.addSystems(ScheduleLabel.Update, [
      { name: 'audioEmitter', update: audioEmitterSystem },
      { name: 'bgmPlayer', update: bgmPlayerSystem },
    ]);
  },
};
