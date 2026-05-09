# Audio System Design

Mote 引擎的音频系统 —— 纯 Web Audio API 实现，零依赖。

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Autoplay Policy Handling](#2-autoplay-policy-handling)
3. [Asset Loading & Cache](#3-asset-loading--cache)
4. [Sound Instance & Pooling](#4-sound-instance--pooling)
5. [Bus Routing & Volume Control](#5-bus-routing--volume-control)
6. [Music Player with Crossfade](#6-music-player-with-crossfade)
7. [2D Spatial Audio](#7-2d-spatial-audio)
8. [Complete Public API](#8-complete-public-api)
9. [Complete Implementation](#9-complete-implementation)
10. [Engine Integration](#10-engine-integration)
11. [Comparison](#11-comparison-mote-vs-reference-engines)
12. [Recommended Audio Formats](#12-recommended-audio-formats)

---

## 1. Architecture Overview

### 1.1 Design Goals

| Goal | Description |
|------|-------------|
| **Zero-dependency** | Pure Web Audio API, no Howler.js/Tone.js |
| **Autoplay-safe** | Gracefully handle browser autoplay policies (Chrome, Safari, iOS) |
| **Lightweight** | Match Mote's philosophy — small API surface, big capability |
| **Instance pooling** | Prevent audio spam (e.g. 100 bullets = 100 overlapping sounds) |
| **Bus routing** | Master / Music / SFX gain nodes for independent volume control |
| **2D spatial** | Optional stereo panning based on world-space position |
| **BGM crossfade** | Smooth music transitions without pop/click artifacts |
| **Asset-friendly** | AudioBuffer cache with async preload + on-demand decode |

### 1.2 Signal Flow

```
┌─────────────┐    ┌──────────┐    ┌─────────────┐
│  SoundPool  │───→│ SFX Bus  │───→│             │
│  (per-key)  │    │  (Gain)  │    │             │
└─────────────┘    └──────────┘    │   Master    │───→ Destination
                                   │    Gain     │
┌─────────────┐    ┌──────────┐    │             │
│MusicPlayer  │───→│Music Bus │───→│             │
│ (crossfade) │    │  (Gain)  │    │             │
└─────────────┘    └──────────┘    └─────────────┘
```

### 1.3 Core Classes

| Class | Responsibility |
|-------|----------------|
| `AudioManager` | Singleton, owns AudioContext + bus graph + cache |
| `SoundBuffer` | Wrapper around decoded AudioBuffer |
| `SoundInstance` | One playing voice (source + gain + panner) |
| `SoundPool` | Per-asset instance limit + FIFO recycling |
| `MusicPlayer` | Dedicated BGM track with crossfade |

---

## 2. Autoplay Policy Handling

### 2.1 The Problem

All major browsers (Chrome 66+, Safari 11+, Firefox 66+, iOS全系) require a user gesture before AudioContext can produce sound. A freshly created context starts in `"suspended"` state.

### 2.2 Strategy: Lazy Resume

```typescript
private _setupAutoResume(): void {
  if (this.ctx.state === 'running') { this._unlocked = true; return; }

  const unlock = () => {
    if (this._unlocked) return;
    this.ctx.resume().then(() => {
      this._unlocked = true;
      // iOS Safari: play silent buffer to fully unlock
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      for (const evt of UNLOCK_EVENTS)
        document.removeEventListener(evt, unlock, { capture: true });
    });
  };

  for (const evt of UNLOCK_EVENTS)
    document.addEventListener(evt, unlock, { capture: true });
}

const UNLOCK_EVENTS = ['click', 'touchstart', 'touchend', 'keydown'];
```

**Key points:**

- Create AudioContext immediately (constructor), but don't worry about suspended state
- Register listeners on click / touchstart / touchend / keydown
- Call `ctx.resume()` on first gesture — returns a Promise
- Remove listeners once resumed
- iOS Safari additionally requires the first `AudioBufferSourceNode.start()` inside a user gesture callback — solved by playing a silent 1-sample buffer

---

## 3. Asset Loading & Cache

### 3.1 Load Pipeline

```
fetch(url) → ArrayBuffer → ctx.decodeAudioData() → AudioBuffer → Map cache
```

### 3.2 SoundBuffer

```typescript
export class SoundBuffer {
  constructor(
    readonly key: string,          // unique asset key
    readonly buffer: AudioBuffer,  // decoded PCM data
    readonly duration: number,     // seconds
  ) {}
}
```

### 3.3 Format Detection & Fallback

浏览器格式支持检测（基于 `HTMLAudioElement.canPlayType`）：

```typescript
export type AudioFormat = 'wav' | 'ogg' | 'mp3';

interface FormatSupport {
  wav: boolean;
  ogg: boolean;
  mp3: boolean;
}

/** Detect browser audio format support (cached, runs once) */
function detectFormats(): FormatSupport {
  const a = document.createElement('audio');
  return {
    wav: a.canPlayType('audio/wav') !== '',
    ogg: a.canPlayType('audio/ogg; codecs="vorbis"') !== '',
    mp3: a.canPlayType('audio/mpeg') !== '',
  };
}

/** Pick first supported URL from candidates */
export function pickSupportedUrl(urls: string[]): string | null;
```

**设计原则：**

- 运行时检测而非 UA 嗅探
- 结果缓存，只检测一次
- BGM 提供 OGG + MP3 fallback，自动选择浏览器支持的格式

### 3.4 SoundAsset 接口

支持单格式或多格式回退：

```typescript
export interface SoundAsset {
  key:   string;
  url?:  string;      // single URL (WAV/OGG/MP3)
  urls?: string[];    // ordered fallback list, first supported wins
}

// 使用示例
{ key: 'jump', url: '/sfx/jump.wav' }                    // 单格式
{ key: 'bgm',  urls: ['/music/bgm.ogg', '/music/bgm.mp3'] }  // 多格式回退
```

### 3.5 Cache Design

```typescript
private _cache = new Map<string, SoundBuffer>();

// 基础加载（已知 URL 可直接播放）
async load(key: string, url: string): Promise<SoundBuffer> {
  if (this._cache.has(key)) return this._cache.get(key)!;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Audio load failed: ${url} (${resp.status})`);
  const arrayBuf = await resp.arrayBuffer();
  const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
  const sb = new SoundBuffer(key, audioBuf, audioBuf.duration);
  this._cache.set(key, sb);
  return sb;
}

// 带格式回退的加载
async loadAsset(asset: SoundAsset): Promise<SoundBuffer> {
  const url = this.resolveAssetUrl(asset);  // 自动选择浏览器支持的格式
  if (!url) throw new Error(`No supported format for "${asset.key}"`);
  return this.load(asset.key, url);
}

// 批量并行加载（推荐用于场景预加载）
async loadBatch(assets: SoundAsset[]): Promise<void> {
  await Promise.all(assets.map(a => this.loadAsset(a)));
}

// 解析 SoundAsset 到具体 URL
resolveAssetUrl(asset: SoundAsset): string | null {
  if (asset.url) return asset.url;
  if (asset.urls) return pickSupportedUrl(asset.urls);
  return null;
}

// 检查特定格式是否受支持
supportsFormat(fmt: AudioFormat): boolean;
```

**Design decisions:**

- `decodeAudioData` 是异步的，但解码后的 `AudioBuffer` 是纯内存 PCM，播放时零延迟
- Key-based cache 避免重复加载
- `loadBatch` 用于场景预加载（loading screen 期间并行 decode）
- 多格式回退机制：BGM 提供 OGG + MP3，优先 OGG（压缩率更好），Safari <17 自动回退到 MP3
- 无需 HTML5 Audio fallback — Mote 目标浏览器全部支持 Web Audio API

---

## 4. Sound Instance & Pooling

### 4.1 SoundInstance

每次 `play()` 调用创建一个 `SoundInstance`，代表一个正在播放的声音：

```typescript
export class SoundInstance {
  readonly source: AudioBufferSourceNode;
  readonly gainNode: GainNode;
  readonly pannerNode: StereoPannerNode | null;
  private _alive = true;

  constructor(ctx: AudioContext, buffer: AudioBuffer, output: GainNode, opts: PlayOptions) {
    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = opts.loop ?? false;
    this.source.playbackRate.value = opts.pitch ?? 1;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = opts.volume ?? 1;

    if (opts.pan !== undefined) {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.value = clamp(opts.pan, -1, 1);
      this.source.connect(this.gainNode).connect(this.pannerNode).connect(output);
    } else {
      this.pannerNode = null;
      this.source.connect(this.gainNode).connect(output);
    }

    this.source.onended = () => { this._alive = false; };
    this.source.start(0, opts.offset ?? 0);
  }

  get alive(): boolean { return this._alive; }

  stop(fadeOut = 0): void {
    if (!this._alive) return;
    if (fadeOut > 0) {
      const now = this.source.context.currentTime;
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut);
      this.source.stop(now + fadeOut);
    } else {
      try { this.source.stop(); } catch { /* already stopped */ }
    }
    this._alive = false;
  }

  set volume(v: number) { this.gainNode.gain.value = clamp(v, 0, 1); }
  set pan(v: number)    { if (this.pannerNode) this.pannerNode.pan.value = clamp(v, -1, 1); }
  set pitch(v: number)  { this.source.playbackRate.value = Math.max(0.01, v); }
}
```

### 4.2 SoundPool — 防止音效轰炸

```typescript
class SoundPool {
  private _instances: SoundInstance[] = [];
  constructor(readonly maxInstances: number = 8) {}

  add(inst: SoundInstance): void {
    this._instances = this._instances.filter(i => i.alive);  // lazy GC
    if (this._instances.length >= this.maxInstances) {
      this._instances[0].stop(0.05);  // micro-fade避免click
      this._instances.shift();         // FIFO eviction
    }
    this._instances.push(inst);
  }

  stopAll(fadeOut = 0): void {
    for (const i of this._instances) i.stop(fadeOut);
    this._instances.length = 0;
  }

  get activeCount(): number {
    this._instances = this._instances.filter(i => i.alive);
    return this._instances.length;
  }
}
```

**Pooling strategy:**

- 每个 key（音效资源）一个 `SoundPool`
- 默认上限 8 个同时实例（可配置）
- 超限时停掉最老的实例（FIFO eviction），带 50ms micro-fade 避免 click
- 每次 add 时顺便清理已结束的实例（lazy GC）

---

## 5. Bus Routing & Volume Control

### 5.1 三级 Gain Bus

```typescript
this.masterGain = ctx.createGain();
this.sfxGain    = ctx.createGain();
this.musicGain  = ctx.createGain();

this.sfxGain.connect(this.masterGain);
this.musicGain.connect(this.masterGain);
this.masterGain.connect(ctx.destination);
```

### 5.2 Volume API

```typescript
get/set masterVolume: number;  // 0..1
get/set sfxVolume: number;     // 0..1
get/set musicVolume: number;   // 0..1
```

Volume 独立控制：玩家设置 SFX=0.3 不影响 Music=0.8，Master 统一调节总输出。

---

## 6. Music Player with Crossfade

### 6.1 BGM vs SFX 差异

| Feature | SFX | BGM |
|---------|-----|-----|
| Concurrent instances | Multiple (pooled) | 1-2 (crossfade) |
| Looping | Rare | Almost always |
| Volume channel | SFX bus | Music bus |
| Transitions | Instant | Crossfade |

### 6.2 MusicPlayer

```typescript
export class MusicPlayer {
  private _current: SoundInstance | null = null;
  private _currentKey: string | null = null;

  get currentKey(): string | null { return this._currentKey; }
  get isPlaying(): boolean { return this._current?.alive ?? false; }

  play(key: string, fadeDuration = 0.5): void {
    if (this._currentKey === key && this._current?.alive) return;  // 同曲no-op
    if (this._current?.alive) this._current.stop(fadeDuration);    // fade out old

    const inst = this.mgr.createInstance(key, { loop: true, volume: 0, bus: 'music' });
    if (inst) {
      const now = this.mgr.ctx.currentTime;
      inst.gainNode.gain.setValueAtTime(0, now);
      inst.gainNode.gain.linearRampToValueAtTime(1, now + fadeDuration);  // fade in
      this._current = inst;
      this._currentKey = key;
    }
  }

  stop(fadeDuration = 0.5): void {
    if (this._current?.alive) this._current.stop(fadeDuration);
    this._current = null;
    this._currentKey = null;
  }
}
```

### 6.3 Crossfade 时序

```
Old BGM:  ████████████▓▓▓▓░░░░  (fade out over 0.5s)
New BGM:  ░░░░▓▓▓▓████████████  (fade in over 0.5s)
                   ↑
             crossfade overlap
```

`linearRampToValueAtTime` 由 Web Audio API 调度线程执行，不阻塞主线程。

---

## 7. 2D Spatial Audio

### 7.1 Stereo Panning Model

对于 2D 游戏，完整的 3D PannerNode 过于复杂。使用 `StereoPannerNode`：

```typescript
export function worldToPan(
  soundX: number, listenerX: number,
  halfScreenWidth: number, maxPan = 1.0,
): number {
  return clamp((soundX - listenerX) / halfScreenWidth * maxPan, -1, 1);
}
```

- `pan = -1` → 全左声道
- `pan = 0` → 居中
- `pan = +1` → 全右声道

### 7.2 Distance Attenuation

```typescript
export function distanceVolume(
  sx: number, sy: number, lx: number, ly: number,
  maxDist: number, rolloff = 1.0,
): number {
  const dx = sx - lx, dy = sy - ly;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= maxDist) return 0;
  return Math.pow(1 - dist / maxDist, rolloff);
}
```

### 7.3 Usage

```typescript
const vol = distanceVolume(enemy.x, enemy.y, camera.x, camera.y, 500);
const pan = worldToPan(enemy.x, camera.x, canvas.width / 2);
audio.play('explosion', { volume: vol, pan });
```

---

## 8. Complete Public API

### 8.1 Types

```typescript
export type AudioFormat = 'wav' | 'ogg' | 'mp3';

export interface PlayOptions {
  volume?:       number;    // 0..1, default 1
  pitch?:        number;    // playback rate, default 1 (0.5=half, 2=double)
  loop?:         boolean;   // default false
  pan?:          number;    // -1..1, default undefined (center, no panner)
  offset?:       number;    // start time in seconds
  bus?:          'sfx' | 'music';
  maxInstances?: number;    // override pool limit
}

export interface SoundAsset {
  key:   string;
  url?:  string;      // single URL
  urls?: string[];    // ordered fallback list
}
```

### 8.2 AudioManager API Summary

| Category | Method | Description |
|----------|--------|-------------|
| **Lifecycle** | `constructor()` | Create AudioContext + bus graph + detect formats |
| | `destroy()` | Stop all, close context |
| **Loading** | `load(key, url)` | Load single URL (wav/ogg/mp3) |
| | `loadAsset(asset)` | Load with automatic format fallback |
| | `loadBatch(assets)` | Parallel preload multiple assets |
| | `unload(key)` | Remove from cache |
| | `has(key)` | Check if loaded |
| **Format** | `formatSupport` | Readonly format support detection |
| | `supportsFormat(fmt)` | Check specific format support |
| | `resolveAssetUrl(asset)` | Resolve SoundAsset to concrete URL |
| | `pickSupportedUrl(urls)` | Pick first supported URL from list |
| **Playback** | `play(key, opts?)` | Play SFX, returns SoundInstance |
| | `createInstance(key, opts)` | Low-level instance creation |
| | `stopAll(fadeOut?)` | Stop everything |
| **Volume** | `masterVolume` | 0..1 getter/setter |
| | `sfxVolume` | 0..1 getter/setter |
| | `musicVolume` | 0..1 getter/setter |
| **Music** | `music.play(key, fade?)` | Play BGM with crossfade |
| | `music.stop(fade?)` | Stop BGM |
| | `music.volume` | Current BGM instance volume |
| **State** | `state` | AudioContext state |
| | `activeSounds` | Active SFX instance count |
| **Utilities** | `worldToPan()` | Convert world X to stereo pan |
| | `distanceVolume()` | Calculate distance attenuation |

---

## 9. Complete Implementation

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Audio System — Unified Module
// Contains: AudioManager, SoundBuffer, SoundInstance, SoundPool, MusicPlayer
//
// 支持格式: WAV (.wav), OGG Vorbis (.ogg), MP3 (.mp3)
// 格式策略:
//   SFX  → .wav (零解码延迟，文件小)
//   BGM  → .ogg (首选, Safari 17+) → .mp3 (fallback)
//
// 帧调用契约:
//   audio 无需每帧调用，事件驱动即可
//   仅在 destroy() 时清理资源
// ═══════════════════════════════════════════════════════════════════════════

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ── Format Detection ─────────────────────────────────────────────────────

export type AudioFormat = 'wav' | 'ogg' | 'mp3';

interface FormatSupport {
  wav: boolean;
  ogg: boolean;
  mp3: boolean;
}

/** Detect browser audio format support (cached, runs once) */
let _formatCache: FormatSupport | null = null;

function detectFormats(): FormatSupport {
  if (_formatCache) return _formatCache;

  const a = document.createElement('audio');
  _formatCache = {
    wav: a.canPlayType('audio/wav') !== '',
    ogg: a.canPlayType('audio/ogg; codecs="vorbis"') !== '',
    mp3: a.canPlayType('audio/mpeg') !== '',
  };
  return _formatCache;
}

/**
 * Given a list of candidate URLs, return the first URL whose format
 * is supported by the browser. Returns null if none are supported.
 */
export function pickSupportedUrl(urls: string[]): string | null {
  const support = detectFormats();
  for (const url of urls) {
    const ext = url.split('.').pop()?.toLowerCase();
    if (ext === 'wav' && support.wav) return url;
    if (ext === 'ogg' && support.ogg) return url;
    if (ext === 'mp3' && support.mp3) return url;
  }
  return null;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface PlayOptions {
  volume?:       number;    // 0..1, default 1
  pitch?:        number;    // playback rate, default 1
  loop?:         boolean;   // default false
  pan?:          number;    // -1..1, default undefined (center, no panner node)
  offset?:       number;    // start offset in seconds
  bus?:          'sfx' | 'music';
  maxInstances?: number;    // override pool limit for this key
}

/**
 * Asset entry for loadBatch().
 * - Single format:   { key: 'jump', url: '/sfx/jump.wav' }
 * - Multi-fallback:  { key: 'bgm',  urls: ['/music/bgm.ogg', '/music/bgm.mp3'] }
 */
export interface SoundAsset {
  key:   string;
  url?:  string;      // single URL (WAV/OGG/MP3)
  urls?: string[];    // ordered fallback list, first supported wins
}

// ── SoundBuffer ──────────────────────────────────────────────────────────

export class SoundBuffer {
  constructor(
    readonly key: string,
    readonly buffer: AudioBuffer,
    readonly duration: number,
  ) {}
}

// ── SoundInstance ────────────────────────────────────────────────────────

export class SoundInstance {
  readonly source: AudioBufferSourceNode;
  readonly gainNode: GainNode;
  readonly pannerNode: StereoPannerNode | null;
  private _alive = true;

  constructor(
    ctx: AudioContext,
    buffer: AudioBuffer,
    output: GainNode,
    opts: PlayOptions,
  ) {
    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = opts.loop ?? false;
    this.source.playbackRate.value = opts.pitch ?? 1;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = opts.volume ?? 1;

    if (opts.pan !== undefined) {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.value = clamp(opts.pan, -1, 1);
      this.source.connect(this.gainNode)
                 .connect(this.pannerNode)
                 .connect(output);
    } else {
      this.pannerNode = null;
      this.source.connect(this.gainNode).connect(output);
    }

    this.source.onended = () => { this._alive = false; };
    this.source.start(0, opts.offset ?? 0);
  }

  get alive(): boolean { return this._alive; }

  stop(fadeOut = 0): void {
    if (!this._alive) return;
    if (fadeOut > 0) {
      const now = this.source.context.currentTime;
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOut);
      this.source.stop(now + fadeOut);
    } else {
      try { this.source.stop(); } catch { /* already stopped */ }
    }
    this._alive = false;
  }

  set volume(v: number) { this.gainNode.gain.value = clamp(v, 0, 1); }
  get volume(): number  { return this.gainNode.gain.value; }
  set pan(v: number)    { if (this.pannerNode) this.pannerNode.pan.value = clamp(v, -1, 1); }
  set pitch(v: number)  { this.source.playbackRate.value = Math.max(0.01, v); }
}

// ── SoundPool ────────────────────────────────────────────────────────────

class SoundPool {
  private _instances: SoundInstance[] = [];

  constructor(readonly maxInstances: number = 8) {}

  add(inst: SoundInstance): void {
    this._instances = this._instances.filter(i => i.alive);
    if (this._instances.length >= this.maxInstances) {
      this._instances[0].stop(0.05);
      this._instances.shift();
    }
    this._instances.push(inst);
  }

  stopAll(fadeOut = 0): void {
    for (const i of this._instances) i.stop(fadeOut);
    this._instances.length = 0;
  }

  get activeCount(): number {
    this._instances = this._instances.filter(i => i.alive);
    return this._instances.length;
  }
}

// ── MusicPlayer ──────────────────────────────────────────────────────────

export class MusicPlayer {
  private _current: SoundInstance | null = null;
  private _currentKey: string | null = null;

  constructor(private readonly mgr: AudioManager) {}

  get currentKey(): string | null { return this._currentKey; }
  get isPlaying(): boolean { return this._current?.alive ?? false; }

  play(key: string, fadeDuration = 0.5): void {
    if (this._currentKey === key && this._current?.alive) return;
    if (this._current?.alive) this._current.stop(fadeDuration);

    const inst = this.mgr.createInstance(key, {
      loop: true, volume: 0, bus: 'music',
    });
    if (inst) {
      const now = this.mgr.ctx.currentTime;
      inst.gainNode.gain.setValueAtTime(0, now);
      inst.gainNode.gain.linearRampToValueAtTime(1, now + fadeDuration);
      this._current = inst;
      this._currentKey = key;
    }
  }

  stop(fadeDuration = 0.5): void {
    if (this._current?.alive) this._current.stop(fadeDuration);
    this._current = null;
    this._currentKey = null;
  }

  set volume(v: number) {
    if (this._current?.alive) this._current.volume = v;
  }
}

// ── AudioManager ─────────────────────────────────────────────────────────

const UNLOCK_EVENTS = ['click', 'touchstart', 'touchend', 'keydown'] as const;

export class AudioManager {
  readonly ctx: AudioContext;
  readonly masterGain: GainNode;
  readonly sfxGain: GainNode;
  readonly musicGain: GainNode;
  readonly music: MusicPlayer;

  /** Browser format support (detected once) */
  readonly formatSupport: Readonly<FormatSupport>;

  private _cache = new Map<string, SoundBuffer>();
  private _pools = new Map<string, SoundPool>();
  private _unlocked = false;

  constructor() {
    this.ctx = new AudioContext();

    // Bus graph: SFX + Music → Master → destination
    this.masterGain = this.ctx.createGain();
    this.sfxGain    = this.ctx.createGain();
    this.musicGain  = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Music player
    this.music = new MusicPlayer(this);

    // Format detection
    this.formatSupport = detectFormats();

    // Autoplay policy
    this._setupAutoResume();
  }

  // ── Format Helpers ──

  /** Check if a specific format is supported */
  supportsFormat(fmt: AudioFormat): boolean {
    return this.formatSupport[fmt];
  }

  /**
   * Resolve a SoundAsset to a concrete URL.
   * - If `url` is provided, returns it directly
   * - If `urls` is provided, returns the first browser-supported URL
   * - Returns null if no format is supported
   */
  resolveAssetUrl(asset: SoundAsset): string | null {
    if (asset.url) return asset.url;
    if (asset.urls) return pickSupportedUrl(asset.urls);
    return null;
  }

  // ── Asset Loading ──

  /**
   * Load a single sound by key + URL.
   * URL can be .wav, .ogg, or .mp3
   */
  async load(key: string, url: string): Promise<SoundBuffer> {
    const existing = this._cache.get(key);
    if (existing) return existing;

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`[AudioManager] Failed to load "${key}" from ${url} (${resp.status})`);

    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
    const sb = new SoundBuffer(key, audioBuf, audioBuf.duration);
    this._cache.set(key, sb);
    return sb;
  }

  /**
   * Load a SoundAsset with automatic format fallback.
   * Throws if no supported format is found.
   */
  async loadAsset(asset: SoundAsset): Promise<SoundBuffer> {
    const url = this.resolveAssetUrl(asset);
    if (!url) {
      throw new Error(
        `[AudioManager] No supported format for "${asset.key}". ` +
        `Candidates: ${(asset.urls ?? [asset.url]).join(', ')}. ` +
        `Browser supports: wav=${this.formatSupport.wav}, ogg=${this.formatSupport.ogg}, mp3=${this.formatSupport.mp3}`
      );
    }
    return this.load(asset.key, url);
  }

  /**
   * Batch-load multiple assets in parallel.
   * Each entry can use single `url` or multi-format `urls` fallback.
   */
  async loadBatch(assets: SoundAsset[]): Promise<void> {
    await Promise.all(assets.map(a => this.loadAsset(a)));
  }

  /** Remove a loaded sound from cache and stop its pool */
  unload(key: string): void {
    this._pools.get(key)?.stopAll();
    this._pools.delete(key);
    this._cache.delete(key);
  }

  /** Check if a sound key is loaded */
  has(key: string): boolean {
    return this._cache.has(key);
  }

  // ── Playback ──

  /**
   * Play a loaded sound effect.
   * Returns the SoundInstance for further control, or null if not loaded.
   */
  play(key: string, options?: PlayOptions): SoundInstance | null {
    return this.createInstance(key, { bus: 'sfx', ...options });
  }

  /** @internal Used by MusicPlayer and play() */
  createInstance(key: string, opts: PlayOptions): SoundInstance | null {
    const sb = this._cache.get(key);
    if (!sb) {
      console.warn(`[AudioManager] Sound "${key}" not loaded`);
      return null;
    }

    const bus = opts.bus === 'music' ? this.musicGain : this.sfxGain;
    const inst = new SoundInstance(this.ctx, sb.buffer, bus, opts);

    // Pool management (music handles its own lifecycle via MusicPlayer)
    if (opts.bus !== 'music') {
      let pool = this._pools.get(key);
      if (!pool) {
        pool = new SoundPool(opts.maxInstances ?? 8);
        this._pools.set(key, pool);
      }
      pool.add(inst);
    }

    return inst;
  }

  /** Stop all sounds (SFX + BGM) */
  stopAll(fadeOut = 0.1): void {
    for (const pool of this._pools.values()) pool.stopAll(fadeOut);
    this.music.stop(fadeOut);
  }

  // ── Volume ──

  get masterVolume(): number  { return this.masterGain.gain.value; }
  set masterVolume(v: number) { this.masterGain.gain.value = clamp(v, 0, 1); }

  get sfxVolume(): number  { return this.sfxGain.gain.value; }
  set sfxVolume(v: number) { this.sfxGain.gain.value = clamp(v, 0, 1); }

  get musicVolume(): number  { return this.musicGain.gain.value; }
  set musicVolume(v: number) { this.musicGain.gain.value = clamp(v, 0, 1); }

  // ── State ──

  get state(): AudioContextState { return this.ctx.state; }

  get activeSounds(): number {
    let count = 0;
    for (const pool of this._pools.values()) count += pool.activeCount;
    return count;
  }

  // ── Lifecycle ──

  destroy(): void {
    this.stopAll(0);
    this._cache.clear();
    this._pools.clear();
    this.ctx.close();
  }

  // ── Autoplay Policy ──

  private _setupAutoResume(): void {
    if (this.ctx.state === 'running') {
      this._unlocked = true;
      return;
    }

    const unlock = () => {
      if (this._unlocked) return;

      this.ctx.resume().then(() => {
        this._unlocked = true;

        // iOS Safari: play silent 1-sample buffer to fully unlock
        const buf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.ctx.destination);
        src.start(0);

        for (const evt of UNLOCK_EVENTS) {
          document.removeEventListener(evt, unlock, { capture: true });
        }
      });
    };

    for (const evt of UNLOCK_EVENTS) {
      document.addEventListener(evt, unlock, { capture: true });
    }
  }
}

// ── Spatial Helpers (optional utilities) ─────────────────────────────────

export function worldToPan(
  soundX: number, listenerX: number,
  halfScreenWidth: number, maxPan = 1.0,
): number {
  return clamp((soundX - listenerX) / halfScreenWidth * maxPan, -1, 1);
}

export function distanceVolume(
  sx: number, sy: number, lx: number, ly: number,
  maxDist: number, rolloff = 1.0,
): number {
  const dx = sx - lx, dy = sy - ly;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= maxDist) return 0;
  return Math.pow(1 - dist / maxDist, rolloff);
}
```

---

## 10. Engine Integration

### 10.1 Game 生命周期

```typescript
class Game {
  private audio!: AudioManager;
  private input!: InputManager;

  async init() {
    this.audio = new AudioManager();
    this.input = new InputManager(canvas);

    // 加载资源：SFX 用单格式，BGM 用多格式回退
    await this.audio.loadBatch([
      { key: 'step',  url: '/sfx/step.wav' },
      { key: 'sword', url: '/sfx/sword.wav' },
      { key: 'bgm_field', urls: ['/music/field.ogg', '/music/field.mp3'] },
    ]);
    this.audio.music.play('bgm_field');
  }

  update(dt: number) {
    this.input.update();
    if (this.input.action('Attack').pressed) {
      this.audio.play('sword', { pitch: 0.9 + Math.random() * 0.2 });
    }
    this.input.endFrame();
  }

  destroy() {
    this.input.destroy();
    this.audio.destroy();
  }
}
```

### 10.2 Scene Transition

```typescript
async loadDungeon() {
  this.audio.music.play('bgm_dungeon', 1.5);  // 1.5s crossfade
  this.audio.unload('bird_chirp');
  await this.audio.load('drip', '/sfx/drip.wav');
}
```

### 10.3 Format Fallback Strategy

```typescript
// 检查浏览器格式支持（调试用）
console.log(audio.formatSupport);  // { wav: true, ogg: true, mp3: true }

// 手动选择 URL（罕见场景）
const url = audio.resolveAssetUrl({
  key: 'bgm',
  urls: ['/music/bgm.ogg', '/music/bgm.mp3']
});  // 返回浏览器支持的第一个格式
```

### 10.4 Pitch Randomization (Juice)

```typescript
// 让重复音效不单调 — 随机 ±10% pitch
audio.play('coin', { pitch: 0.9 + Math.random() * 0.2 });
audio.play('footstep', {
  pitch: 0.95 + Math.random() * 0.1,
  volume: 0.4 + Math.random() * 0.1,
});
```

---

## 11. Comparison: Mote vs Reference Engines

| Feature | LittleJS | Howler.js | Phaser 3 | **Mote** |
|---------|----------|-----------|----------|----------|
| **Dependency** | None | None | Framework | None |
| **Backend** | Web Audio | Web Audio + HTML5 fallback | Web Audio + HTML5 | Web Audio only |
| **Bus routing** | Single volume | No bus | ✓ (tied to scenes) | ✓ Master/SFX/Music |
| **Instance pooling** | Manual | ✗ | ✓ | ✓ Per-key FIFO |
| **Crossfade BGM** | ✗ | Manual | ✗ | ✓ Built-in |
| **Spatial audio** | ✗ | 3D (Web Audio) | ✗ | 2D StereoPanner |
| **Autoplay handling** | Silent play | Suspend/resume | Unlock gesture | Resume + iOS unlock |
| **API simplicity** | ★★★★★ | ★★★★ | ★★★ | ★★★★★ |
| **Code size** | ~100 LOC | ~2500 LOC | ~3000 LOC | ~300 LOC |

---

## 12. Recommended Audio Formats

### 12.1 Format Support Matrix

| Format | Extension | Compression | Browser Support | Use Case |
|--------|-----------|-------------|-----------------|----------|
| **OGG Vorbis** | `.ogg` | Lossy, good | Chrome/Firefox/Edge ✓, Safari 17+ ✓ | BGM (primary) |
| **WAV** | `.wav` | None | Universal | SFX (small files) |
| **MP3** | `.mp3` | Lossy, universal | Universal | BGM fallback |
| **WebM Opus** | `.webm` | Lossy, best quality/size | Chrome/Firefox/Edge ✓, Safari 16.4+ ✓ | Future-proof |

### 12.2 Automatic Format Fallback

Mote 的音频系统内置运行时格式检测，支持声明式多格式回退：

```typescript
// 提供多个格式，自动选择浏览器支持的第一个
await audio.loadBatch([
  // SFX：单格式即可（WAV 全平台支持）
  { key: 'jump', url: '/sfx/jump.wav' },
  
  // BGM：OGG 优先，MP3 回退（覆盖 Safari <17）
  { key: 'bgm', urls: ['/music/bgm.ogg', '/music/bgm.mp3'] },
]);

// 运行时检测（调试用）
console.log(audio.formatSupport);  // { wav: true, ogg: true, mp3: true }

// 手动检测
if (audio.supportsFormat('ogg')) {
  // 加载 OGG 版本...
}
```

### 12.3 Recommendations

- **SFX** → `.wav` (tiny files, zero decode overhead, sample-accurate, universal support)
- **BGM** → `.ogg` (good compression) + `.mp3` fallback (covers Safari <17, ~5% users)
- 使用 `loadBatch()` 的 `urls` 数组自动处理回退，无需运行时 if 判断
- 无需为 SFX 提供多格式，WAV 在所有目标浏览器都支持
