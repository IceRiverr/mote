1. Architecture Overview
1.1 Design Goals
Goal
Description
Zero-dependency
Pure Web Audio API, no Howler.js/Tone.js
Autoplay-safe
Gracefully handle browser autoplay policies (Chrome, Safari, iOS)
Lightweight
Match Mote's philosophy — small API surface, big capability
Instance pooling
Prevent audio spam (e.g. 100 bullets = 100 overlapping sounds)
Bus routing
Master / Music / SFX gain nodes for independent volume control
2D spatial
Optional stereo panning based on world-space position
BGM crossfade
Smooth music transitions without pop/click artifacts
Asset-friendly
AudioBuffer cache with async preload + on-demand decode
1.2 Signal Flow
暂时无法在飞书文档外展示此内容
1.3 Core Classes
Class
Responsibility
AudioManager
Singleton, owns AudioContext + bus graph + cache
SoundBuffer
Wrapper around decoded AudioBuffer
SoundInstance
One playing voice (source + gain + panner)
SoundPool
Per-asset instance limit + FIFO recycling
MusicPlayer
Dedicated BGM track with crossfade

---
2. Autoplay Policy Handling
2.1 The Problem
All major browsers (Chrome 66+, Safari 11+, Firefox 66+, iOS全系) require a user gesture before AudioContext can produce sound. A freshly created context starts in "suspended" state.
2.2 Strategy: Lazy Resume
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
Key points:
- Create AudioContext immediately (constructor), but don't worry about suspended state
- Register listeners on click / touchstart / touchend / keydown
- Call ctx.resume() on first gesture — returns a Promise
- Remove listeners once resumed
- iOS Safari additionally requires the first AudioBufferSourceNode.start() inside a user gesture callback — solved by playing a silent 1-sample buffer

---
3. Asset Loading & Cache
3.1 Load Pipeline
fetch(url) → ArrayBuffer → ctx.decodeAudioData() → AudioBuffer → Map cache
3.2 SoundBuffer
export class SoundBuffer {
  constructor(
    readonly key: string,          // unique asset key
    readonly buffer: AudioBuffer,  // decoded PCM data
    readonly duration: number,     // seconds
  ) {}
}
3.3 Cache Design
private _cache = new Map<string, SoundBuffer>();

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

async loadBatch(entries: { key: string; url: string }[]): Promise<void> {
  await Promise.all(entries.map(e => this.load(e.key, e.url)));
}
Design decisions:
- decodeAudioData 是异步的，但解码后的 AudioBuffer 是纯内存 PCM，播放时零延迟
- Key-based cache 避免重复加载
- loadBatch 用于场景预加载（loading screen 期间并行 decode）
- 无需 HTML5 Audio fallback — Mote 目标浏览器全部支持 Web Audio API

---
4. Sound Instance & Pooling
4.1 SoundInstance
每次 play() 调用创建一个 SoundInstance，代表一个正在播放的声音：
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
4.2 SoundPool — 防止音效轰炸
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
Pooling strategy:
- 每个 key（音效资源）一个 SoundPool
- 默认上限 8 个同时实例（可配置）
- 超限时停掉最老的实例（FIFO eviction），带 50ms micro-fade 避免 click
- 每次 add 时顺便清理已结束的实例（lazy GC）

---
5. Bus Routing & Volume Control
5.1 三级 Gain Bus
this.masterGain = ctx.createGain();
this.sfxGain    = ctx.createGain();
this.musicGain  = ctx.createGain();

this.sfxGain.connect(this.masterGain);
this.musicGain.connect(this.masterGain);
this.masterGain.connect(ctx.destination);
5.2 Volume API
get/set masterVolume: number;  // 0..1
get/set sfxVolume: number;     // 0..1
get/set musicVolume: number;   // 0..1
Volume 独立控制：玩家设置 SFX=0.3 不影响 Music=0.8，Master 统一调节总输出。

---
6. Music Player with Crossfade
6.1 BGM vs SFX 差异
Feature
SFX
BGM
Concurrent instances
Multiple (pooled)
1-2 (crossfade)
Looping
Rare
Almost always
Volume channel
SFX bus
Music bus
Transitions
Instant
Crossfade
6.2 MusicPlayer
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
6.3 Crossfade 时序
Old BGM:  ████████████▓▓▓▓░░░░  (fade out over 0.5s)
New BGM:  ░░░░▓▓▓▓████████████  (fade in over 0.5s)
                   ↑
             crossfade overlap
linearRampToValueAtTime 由 Web Audio API 调度线程执行，不阻塞主线程。

---
7. Optional: 2D Spatial Audio
7.1 Stereo Panning Model
对于 2D 游戏，完整的 3D PannerNode 过于复杂。使用 StereoPannerNode：
export function worldToPan(
  soundX: number, listenerX: number,
  halfScreenWidth: number, maxPan = 1.0,
): number {
  return clamp((soundX - listenerX) / halfScreenWidth * maxPan, -1, 1);
}
- pan = -1 → 全左声道 | pan = 0 → 居中 | pan = +1 → 全右声道
7.2 Distance Attenuation
export function distanceVolume(
  sx: number, sy: number, lx: number, ly: number,
  maxDist: number, rolloff = 1.0,
): number {
  const dx = sx - lx, dy = sy - ly;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= maxDist) return 0;
  return Math.pow(1 - dist / maxDist, rolloff);
}
7.3 Usage
const vol = distanceVolume(enemy.x, enemy.y, camera.x, camera.y, 500);
const pan = worldToPan(enemy.x, camera.x, canvas.width / 2);
audio.play('explosion', { volume: vol, pan });

---
8. Complete Public API
8.1 PlayOptions
export interface PlayOptions {
  volume?:       number;    // 0..1, default 1
  pitch?:        number;    // playback rate, default 1 (0.5=half, 2=double)
  loop?:         boolean;   // default false
  pan?:          number;    // -1..1, default undefined (center)
  offset?:       number;    // start time in seconds
  bus?:          'sfx' | 'music';
  maxInstances?: number;    // override pool limit
}
8.2 AudioManager API Summary
Category
Method
Description
Lifecycle
constructor()
Create AudioContext + bus graph

destroy()
Stop all, close context
Loading
load(key, url)
Async decode + cache

loadBatch(entries)
Parallel preload

unload(key)
Remove from cache

has(key)
Check if loaded
Playback
play(key, opts?)
Play SFX, returns SoundInstance

stopAll(fadeOut?)
Stop everything
Volume
masterVolume
0..1 getter/setter

sfxVolume
0..1 getter/setter

musicVolume
0..1 getter/setter
Music
music.play(key, fade?)
Play BGM with crossfade

music.stop(fade?)
Stop BGM
State
state
AudioContext state

activeSounds
Active instance count

---
9. Complete Implementation Code
// ═══════════════════════════════════════════════════════════════════════════
// Audio System — Unified Module
// Contains: AudioManager, SoundBuffer, SoundInstance, SoundPool, MusicPlayer
//
// 设计原则：
//   1. 纯 Web Audio API，零依赖
//   2. Autoplay policy 安全（lazy resume + iOS unlock）
//   3. 三级 Gain Bus: Master → SFX / Music
//   4. Per-key 实例池，防止音效轰炸
//   5. BGM 专用播放器，支持 crossfade
// ═══════════════════════════════════════════════════════════════════════════

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ── Types ────────────────────────────────────────────────────────────────

export interface PlayOptions {
  volume?:       number;
  pitch?:        number;
  loop?:         boolean;
  pan?:          number;
  offset?:       number;
  bus?:          'sfx' | 'music';
  maxInstances?: number;
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

  private _cache = new Map<string, SoundBuffer>();
  private _pools = new Map<string, SoundPool>();
  private _unlocked = false;

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.sfxGain    = this.ctx.createGain();
    this.musicGain  = this.ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.music = new MusicPlayer(this);
    this._setupAutoResume();
  }

  // ── Asset Loading ──

  async load(key: string, url: string): Promise<SoundBuffer> {
    const existing = this._cache.get(key);
    if (existing) return existing;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Audio load failed: ${url} (${resp.status})`);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
    const sb = new SoundBuffer(key, audioBuf, audioBuf.duration);
    this._cache.set(key, sb);
    return sb;
  }

  async loadBatch(entries: { key: string; url: string }[]): Promise<void> {
    await Promise.all(entries.map(e => this.load(e.key, e.url)));
  }

  unload(key: string): void {
    this._pools.get(key)?.stopAll();
    this._pools.delete(key);
    this._cache.delete(key);
  }

  has(key: string): boolean { return this._cache.has(key); }

  // ── Playback ──

  play(key: string, options?: PlayOptions): SoundInstance | null {
    return this.createInstance(key, { bus: 'sfx', ...options });
  }

  createInstance(key: string, opts: PlayOptions): SoundInstance | null {
    const sb = this._cache.get(key);
    if (!sb) { console.warn(`[AudioManager] Sound "${key}" not loaded`); return null; }
    const bus = opts.bus === 'music' ? this.musicGain : this.sfxGain;
    const inst = new SoundInstance(this.ctx, sb.buffer, bus, opts);
    if (opts.bus !== 'music') {
      let pool = this._pools.get(key);
      if (!pool) { pool = new SoundPool(opts.maxInstances ?? 8); this._pools.set(key, pool); }
      pool.add(inst);
    }
    return inst;
  }

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
    if (this.ctx.state === 'running') { this._unlocked = true; return; }
    const unlock = () => {
      if (this._unlocked) return;
      this.ctx.resume().then(() => {
        this._unlocked = true;
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

---
10. Engine Integration
10.1 Game 生命周期
class Game {
  private audio!: AudioManager;
  private input!: InputManager;

  async init() {
    this.audio = new AudioManager();
    this.input = new InputManager(canvas);

    await this.audio.loadBatch([
      { key: 'step',       url: '/sfx/step.wav' },
      { key: 'sword',      url: '/sfx/sword.wav' },
      { key: 'bgm_field',  url: '/music/field.ogg' },
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
10.2 Scene Transition
async loadDungeon() {
  this.audio.music.play('bgm_dungeon', 1.5);  // 1.5s crossfade
  this.audio.unload('bird_chirp');
  await this.audio.load('drip', '/sfx/drip.wav');
}
10.3 Pitch Randomization (Juice)
// 让重复音效不单调 — 随机 ±10% pitch
audio.play('coin', { pitch: 0.9 + Math.random() * 0.2 });
audio.play('footstep', {
  pitch: 0.95 + Math.random() * 0.1,
  volume: 0.4 + Math.random() * 0.1,
});

---
11. Comparison: Mote vs Reference Engines
Feature
LittleJS
Howler.js
Phaser 3
Mote
Dependency
None
None
Framework
None
Backend
Web Audio
Web Audio + HTML5 fallback
Web Audio + HTML5
Web Audio only
Bus routing
Single volume
No bus
✓ (tied to scenes)
✓ Master/SFX/Music
Instance pooling
Manual
✗
✓
✓ Per-key FIFO
Crossfade BGM
✗
Manual
✗
✓ Built-in
Spatial audio
✗
3D (Web Audio)
✗
2D StereoPanner
Autoplay handling
Silent play
Suspend/resume
Unlock gesture
Resume + iOS unlock
API simplicity
★★★★★
★★★★
★★★
★★★★★
Code size
~100 LOC
~2500 LOC
~3000 LOC
~300 LOC

---
12. Recommended Audio Formats
Format
Extension
Compression
Browser Support
Use Case
OGG Vorbis
.ogg
Lossy, good
Chrome/Firefox/Edge ✓, Safari 17+ ✓
BGM (primary)
WAV
.wav
None
Universal
SFX (small files)
MP3
.mp3
Lossy, universal
Universal
BGM fallback
WebM Opus
.webm
Lossy, best quality/size
Chrome/Firefox/Edge ✓, Safari 16.4+ ✓
Future-proof
Recommendation:
- SFX → .wav (tiny files, zero decode overhead, sample-accurate)
- BGM → .ogg (good compression, Safari 17+ supports it, cover 95%+ users)
- If Safari less than 17 needed → provide .mp3 fallback and use canPlayType() check