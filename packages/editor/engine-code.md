<!--
================================================================================
CODE EXPORT - Markdown Format
================================================================================
Project: packages/editor
Generated: 2026-04-04T06:47:14.497Z
Total Files: 14
Source Directory: ../engine/src
================================================================================
-->

# 📦 Code Export - packages/editor

> 导出时间: `2026-04-04T06:47:14.497Z`
> 文件数量: `14` 个
> 源目录: `../engine/src`

---

## 📁 文件清单

```
../engine/src/
├── audio.ts
├── Camera2D.ts
├── GameLoop.ts
├── gfx/
│   ├── createGfxDevice.ts
│   ├── Font.ts
│   ├── IGfxDevice.ts
│   ├── SpriteBatch.ts
│   ├── TextRenderer.ts
│   ├── WebGL2Device.ts
│   └── WebGPUDevice.ts
├── index.ts
├── Input.ts
├── Math.ts
└── vite-env.d.ts
```

---

## 📋 文件详情

### 快速导航

- [audio.ts](#audio-ts)
- [Camera2D.ts](#camera2d-ts)
- [GameLoop.ts](#gameloop-ts)
- [gfx/createGfxDevice.ts](#gfx-creategfxdevice-ts)
- [gfx/Font.ts](#gfx-font-ts)
- [gfx/IGfxDevice.ts](#gfx-igfxdevice-ts)
- [gfx/SpriteBatch.ts](#gfx-spritebatch-ts)
- [gfx/TextRenderer.ts](#gfx-textrenderer-ts)
- [gfx/WebGL2Device.ts](#gfx-webgl2device-ts)
- [gfx/WebGPUDevice.ts](#gfx-webgpudevice-ts)
- [index.ts](#index-ts)
- [Input.ts](#input-ts)
- [Math.ts](#math-ts)
- [vite-env.d.ts](#vite-env-d-ts)

---

## 📄 audio.ts

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
 * Given a list of candidate URLs (e.g. ['/sfx/bgm.ogg', '/sfx/bgm.mp3']),
 * return the first URL whose format is supported by the browser.
 * Returns null if none are supported.
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
    // Lazy GC: remove dead instances
    this._instances = this._instances.filter(i => i.alive);

    // FIFO eviction if at capacity
    if (this._instances.length >= this.maxInstances) {
      this._instances[0].stop(0.05); // micro-fade to avoid click
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

  /**
   * Play BGM with crossfade. Same key = no-op.
   * @param key      Preloaded sound key
   * @param fadeDuration  Crossfade duration in seconds (default 0.5)
   */
  play(key: string, fadeDuration = 0.5): void {
    if (this._currentKey === key && this._current?.alive) return;

    // Fade out current BGM
    if (this._current?.alive) {
      this._current.stop(fadeDuration);
    }

    const inst = this.mgr.createInstance(key, {
      loop: true,
      volume: 0,
      bus: 'music',
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
    if (this._current?.alive) {
      this._current.stop(fadeDuration);
    }
    this._current = null;
    this._currentKey = null;
  }

  /** Set BGM instance volume independent of bus volume (0..1) */
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

/**
 * Convert world-space X position to stereo pan value (-1..1).
 * @param soundX       Sound source X position
 * @param listenerX    Camera / listener X position
 * @param halfScreenW  Half of the viewport width (in world units)
 * @param maxPan       Maximum pan value (default 1.0)
 */
export function worldToPan(
  soundX: number,
  listenerX: number,
  halfScreenW: number,
  maxPan = 1.0,
): number {
  return clamp((soundX - listenerX) / halfScreenW * maxPan, -1, 1);
}

/**
 * Calculate volume attenuation based on 2D distance.
 * @param sx, sy       Sound source position
 * @param lx, ly       Listener position
 * @param maxDist      Maximum audible distance (volume = 0 beyond this)
 * @param rolloff      Falloff curve exponent (1.0 = linear, 2.0 = quadratic)
 */
export function distanceVolume(
  sx: number, sy: number,
  lx: number, ly: number,
  maxDist: number,
  rolloff = 1.0,
): number {
  const dx = sx - lx, dy = sy - ly;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist >= maxDist) return 0;
  return Math.pow(1 - dist / maxDist, rolloff);
}

```

## 📄 Camera2D.ts

```typescript
import { Mat4, Vec2 } from './Math.js';

export class Camera2D {
  position: Vec2;
  zoom: number;
  rotation: number;
  readonly viewport: { width: number; height: number };

  private _shakeIntensity = 0;
  private _shakeDuration  = 0;
  private _shakeOffset    = Vec2.zero();

  constructor(viewportWidth: number, viewportHeight: number) {
    this.position = Vec2.zero();
    this.zoom     = 1;
    this.rotation = 0;
    this.viewport = { width: viewportWidth, height: viewportHeight };
  }

  getViewProjectionMatrix(): Mat4 {
    const hw = this.viewport.width  * 0.5 / this.zoom;
    const hh = this.viewport.height * 0.5 / this.zoom;
    const cx = this.position.x + this._shakeOffset.x;
    const cy = this.position.y + this._shakeOffset.y;

    // Ortho centered on camera position
    const proj = Mat4.ortho(cx - hw, cx + hw, cy + hh, cy - hh, -1, 1);

    if (this.rotation !== 0) {
      const rot = Mat4.rotationZ(-this.rotation);
      return Mat4.multiply(proj, rot);
    }
    return proj;
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const hw = this.viewport.width  * 0.5;
    const hh = this.viewport.height * 0.5;
    return new Vec2(
      this.position.x + (sx - hw) / this.zoom,
      this.position.y + (sy - hh) / this.zoom,
    );
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    const hw = this.viewport.width  * 0.5;
    const hh = this.viewport.height * 0.5;
    return new Vec2(
      (wx - this.position.x) * this.zoom + hw,
      (wy - this.position.y) * this.zoom + hh,
    );
  }

  follow(target: Vec2, lerpFactor = 1): void {
    this.position = this.position.lerp(target, lerpFactor);
  }

  shake(intensity: number, duration: number): void {
    this._shakeIntensity = intensity;
    this._shakeDuration  = duration;
  }

  update(dt: number): void {
    if (this._shakeDuration > 0) {
      this._shakeDuration -= dt;
      const t = this._shakeIntensity * (this._shakeDuration > 0 ? 1 : 0);
      this._shakeOffset = new Vec2(
        (Math.random() * 2 - 1) * t,
        (Math.random() * 2 - 1) * t,
      );
    } else {
      this._shakeOffset = Vec2.zero();
    }
  }
}

```

## 📄 GameLoop.ts

```typescript
// Semi-fixed timestep game loop
// - update() runs at a fixed step (default 60Hz)
// - render() receives alpha for interpolation

export class GameLoop {
  private readonly fixedTimestep: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  onUpdate: (dt: number) => void = () => {};
  onRender: (alpha: number) => void = () => {};

  constructor(fixedHz = 60) {
    this.fixedTimestep = 1000 / fixedHz;
  }

  start(): void {
    if (this.running) return;
    this.running  = true;
    this.lastTime = performance.now();
    this.rafId    = requestAnimationFrame(this._tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private _tick = (now: number): void => {
    if (!this.running) return;

    let dt = now - this.lastTime;
    this.lastTime = now;

    // Clamp to avoid spiral of death after tab switch
    if (dt > 200) dt = 200;

    this.accumulator += dt;

    while (this.accumulator >= this.fixedTimestep) {
      this.onUpdate(this.fixedTimestep / 1000); // seconds
      this.accumulator -= this.fixedTimestep;
    }

    const alpha = this.accumulator / this.fixedTimestep;
    this.onRender(alpha);

    this.rafId = requestAnimationFrame(this._tick);
  };
}

```

## 📄 gfx/createGfxDevice.ts

```typescript
import type { IGfxDevice } from './IGfxDevice.js';
import { WebGPUDevice } from './WebGPUDevice.js';
import { WebGL2Device } from './WebGL2Device.js';

export async function createGfxDevice(canvas: HTMLCanvasElement): Promise<IGfxDevice> {
  if (typeof navigator !== 'undefined' && navigator.gpu && isSecureContext) {
    try {
      return await WebGPUDevice.create(canvas);
    } catch {
      // fall through to WebGL 2
    }
  }
  return await WebGL2Device.create(canvas);
}

```

## 📄 gfx/Font.ts

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FontLayout — CPU text layout engine
//
// FontData — Unified font data structures + parsers
//
// Supports:
//   - BMFont text format (.fnt) — AngelCode BMFont standard
//   - BMFont JSON format (.json) — AngelCode BMFont JSON export
// 
// Converts a string + style into an array of positioned glyph quads.
// Supports: kerning, word wrap, multi-line, alignment, letter/line spacing.
// ═══════════════════════════════════════════════════════════════════════════

import type { Color } from '../Math.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface GlyphData {
  unicode: number;
  advance: number;        // pixels
  // Atlas UV bounds (normalized 0..1)
  u0: number; v0: number;
  u1: number; v1: number;
  // Quad offset from cursor (pixels)
  offsetX: number;        // xoffset
  offsetY: number;        // yoffset
  width: number;          // glyph pixel width
  height: number;         // glyph pixel height
  // Multi-atlas support: which atlas page this glyph belongs to
  page?: number;
}

export interface FontMetrics {
  fontSize: number;       // base font size in pixels
  lineHeight: number;     // pixels
  base: number;           // baseline from top, pixels
}

export interface FontData {
  type: 'bitmap';
  metrics: FontMetrics;
  atlasWidth: number;
  atlasHeight: number;
  glyphs: Map<number, GlyphData>;
  kerning: Map<number, Map<number, number>>; // first → second → amount (px)
}

// ── BMFont JSON Parser (.json) ───────────────────────────────────────────

export interface BMFontJson {
  info: {
    face: string;
    size: number;
  };
  common: {
    lineHeight: number;
    base: number;
    scaleW: number;
    scaleH: number;
  };
  pages: string[];
  chars: Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    page?: number;
    chnl?: number;
  }>;
  kernings?: Array<{
    first: number;
    second: number;
    amount: number;
  }>;
}

export interface TextStyle {
  font: FontData;
  fontSize: number;         // desired pixel size
  color?: Color;            // default white
  letterSpacing?: number;   // extra px between characters
  lineSpacing?: number;     // extra px between lines
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;        // auto word-wrap width in px (0 = no wrap)
  /** How to handle missing glyphs: 'skip' (default), 'tofu' (□ placeholder), or 'space' (advance only) */
  missingGlyph?: 'skip' | 'tofu' | 'space';
}

export interface GlyphQuad {
  unicode: number;          // character code for atlas lookup
  // Screen-space position (top-left corner)
  x: number;
  y: number;
  // Screen-space size
  w: number;
  h: number;
  // Atlas UV
  u0: number; v0: number;
  u1: number; v1: number;
}

export interface TextLayoutResult {
  quads: GlyphQuad[];
  width: number;            // bounding box width
  height: number;           // bounding box height
  missingChars: string[];   // characters not found in font
}





/**
 * Parse BMFont JSON format (exported from tools like snowb.org).
 */
export function parseBMFontJson(json: BMFontJson): FontData {
  const glyphs = new Map<number, GlyphData>();
  const kerning = new Map<number, Map<number, number>>();

  const fontSize = Math.abs(json.info?.size ?? 16);
  const lineHeight = json.common?.lineHeight ?? fontSize;
  const base = json.common?.base ?? fontSize;
  const scaleW = json.common?.scaleW ?? 1;
  const scaleH = json.common?.scaleH ?? 1;

  // Parse chars
  for (const char of json.chars ?? []) {
    const x = char.x ?? 0;
    const y = char.y ?? 0;
    const w = char.width ?? 0;
    const h = char.height ?? 0;

    glyphs.set(char.id, {
      unicode: char.id,
      advance: char.xadvance ?? 0,
      u0: x / scaleW,
      v0: y / scaleH,
      u1: (x + w) / scaleW,
      v1: (y + h) / scaleH,
      offsetX: char.xoffset ?? 0,
      offsetY: char.yoffset ?? 0,
      width: w,
      height: h,
      page: char.page ?? 0,
    });
  }

  // Parse kernings
  for (const kern of json.kernings ?? []) {
    const first = kern.first;
    const second = kern.second;
    const amount = kern.amount ?? 0;
    
    let map = kerning.get(first);
    if (!map) {
      map = new Map();
      kerning.set(first, map);
    }
    map.set(second, amount);
  }

  return {
    type: 'bitmap',
    metrics: { fontSize, lineHeight, base },
    atlasWidth: scaleW,
    atlasHeight: scaleH,
    glyphs,
    kerning,
  };
}

// ── BMFont Text Parser (.fnt) ────────────────────────────────────────────

/**
 * Parse AngelCode BMFont text format (.fnt).
 *
 * Expected format:
 *   info face="FontName" size=16 ...
 *   common lineHeight=18 base=14 scaleW=256 scaleH=256 pages=1
 *   page id=0 file="font.png"
 *   chars count=95
 *   char id=65 x=0 y=0 width=8 height=14 xoffset=0 yoffset=2 xadvance=9 page=0 chnl=15
 *   kerning first=65 second=86 amount=-1
 */
export function parseBMFont(fntText: string): FontData {
  const glyphs = new Map<number, GlyphData>();
  const kerning = new Map<number, Map<number, number>>();

  let fontSize = 16;
  let lineHeight = 0;
  let base = 0;
  let scaleW = 1;
  let scaleH = 1;

  const lines = fntText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tag = trimmed.split(/\s+/)[0];

    switch (tag) {
      case 'info': {
        const sizeMatch = trimmed.match(/size=(-?\d+)/);
        if (sizeMatch) fontSize = Math.abs(parseInt(sizeMatch[1], 10));
        break;
      }

      case 'common': {
        const vals = parseKeyValues(trimmed);
        lineHeight = vals['lineHeight'] ?? 0;
        base = vals['base'] ?? 0;
        scaleW = vals['scaleW'] ?? 1;
        scaleH = vals['scaleH'] ?? 1;
        break;
      }

      case 'char': {
        const v = parseKeyValues(trimmed);
        const id = v['id'];
        if (id === undefined) break;

        const x = v['x'] ?? 0;
        const y = v['y'] ?? 0;
        const w = v['width'] ?? 0;
        const h = v['height'] ?? 0;

        glyphs.set(id, {
          unicode: id,
          advance: v['xadvance'] ?? 0,
          u0: x / scaleW,
          v0: y / scaleH,
          u1: (x + w) / scaleW,
          v1: (y + h) / scaleH,
          offsetX: v['xoffset'] ?? 0,
          offsetY: v['yoffset'] ?? 0,
          width: w,
          height: h,
        });
        break;
      }

      case 'kerning': {
        const v = parseKeyValues(trimmed);
        const first = v['first'];
        const second = v['second'];
        const amount = v['amount'] ?? 0;
        if (first === undefined || second === undefined) break;

        let map = kerning.get(first);
        if (!map) { map = new Map(); kerning.set(first, map); }
        map.set(second, amount);
        break;
      }
    }
  }

  return {
    type: 'bitmap' as const,
    metrics: { fontSize, lineHeight, base },
    atlasWidth: scaleW,
    atlasHeight: scaleH,
    glyphs,
    kerning,
  };
}

// ── Font Merging ─────────────────────────────────────────────────────────

/**
 * Merge multiple FontData objects into a single font.
 * Useful for loading large fonts split into multiple atlases (e.g., 3000 + 500 chars).
 *
 * Note: All fonts must have the same metrics (fontSize, lineHeight, base).
 *       The first font's metrics will be used.
 *
 * @param fonts  Array of FontData to merge
 * @returns      Combined FontData
 */
export function mergeFontData(fonts: FontData[]): FontData {
  if (fonts.length === 0) {
    throw new Error('[mergeFontData] No fonts to merge');
  }
  if (fonts.length === 1) {
    return fonts[0];
  }

  const base = fonts[0];
  const glyphs = new Map(base.glyphs);
  const kerning = new Map<number, Map<number, number>>();

  // Copy base font's kerning
  for (const [first, map] of base.kerning) {
    kerning.set(first, new Map(map));
  }

  // Merge subsequent fonts
  for (let i = 1; i < fonts.length; i++) {
    const font = fonts[i];

    // Validate metrics match
    if (font.metrics.fontSize !== base.metrics.fontSize ||
        font.metrics.lineHeight !== base.metrics.lineHeight ||
        font.metrics.base !== base.metrics.base) {
      console.warn(`[mergeFontData] Font ${i} has different metrics, may cause rendering issues`);
    }

    // Merge glyphs
    for (const [code, glyph] of font.glyphs) {
      glyphs.set(code, glyph);
    }

    // Merge kerning
    for (const [first, map] of font.kerning) {
      let targetMap = kerning.get(first);
      if (!targetMap) {
        targetMap = new Map();
        kerning.set(first, targetMap);
      }
      for (const [second, amount] of map) {
        targetMap.set(second, amount);
      }
    }
  }

  return {
    type: base.type,
    metrics: base.metrics,
    atlasWidth: base.atlasWidth,
    atlasHeight: base.atlasHeight,
    glyphs,
    kerning,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseKeyValues(line: string): Record<string, number> {
  const result: Record<string, number> = {};
  // Match key=value pairs (value can be negative)
  const regex = /(\w+)=(-?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    result[m[1]] = parseInt(m[2], 10);
  }
  return result;
}

// ── Layout ───────────────────────────────────────────────────────────────

/**
 * Layout text into positioned glyph quads.
 *
 * @param text    The string to layout (supports \n for newlines)
 * @param x       Origin X in screen/world pixels
 * @param y       Origin Y in screen/world pixels (top of first line)
 * @param style   Text styling options
 * @returns       Array of glyph quads + bounding box
 */
export function layoutText(
  text: string,
  x: number,
  y: number,
  style: TextStyle,
): TextLayoutResult {
  const font = style.font;
  const scale = style.fontSize / font.metrics.fontSize;
  const lineHeight = font.metrics.lineHeight * scale + (style.lineSpacing ?? 0);
  const letterSpacing = style.letterSpacing ?? 0;
  const maxWidth = style.maxWidth ?? 0;
  const missingMode = style.missingGlyph ?? 'skip';

  const quads: GlyphQuad[] = [];
  const missingChars: string[] = [];

  // Get tofu glyph for missing characters (□ or fallback space)
  const tofuGlyph = font.glyphs.get(0x25A1) // White Square □
    ?? font.glyphs.get(0x2610) // Ballot Box ☐
    ?? font.glyphs.get(32);    // Space fallback

  // Track lines for alignment
  const lineStarts: number[] = [0]; // quad index where each line starts
  const lineWidths: number[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let prevUnicode = -1;
  let lineMaxX = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const char = text[i];

    // Handle newline
    if (code === 0x0A) {
      lineWidths.push(cursorX);
      lineMaxX = Math.max(lineMaxX, cursorX);
      cursorX = 0;
      cursorY += lineHeight;
      prevUnicode = -1;
      lineStarts.push(quads.length);
      continue;
    }

    // Handle carriage return (ignore)
    if (code === 0x0D) continue;

    let glyph = font.glyphs.get(code);
    let isMissing = false;

    if (!glyph) {
      missingChars.push(char);
      isMissing = true;

      if (missingMode === 'skip') {
        prevUnicode = -1;
        continue;
      } else if (missingMode === 'tofu' && tofuGlyph) {
        glyph = tofuGlyph;
      } else {
        // 'space' mode or no tofu available: just advance
        const spaceAdvance = font.glyphs.get(32)?.advance ?? style.fontSize * 0.5;
        cursorX += spaceAdvance * scale;
        prevUnicode = -1;
        continue;
      }
    }

    // Kerning (skip for tofu placeholders to avoid weird spacing)
    if (!isMissing && prevUnicode >= 0) {
      const kern = font.kerning.get(prevUnicode)?.get(code) ?? 0;
      cursorX += kern * scale;
    }

    // Word wrap: if adding this glyph exceeds maxWidth, break line
    if (maxWidth > 0 && cursorX + glyph.advance * scale > maxWidth && cursorX > 0) {
      lineWidths.push(cursorX);
      lineMaxX = Math.max(lineMaxX, cursorX);
      cursorX = 0;
      cursorY += lineHeight;
      prevUnicode = -1;
      lineStarts.push(quads.length);
    }

    // Only emit a quad if the glyph has visible pixels
    if (glyph.width > 0 && glyph.height > 0) {
      let qw = glyph.width * scale;
      let qh = glyph.height * scale;
      let qx = cursorX + glyph.offsetX * scale;
      // BMFont yoffset: offset from baseline to glyph top
      // For pixel-perfect rendering, round coordinates when scale is close to 1
      let qy = cursorY + glyph.offsetY * scale;

      // Round to nearest pixel for pixel-perfect rendering
      // This ensures 1:1 texture-to-screen pixel mapping when fontSize matches exported size
      qw = Math.round(qw);
      qh = Math.round(qh);
      qx = Math.round(qx);
      qy = Math.round(qy);

      quads.push({
        unicode: glyph.unicode,
        x: qx, y: qy,
        w: qw, h: qh,
        u0: glyph.u0, v0: glyph.v0,
        u1: glyph.u1, v1: glyph.v1,
      });
    }

    cursorX += glyph.advance * scale + letterSpacing;
    prevUnicode = code;
  }

  // Finalize last line
  lineWidths.push(cursorX);
  lineMaxX = Math.max(lineMaxX, cursorX);
  const totalHeight = cursorY + lineHeight;

  // Apply alignment
  const align = style.align ?? 'left';
  if (align !== 'left') {
    // Use maxWidth if set, otherwise use the widest line for alignment
    const alignWidth = maxWidth > 0 ? maxWidth : lineMaxX;
    for (let lineIdx = 0; lineIdx < lineStarts.length; lineIdx++) {
      const start = lineStarts[lineIdx];
      const end = lineIdx + 1 < lineStarts.length ? lineStarts[lineIdx + 1] : quads.length;
      const lw = lineWidths[lineIdx];
      let shift = 0;
      if (align === 'center') shift = Math.round((alignWidth - lw) * 0.5);
      else if (align === 'right') shift = Math.round(alignWidth - lw);
      for (let qi = start; qi < end; qi++) {
        quads[qi].x += shift;
      }
    }
  }

  // Offset all quads to world position
  // Round final position for pixel-perfect rendering
  const roundX = Math.round(x);
  const roundY = Math.round(y);
  for (const q of quads) {
    q.x += roundX;
    q.y += roundY;
  }

  return {
    quads,
    width: maxWidth > 0 ? maxWidth : lineMaxX,
    height: totalHeight,
    missingChars,
  };
}

// ── Missing Character Detection ──────────────────────────────────────────

/**
 * Check which characters in the text are not available in the font.
 * Useful for pre-flight checking or logging missing glyphs.
 *
 * @param text  The text to check
 * @param font  The font data
 * @returns     Array of unique missing characters
 */
export function findMissingChars(text: string, font: FontData): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip control characters and whitespace
    if (code < 32 || code === 0x0A || code === 0x0D) continue;
    if (!font.glyphs.has(code)) {
      missing.add(char);
    }
  }
  return Array.from(missing);
}

/**
 * Check if a font can render all characters in the given text.
 */
export function canRender(text: string, font: FontData): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 0x0A || code === 0x0D) continue;
    if (!font.glyphs.has(code)) return false;
  }
  return true;
}

// ── Measure ──────────────────────────────────────────────────────────────

/**
 * Measure the bounding box of text without generating quads.
 */
export function measureText(
  text: string,
  style: TextStyle,
): { width: number; height: number } {
  const font = style.font;
  const scale = style.fontSize / font.metrics.fontSize;
  const lineHeight = font.metrics.lineHeight * scale + (style.lineSpacing ?? 0);
  const letterSpacing = style.letterSpacing ?? 0;
  const maxWidth = style.maxWidth ?? 0;

  let cursorX = 0;
  let maxLineWidth = 0;
  let lines = 1;
  let prevUnicode = -1;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (code === 0x0A) {
      maxLineWidth = Math.max(maxLineWidth, cursorX);
      cursorX = 0;
      lines++;
      prevUnicode = -1;
      continue;
    }
    if (code === 0x0D) continue;

    const glyph = font.glyphs.get(code);
    if (!glyph) { prevUnicode = -1; continue; }

    if (prevUnicode >= 0) {
      cursorX += (font.kerning.get(prevUnicode)?.get(code) ?? 0) * scale;
    }

    // Word wrap check
    if (maxWidth > 0 && cursorX + glyph.advance * scale > maxWidth && cursorX > 0) {
      maxLineWidth = Math.max(maxLineWidth, cursorX);
      cursorX = 0;
      lines++;
      prevUnicode = -1;
    }

    cursorX += glyph.advance * scale + letterSpacing;
    prevUnicode = code;
  }

  maxLineWidth = Math.max(maxLineWidth, cursorX);
  return {
    width: maxWidth > 0 ? Math.min(maxLineWidth, maxWidth) : maxLineWidth,
    height: lines * lineHeight,
  };
}

```

## 📄 gfx/IGfxDevice.ts

```typescript
// ── Buffer usage flags (backend-agnostic, mirrors GPUBufferUsage values) ──────

export const BufferUsage = {
  VERTEX:   0x0020,
  INDEX:    0x0010,
  UNIFORM:  0x0040,
  COPY_DST: 0x0008,
} as const;

// ── Descriptors ───────────────────────────────────────────────────────────────

export interface BufferDesc {
  label?: string;
  size: number;
  usage: number;
  mappedAtCreation?: boolean;
}

export interface TextureDesc {
  label?: string;
  width: number;
  height: number;
}

export interface VertexAttribute {
  shaderLocation: number;
  offset: number;
  format: 'float32x2' | 'float32x4';
}

export interface BindGroupLayoutEntry {
  binding: number;
  type: 'uniform' | 'texture' | 'sampler';
  name?: string;
}

export interface PipelineDesc {
  label?: string;
  wgsl?: string;
  vertGlsl?: string;
  fragGlsl?: string;
  vertexStride: number;
  vertexAttributes: VertexAttribute[];
  blendMode?: 'alpha' | 'additive' | 'none';
  bindGroupLayouts: BindGroupLayoutEntry[][];
}

export interface BindGroupEntry {
  binding: number;
  buffer?: IGfxBuffer;
  texture?: IGfxTexture;
  sampler?: boolean;
}

export interface BindGroupDesc {
  layout: IGfxBindGroupLayout;
  entries: BindGroupEntry[];
}

// ── Opaque handles ────────────────────────────────────────────────────────────

export interface IGfxBuffer {
  readonly size: number;
  destroy(): void;
}

export interface IGfxTexture {
  readonly width: number;
  readonly height: number;
  destroy(): void;
}

export interface IGfxPipeline {
  destroy(): void;
}

export interface IGfxBindGroup {}

export interface IGfxBindGroupLayout {}

// ── Render pass ───────────────────────────────────────────────────────────────

export interface IRenderPass {
  setPipeline(pipeline: IGfxPipeline): void;
  setVertexBuffer(slot: number, buf: IGfxBuffer): void;
  setIndexBuffer(buf: IGfxBuffer, format: 'uint16' | 'uint32'): void;
  setBindGroup(index: number, group: IGfxBindGroup): void;
  drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number): void;
  end(): void;
}

export interface IFrameEncoder {
  beginRenderPass(clearColor: [number, number, number, number]): IRenderPass;
  submit(): void;
}

// ── Device ────────────────────────────────────────────────────────────────────

export interface IGfxDevice {
  createBuffer(desc: BufferDesc): IGfxBuffer;
  createTexture(desc: TextureDesc): IGfxTexture;
  createPipeline(desc: PipelineDesc): IGfxPipeline;
  getBindGroupLayout(pipeline: IGfxPipeline, groupIndex: number): IGfxBindGroupLayout;
  createBindGroup(desc: BindGroupDesc): IGfxBindGroup;

  writeBuffer(buf: IGfxBuffer, data: ArrayBufferView | ArrayBuffer, byteOffset?: number): void;
  loadTexture(url: string): Promise<IGfxTexture>;

  beginFrame(): IFrameEncoder;
  destroy(): void;
}

```

## 📄 gfx/SpriteBatch.ts

```typescript
import type { IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout } from './IGfxDevice.js';
import { BufferUsage } from './IGfxDevice.js';
import type { Camera2D } from '../Camera2D.js';
import type { Color } from '../Math.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AtlasRegion {
  u0: number; v0: number;
  u1: number; v1: number;
  pixelWidth: number;
  pixelHeight: number;
}
import SPRITE_WGSL from './shaders/SpriteBatch.wgsl?raw';
import SPRITE_VERT_GLSL from './shaders/sprite_batch.vert.glsl?raw';
import SPRITE_FRAG_GLSL from './shaders/sprite_batch.frag.glsl?raw';

// ── TextureAtlas ──────────────────────────────────────────────────────────────

export class TextureAtlas {
  readonly texture: IGfxTexture;
  readonly bindGroup: IGfxBindGroup;
  private regions: Map<string, AtlasRegion> = new Map();

  constructor(texture: IGfxTexture, bindGroup: IGfxBindGroup) {
    this.texture = texture;
    this.bindGroup = bindGroup;
  }

  static async load(
    gfx: IGfxDevice,
    layout: IGfxBindGroupLayout,
    imageUrl: string,
    jsonUrl?: string,
  ): Promise<TextureAtlas> {
    const texture = await gfx.loadTexture(imageUrl);
    const bindGroup = gfx.createBindGroup({
      layout,
      entries: [
        { binding: 0, sampler: true },
        { binding: 1, texture },
      ],
    });
    const atlas = new TextureAtlas(texture, bindGroup);

    if (jsonUrl) {
      const data = await fetch(jsonUrl).then(r => r.json()) as Record<string, { x: number; y: number; w: number; h: number }>;
      const tw = texture.width, th = texture.height;
      for (const [name, frame] of Object.entries(data)) {
        atlas.regions.set(name, {
          u0: frame.x / tw,            v0: frame.y / th,
          u1: (frame.x + frame.w) / tw, v1: (frame.y + frame.h) / th,
          pixelWidth: frame.w,          pixelHeight: frame.h,
        });
      }
    } else {
      atlas.regions.set('__full__', { u0: 0, v0: 0, u1: 1, v1: 1, pixelWidth: texture.width, pixelHeight: texture.height });
    }

    return atlas;
  }

  getRegion(name: string): AtlasRegion {
    const r = this.regions.get(name);
    if (!r) throw new Error(`Atlas region not found: ${name}`);
    return r;
  }

  get fullRegion(): AtlasRegion { return this.regions.get('__full__')!; }
}

// ── BatchEntry ────────────────────────────────────────────────────────────────

interface BatchEntry {
  atlas: TextureAtlas;
  startQuad: number;
  quadCount: number;
}

// ── SpriteBatch ───────────────────────────────────────────────────────────────

const DEFAULT_COLOR: Color = { r: 1, g: 1, b: 1, a: 1 } as Color;

export class SpriteBatch {
  private static readonly MAX_QUADS = 10_000;
  private static readonly FLOATS_PER_VERTEX = 8;   // pos(2) + uv(2) + color(4)
  private static readonly VERTICES_PER_QUAD = 4;
  private static readonly INDICES_PER_QUAD  = 6;
  private static readonly VERTEX_STRIDE     = 32;  // 8 floats × 4 bytes

  private readonly gfx: IGfxDevice;
  private readonly pipeline: IGfxPipeline;
  private readonly atlasLayout: IGfxBindGroupLayout;
  private readonly vertexBuffer: IGfxBuffer;
  private readonly indexBuffer: IGfxBuffer;
  private readonly cameraUniformBuffer: IGfxBuffer;
  private readonly cameraBindGroup: IGfxBindGroup;

  private readonly cpuBuffer: Float32Array;
  private quadCount = 0;
  private currentAtlas: TextureAtlas | null = null;
  private batches: BatchEntry[] = [];

  private frameEncoder: import('./IGfxDevice.js').IFrameEncoder | null = null;
  private renderPass: import('./IGfxDevice.js').IRenderPass | null = null;

  constructor(gfx: IGfxDevice) {
    this.gfx = gfx;
    const MAX = SpriteBatch.MAX_QUADS;

    this.cpuBuffer = new Float32Array(MAX * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.FLOATS_PER_VERTEX);

    this.vertexBuffer = gfx.createBuffer({
      label: 'SpriteBatch:vertex',
      size: MAX * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    this.indexBuffer = gfx.createBuffer({
      label: 'SpriteBatch:index',
      size: MAX * SpriteBatch.INDICES_PER_QUAD * 2,
      usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
    });
    gfx.writeBuffer(this.indexBuffer, generateIndices(MAX));

    this.cameraUniformBuffer = gfx.createBuffer({
      label: 'SpriteBatch:cameraUniform',
      size: 64,
      usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
    });

    this.pipeline = gfx.createPipeline({
      label: 'SpritePipeline',
      wgsl: SPRITE_WGSL,
      vertGlsl: SPRITE_VERT_GLSL,
      fragGlsl: SPRITE_FRAG_GLSL,
      vertexStride: SpriteBatch.VERTEX_STRIDE,
      vertexAttributes: [
        { shaderLocation: 0, offset: 0,  format: 'float32x2' },
        { shaderLocation: 1, offset: 8,  format: 'float32x2' },
        { shaderLocation: 2, offset: 16, format: 'float32x4' },
      ],
      blendMode: 'alpha',
      bindGroupLayouts: [
        [{ binding: 0, type: 'uniform', name: 'u_viewProjection' }],
        [{ binding: 0, type: 'sampler' }, { binding: 1, type: 'texture', name: 'u_texture' }],
      ],
    });

    const cameraLayout = gfx.getBindGroupLayout(this.pipeline, 0);
    this.cameraBindGroup = gfx.createBindGroup({
      layout: cameraLayout,
      entries: [{ binding: 0, buffer: this.cameraUniformBuffer }],
    });

    this.atlasLayout = gfx.getBindGroupLayout(this.pipeline, 1);
  }

  /** Get the bind group layout for atlas texture bind groups */
  getAtlasBindGroupLayout(): IGfxBindGroupLayout {
    return this.atlasLayout;
  }

  begin(camera: Camera2D): void {
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
    this.gfx.writeBuffer(this.cameraUniformBuffer, camera.getViewProjectionMatrix().data);

    this.frameEncoder = this.gfx.beginFrame();
    this.renderPass = this.frameEncoder.beginRenderPass([0.04, 0.04, 0.08, 1.0]);
    this.renderPass.setPipeline(this.pipeline);
    this.renderPass.setVertexBuffer(0, this.vertexBuffer);
    this.renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
    this.renderPass.setBindGroup(0, this.cameraBindGroup);
  }

  drawQuad(
    x: number, y: number,
    w: number, h: number,
    rotation: number,
    region: AtlasRegion,
    atlas: TextureAtlas,
    color: Color = DEFAULT_COLOR,
  ): void {
    if (this.quadCount >= SpriteBatch.MAX_QUADS) this._flush();
    if (atlas !== this.currentAtlas) this._breakBatch(atlas);

    const base = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.FLOATS_PER_VERTEX;

    if (rotation === 0) {
      const hw = w * 0.5, hh = h * 0.5;
      const x0 = x - hw, x1 = x + hw;
      const y0 = y - hh, y1 = y + hh;

      // vertex 0: bottom-left
      this.cpuBuffer[base]      = x0; this.cpuBuffer[base + 1]  = y0;
      this.cpuBuffer[base + 2]  = region.u0; this.cpuBuffer[base + 3]  = region.v1;
      this.cpuBuffer[base + 4]  = color.r; this.cpuBuffer[base + 5]  = color.g;
      this.cpuBuffer[base + 6]  = color.b; this.cpuBuffer[base + 7]  = color.a;
      // vertex 1: bottom-right
      this.cpuBuffer[base + 8]  = x1; this.cpuBuffer[base + 9]  = y0;
      this.cpuBuffer[base + 10] = region.u1; this.cpuBuffer[base + 11] = region.v1;
      this.cpuBuffer[base + 12] = color.r; this.cpuBuffer[base + 13] = color.g;
      this.cpuBuffer[base + 14] = color.b; this.cpuBuffer[base + 15] = color.a;
      // vertex 2: top-right
      this.cpuBuffer[base + 16] = x1; this.cpuBuffer[base + 17] = y1;
      this.cpuBuffer[base + 18] = region.u1; this.cpuBuffer[base + 19] = region.v0;
      this.cpuBuffer[base + 20] = color.r; this.cpuBuffer[base + 21] = color.g;
      this.cpuBuffer[base + 22] = color.b; this.cpuBuffer[base + 23] = color.a;
      // vertex 3: top-left
      this.cpuBuffer[base + 24] = x0; this.cpuBuffer[base + 25] = y1;
      this.cpuBuffer[base + 26] = region.u0; this.cpuBuffer[base + 27] = region.v0;
      this.cpuBuffer[base + 28] = color.r; this.cpuBuffer[base + 29] = color.g;
      this.cpuBuffer[base + 30] = color.b; this.cpuBuffer[base + 31] = color.a;
    } else {
      const hw = w * 0.5, hh = h * 0.5;
      const cos = Math.cos(rotation), sin = Math.sin(rotation);

      const lx0 = -hw, lx1 = hw;
      const ly0 = -hh, ly1 = hh;

      // Unrolled 4 vertices with rotation transform
      // vertex 0: bottom-left
      this.cpuBuffer[base]      = x + lx0 * cos - ly0 * sin;
      this.cpuBuffer[base + 1]  = y + lx0 * sin + ly0 * cos;
      this.cpuBuffer[base + 2]  = region.u0; this.cpuBuffer[base + 3]  = region.v1;
      this.cpuBuffer[base + 4]  = color.r; this.cpuBuffer[base + 5]  = color.g;
      this.cpuBuffer[base + 6]  = color.b; this.cpuBuffer[base + 7]  = color.a;
      // vertex 1: bottom-right
      this.cpuBuffer[base + 8]  = x + lx1 * cos - ly0 * sin;
      this.cpuBuffer[base + 9]  = y + lx1 * sin + ly0 * cos;
      this.cpuBuffer[base + 10] = region.u1; this.cpuBuffer[base + 11] = region.v1;
      this.cpuBuffer[base + 12] = color.r; this.cpuBuffer[base + 13] = color.g;
      this.cpuBuffer[base + 14] = color.b; this.cpuBuffer[base + 15] = color.a;
      // vertex 2: top-right
      this.cpuBuffer[base + 16] = x + lx1 * cos - ly1 * sin;
      this.cpuBuffer[base + 17] = y + lx1 * sin + ly1 * cos;
      this.cpuBuffer[base + 18] = region.u1; this.cpuBuffer[base + 19] = region.v0;
      this.cpuBuffer[base + 20] = color.r; this.cpuBuffer[base + 21] = color.g;
      this.cpuBuffer[base + 22] = color.b; this.cpuBuffer[base + 23] = color.a;
      // vertex 3: top-left
      this.cpuBuffer[base + 24] = x + lx0 * cos - ly1 * sin;
      this.cpuBuffer[base + 25] = y + lx0 * sin + ly1 * cos;
      this.cpuBuffer[base + 26] = region.u0; this.cpuBuffer[base + 27] = region.v0;
      this.cpuBuffer[base + 28] = color.r; this.cpuBuffer[base + 29] = color.g;
      this.cpuBuffer[base + 30] = color.b; this.cpuBuffer[base + 31] = color.a;
    }

    this.quadCount++;
    this.batches[this.batches.length - 1].quadCount++;
  }

  end(): void {
    if (this.quadCount === 0) {
      // 即使没画任何东西也要正确关闭 render pass
      if (this.renderPass) { this.renderPass.end(); this.renderPass = null; }
      if (this.frameEncoder) { this.frameEncoder.submit(); this.frameEncoder = null; }
      return;
    }

    const byteSize = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE;
    this.gfx.writeBuffer(this.vertexBuffer, this.cpuBuffer.subarray(0, byteSize / 4));

    const pass = this.renderPass!;

    for (const batch of this.batches) {
      pass.setBindGroup(1, batch.atlas.bindGroup);
      pass.drawIndexed(
        batch.quadCount * SpriteBatch.INDICES_PER_QUAD,
        1,
        batch.startQuad * SpriteBatch.INDICES_PER_QUAD,
      );
    }

    pass.end();
    this.frameEncoder!.submit();
    this.renderPass = null;
    this.frameEncoder = null;
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
  }

  private _breakBatch(atlas: TextureAtlas): void {
    this.batches.push({ atlas, startQuad: this.quadCount, quadCount: 0 });
    this.currentAtlas = atlas;
  }

  private _flush(): void {
    if (this.quadCount === 0) return;
    const byteSize = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE;
    this.gfx.writeBuffer(this.vertexBuffer, this.cpuBuffer.subarray(0, byteSize / 4));

    const pass = this.renderPass!;
    for (const batch of this.batches) {
      pass.setBindGroup(1, batch.atlas.bindGroup);
      pass.drawIndexed(
        batch.quadCount * SpriteBatch.INDICES_PER_QUAD,
        1,
        batch.startQuad * SpriteBatch.INDICES_PER_QUAD,
      );
    }

    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
  }

  destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.cameraUniformBuffer.destroy();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateIndices(maxQuads: number): Uint16Array {
  const indices = new Uint16Array(maxQuads * 6);
  for (let i = 0; i < maxQuads; i++) {
    const base = i * 4, offset = i * 6;
    indices[offset + 0] = base + 0;
    indices[offset + 1] = base + 1;
    indices[offset + 2] = base + 2;
    indices[offset + 3] = base + 2;
    indices[offset + 4] = base + 3;
    indices[offset + 5] = base + 0;
  }
  return indices;
}

```

## 📄 gfx/TextRenderer.ts

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// TextRenderer — High-level text rendering API
//
// BMFont rendering via SpriteBatch (zero extra shaders)
//
// Usage:
//   const text = new TextRenderer(gfx, spriteBatch);
//   await text.loadBitmapFont('pixel', '/fonts/pixel.png', '/fonts/pixel.fnt');
//
//   spriteBatch.begin(camera);
//   text.drawText('Score: 1234', 10, 10, {
//     font: text.getFont('pixel'),
//     fontSize: 16,
//     color: { r: 1, g: 1, b: 1, a: 1 },
//   });
//   spriteBatch.end();
// ═══════════════════════════════════════════════════════════════════════════

import type { IGfxDevice, IGfxBindGroupLayout } from './IGfxDevice.js';
import type { SpriteBatch, AtlasRegion } from './SpriteBatch.js';
import { TextureAtlas } from './SpriteBatch.js';
import type { Color } from '../Math.js';
import { FontData, parseBMFont, parseBMFontJson, mergeFontData, BMFontJson } from './Font.js';
import { layoutText, measureText, findMissingChars, canRender } from './Font.js';
import type { TextStyle, TextLayoutResult } from './Font.js';

// Re-export for convenience
export type { TextStyle, TextLayoutResult };
export type { BMFontJson };
export { findMissingChars, canRender, mergeFontData };

// ── Font Entry ───────────────────────────────────────────────────────────

interface FontEntry {
  data: FontData;
  atlas: TextureAtlas;
  atlases?: TextureAtlas[];  // Multi-atlas fonts (e.g., split into multiple PNGs)
}

// ── Temp region object (reused to avoid GC) ──────────────────────────────

const _tmpRegion: AtlasRegion = {
  u0: 0, v0: 0, u1: 0, v1: 0,
  pixelWidth: 0, pixelHeight: 0,
};

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 } as Color;

// ── TextRenderer ─────────────────────────────────────────────────────────

export class TextRenderer {
  private readonly gfx: IGfxDevice;
  private readonly spriteBatch: SpriteBatch;
  private readonly atlasLayout: IGfxBindGroupLayout;
  private readonly fonts = new Map<string, FontEntry>();

  constructor(gfx: IGfxDevice, spriteBatch: SpriteBatch) {
    this.gfx = gfx;
    this.spriteBatch = spriteBatch;
    this.atlasLayout = spriteBatch.getAtlasBindGroupLayout();
  }

  // ── Font Loading ──

  /**
   * Load a BMFont (.fnt text format + atlas PNG).
   *
   * @param key       Unique font identifier
   * @param atlasUrl  URL to the font atlas PNG
   * @param fntUrl    URL to the .fnt descriptor file
   */
  async loadBitmapFont(key: string, atlasUrl: string, fntUrl: string): Promise<void> {
    if (this.fonts.has(key)) return;

    // Load .fnt text and atlas in parallel
    const [fntText, atlas] = await Promise.all([
      fetch(fntUrl).then(r => {
        if (!r.ok) throw new Error(`Failed to load font descriptor: ${fntUrl} (${r.status})`);
        return r.text();
      }),
      TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
    ]);

    const data = parseBMFont(fntText);
    this.fonts.set(key, { data, atlas });
  }

  /**
   * Load a BMFont JSON format (.json + atlas PNG).
   * This is the format exported by tools like snowb.org.
   *
   * @param key       Unique font identifier
   * @param atlasUrl  URL to the font atlas PNG
   * @param jsonUrl   URL to the .json descriptor file
   */
  async loadBitmapFontJson(key: string, atlasUrl: string, jsonUrl: string): Promise<void> {
    if (this.fonts.has(key)) return;

    // Load JSON and atlas in parallel
    const [jsonData, atlas] = await Promise.all([
      fetch(jsonUrl).then(r => {
        if (!r.ok) throw new Error(`Failed to load font descriptor: ${jsonUrl} (${r.status})`);
        return r.json() as Promise<BMFontJson>;
      }),
      TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
    ]);

    const data = parseBMFontJson(jsonData);
    this.fonts.set(key, { data, atlas });
  }

  /**
   * Load a BMFont JSON split into multiple atlases (e.g., 3000 + 500 chars).
   * All parts will be merged into a single font entry.
   *
   * Usage for Fonsung (1-3000 + 3001-3500):
   *   await text.loadBitmapFontJsonMulti('fonsung', [
   *     { atlasUrl: '/fonts/Fonsung-16-3000.png', jsonUrl: '/fonts/Fonsung-16-3000.json' },
   *     { atlasUrl: '/fonts/Fonsung-16-3500.png', jsonUrl: '/fonts/Fonsung-16-3500.json' },
   *   ]);
   *
   * @param key   Unique font identifier
   * @param parts Array of atlas/json pairs, each will be assigned a page index
   */
  async loadBitmapFontJsonMulti(
    key: string,
    parts: Array<{ atlasUrl: string; jsonUrl: string }>,
  ): Promise<void> {
    if (this.fonts.has(key)) return;
    if (parts.length === 0) throw new Error('[TextRenderer] No font parts provided');

    // Load all atlases and JSONs in parallel, with page index
    const results = await Promise.all(
      parts.map(async ({ atlasUrl, jsonUrl }, pageIndex) => {
        const [jsonData, atlas] = await Promise.all([
          fetch(jsonUrl).then(r => {
            if (!r.ok) throw new Error(`Failed to load font descriptor: ${jsonUrl} (${r.status})`);
            return r.json() as Promise<BMFontJson>;
          }),
          TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
        ]);
        // Parse and assign page index to each glyph
        const data = parseBMFontJson(jsonData);
        // Override page for all glyphs to match the atlas index
        for (const glyph of data.glyphs.values()) {
          glyph.page = pageIndex;
        }
        return { data, atlas };
      }),
    );

    // Merge font data
    const mergedData = mergeFontData(results.map(r => r.data));
    const atlases = results.map(r => r.atlas);

    this.fonts.set(key, {
      data: mergedData,
      atlas: atlases[0],
      atlases,
    });
  }

  /**
   * Check if a font is loaded.
   */
  hasFont(key: string): boolean {
    return this.fonts.has(key);
  }

  /**
   * Get font data by key (for use in TextStyle).
   */
  getFont(key: string): FontData {
    const entry = this.fonts.get(key);
    if (!entry) throw new Error(`[TextRenderer] Font "${key}" not loaded`);
    return entry.data;
  }

  /**
   * Unload a font and release its atlas.
   */
  unloadFont(key: string): void {
    this.fonts.delete(key);
    // Note: TextureAtlas.texture.destroy() should be called if needed
  }

  // ── Rendering ──

  /**
   * Draw text using the SpriteBatch.
   * MUST be called between spriteBatch.begin() and spriteBatch.end().
   *
   * @param text   The string to render
   * @param x      X position (world/screen space)
   * @param y      Y position (world/screen space, top of first line)
   * @param style  Text style (must include `font` from getFont())
   */
  drawText(text: string, x: number, y: number, style: TextStyle): void {
    // Find the font entry (atlas)
    let fontEntry: FontEntry | null = null;
    for (const entry of this.fonts.values()) {
      if (entry.data === style.font) { fontEntry = entry; break; }
    }
    if (!fontEntry) throw new Error('[TextRenderer] Font in style not registered');

    const color = style.color ?? WHITE;

    // When align is center/right without a maxWidth container, treat x as the anchor point:
    //   center → x is the horizontal midpoint
    //   right  → x is the right edge
    // This matches the intuitive expectation of drawText(text, centerX, y, { align: 'center' }).
    let layoutX = x;
    const align = style.align;
    if (align && align !== 'left' && !(style.maxWidth ?? 0)) {
      const { width } = measureText(text, style);
      if (align === 'center') layoutX = Math.round(x - width * 0.5);
      else if (align === 'right') layoutX = Math.round(x - width);
    }

    const result = layoutText(text, layoutX, y, style);

    for (const q of result.quads) {
      // Set up the temp region to avoid allocating per-glyph
      // Swap V coordinates to fix upside-down text (BMFont y=0 at top, SpriteBatch v0 at top)
      _tmpRegion.u0 = q.u0;
      _tmpRegion.v0 = q.v1;  // 使用 v1 作为 v0
      _tmpRegion.u1 = q.u1;
      _tmpRegion.v1 = q.v0;  // 使用 v0 作为 v1
      _tmpRegion.pixelWidth = q.w;
      _tmpRegion.pixelHeight = q.h;

      // Select the correct atlas for this glyph (multi-atlas support)
      const glyph = fontEntry.data.glyphs.get(q.unicode);
      const page = glyph?.page ?? 0;
      const atlas = fontEntry.atlases?.[page] ?? fontEntry.atlas;

      // drawQuad expects center position, but our quads have top-left origin
      this.spriteBatch.drawQuad(
        q.x + q.w * 0.5,
        q.y + q.h * 0.5,
        q.w,
        q.h,
        0, // no rotation for text
        _tmpRegion,
        atlas,
        color,
      );
    }
  }

  // ── Measurement ──

  /**
   * Measure the bounding box of text without rendering.
   */
  measureText(text: string, style: TextStyle): { width: number; height: number } {
    return measureText(text, style);
  }

  /**
   * Check which characters in the text are missing from the font.
   * Returns unique missing characters for debugging or pre-flight checks.
   */
  findMissingChars(text: string, fontKey: string): string[] {
    const font = this.getFont(fontKey);
    return findMissingChars(text, font);
  }

  /**
   * Check if the font can render all characters in the given text.
   */
  canRender(text: string, fontKey: string): boolean {
    const font = this.getFont(fontKey);
    return canRender(text, font);
  }

  // ── Lifecycle ──

  destroy(): void {
    this.fonts.clear();
  }
}

```

## 📄 gfx/WebGL2Device.ts

```typescript
import type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc, BindGroupEntry,
} from './IGfxDevice.js';
import { BufferUsage } from './IGfxDevice.js';

// ── Resource wrappers ─────────────────────────────────────────────────────────

export class WebGL2Buffer implements IGfxBuffer {
  readonly size: number;
  readonly glBuffer: WebGLBuffer;
  readonly target: number;
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, desc: BufferDesc) {
    this.gl = gl;
    this.size = desc.size;
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create WebGL buffer');
    this.glBuffer = buf;
    this.target = (desc.usage & BufferUsage.INDEX)
      ? gl.ELEMENT_ARRAY_BUFFER
      : (desc.usage & BufferUsage.UNIFORM)
        ? gl.UNIFORM_BUFFER
        : gl.ARRAY_BUFFER;
    gl.bindBuffer(this.target, buf);
    gl.bufferData(this.target, desc.size, gl.DYNAMIC_DRAW);
    gl.bindBuffer(this.target, null);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.glBuffer);
  }
}

export class WebGL2Texture implements IGfxTexture {
  readonly width: number;
  readonly height: number;
  readonly glTexture: WebGLTexture;
  private readonly gl: WebGL2RenderingContext;

  private constructor(gl: WebGL2RenderingContext, width: number, height: number, glTexture: WebGLTexture) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.glTexture = glTexture;
  }

  static createEmpty(gl: WebGL2RenderingContext, desc: TextureDesc): WebGL2Texture {
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create WebGL texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, desc.width, desc.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new WebGL2Texture(gl, desc.width, desc.height, tex);
  }

  static fromLoaded(gl: WebGL2RenderingContext, width: number, height: number, glTexture: WebGLTexture): WebGL2Texture {
    return new WebGL2Texture(gl, width, height, glTexture);
  }

  destroy(): void {
    this.gl.deleteTexture(this.glTexture);
  }
}

// Stores uniform locations and texture unit assignments resolved at pipeline creation
interface UniformInfo {
  name: string;
  location: WebGLUniformLocation;
  type: 'mat4' | 'sampler2D';
  textureUnit?: number;
}

export class WebGL2Pipeline implements IGfxPipeline {
  readonly program: WebGLProgram;
  readonly uniforms: UniformInfo[];
  readonly bindingMap: Map<number, Map<number, UniformInfo>>;
  readonly vertexStride: number;
  readonly vertexAttributes: { shaderLocation: number; offset: number; size: number }[];

  constructor(
    program: WebGLProgram,
    uniforms: UniformInfo[],
    bindingMap: Map<number, Map<number, UniformInfo>>,
    vertexStride: number,
    vertexAttributes: { shaderLocation: number; offset: number; size: number }[],
  ) {
    this.program = program;
    this.uniforms = uniforms;
    this.bindingMap = bindingMap;
    this.vertexStride = vertexStride;
    this.vertexAttributes = vertexAttributes;
  }
  destroy(): void {}
}

export class WebGL2BindGroupLayout implements IGfxBindGroupLayout {
  readonly groupIndex: number;
  constructor(groupIndex: number) { this.groupIndex = groupIndex; }
}

export class WebGL2BindGroup implements IGfxBindGroup {
  readonly groupIndex: number;
  readonly entries: BindGroupEntry[];
  constructor(groupIndex: number, entries: BindGroupEntry[]) {
    this.groupIndex = groupIndex;
    this.entries = entries;
  }
}

// ── Render pass ───────────────────────────────────────────────────────────────

class WebGL2RenderPass implements IRenderPass {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private currentPipeline: WebGL2Pipeline | null = null;
  private boundGroups: Map<number, WebGL2BindGroup> = new Map();
  private dirtyGroups = new Set<number>();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;
    gl.bindVertexArray(this.vao);
  }

  setPipeline(p: IGfxPipeline): void {
    this.currentPipeline = p as WebGL2Pipeline;
    this.gl.useProgram(this.currentPipeline.program);
    // Mark all currently bound groups as dirty (new pipeline = re-apply all)
    for (const groupIdx of this.boundGroups.keys()) {
      this.dirtyGroups.add(groupIdx);
    }
  }

  setVertexBuffer(slot: number, buf: IGfxBuffer): void {
    const gl = this.gl;
    const b = buf as WebGL2Buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.glBuffer);
    void slot;
    if (this.currentPipeline) {
      for (const attr of this.currentPipeline.vertexAttributes) {
        gl.enableVertexAttribArray(attr.shaderLocation);
        gl.vertexAttribPointer(attr.shaderLocation, attr.size, gl.FLOAT, false, this.currentPipeline.vertexStride, attr.offset);
      }
    }
  }

  setIndexBuffer(buf: IGfxBuffer, _format: 'uint16' | 'uint32'): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, (buf as WebGL2Buffer).glBuffer);
  }

  setBindGroup(index: number, group: IGfxBindGroup): void {
    this.boundGroups.set(index, group as WebGL2BindGroup);
    this.dirtyGroups.add(index);
  }

  drawIndexed(indexCount: number, _instanceCount = 1, firstIndex = 0): void {
    const gl = this.gl;
    const pipeline = this.currentPipeline!;

    for (const groupIdx of this.dirtyGroups) {
      const group = this.boundGroups.get(groupIdx);
      if (!group) continue;
      const groupBindings = pipeline.bindingMap.get(groupIdx);
      if (!groupBindings) continue;
      for (const entry of group.entries) {
        const info = groupBindings.get(entry.binding);
        if (!info) continue;
        if (info.type === 'mat4' && entry.buffer) {
          const buf = entry.buffer as WebGL2Buffer & { cpuData?: Float32Array };
          if (buf.cpuData) gl.uniformMatrix4fv(info.location, false, buf.cpuData);
        } else if (info.type === 'sampler2D' && entry.texture) {
          const unit = info.textureUnit ?? 0;
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, (entry.texture as WebGL2Texture).glTexture);
          gl.uniform1i(info.location, unit);
        }
      }
    }
    this.dirtyGroups.clear();

    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, firstIndex * 2);
  }

  end(): void {
    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vao);
  }
}

class WebGL2FrameEncoder implements IFrameEncoder {
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  beginRenderPass(clearColor: [number, number, number, number]): IRenderPass {
    const gl = this.gl;
    const [r, g, b, a] = clearColor;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return new WebGL2RenderPass(gl);
  }

  submit(): void { /* WebGL 2 is immediate mode — nothing to submit */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

// ── Device ────────────────────────────────────────────────────────────────────

type WebGL2BufferWithShadow = WebGL2Buffer & { cpuData?: Float32Array };

export class WebGL2Device implements IGfxDevice {
  private gl: WebGL2RenderingContext;

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGL2Device> {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 not supported');
    return new WebGL2Device(gl);
  }

  createBuffer(desc: BufferDesc): IGfxBuffer {
    return new WebGL2Buffer(this.gl, desc);
  }

  createTexture(desc: TextureDesc): IGfxTexture {
    return WebGL2Texture.createEmpty(this.gl, desc);
  }

  createPipeline(desc: PipelineDesc): IGfxPipeline {
    if (!desc.vertGlsl || !desc.fragGlsl) throw new Error('WebGL2Device requires vertGlsl and fragGlsl');
    const program = linkProgram(this.gl, desc.vertGlsl, desc.fragGlsl);
    this.gl.useProgram(program);

    const vertexAttrs = desc.vertexAttributes.map(a => ({
      shaderLocation: a.shaderLocation,
      offset: a.offset,
      size: a.format === 'float32x2' ? 2 : 4,
    }));

    const uniforms: UniformInfo[] = [];
    const bindingMap = new Map<number, Map<number, UniformInfo>>();
    let textureUnit = 0;

    for (let groupIdx = 0; groupIdx < desc.bindGroupLayouts.length; groupIdx++) {
      const groupMap = new Map<number, UniformInfo>();
      bindingMap.set(groupIdx, groupMap);
      for (const entry of desc.bindGroupLayouts[groupIdx]) {
        if (entry.type === 'sampler') continue;
        const name = entry.name;
        if (!name) continue;
        const loc = this.gl.getUniformLocation(program, name);
        if (!loc) continue;
        const info: UniformInfo = {
          name,
          location: loc,
          type: entry.type === 'texture' ? 'sampler2D' : 'mat4',
          textureUnit: entry.type === 'texture' ? textureUnit++ : undefined,
        };
        uniforms.push(info);
        groupMap.set(entry.binding, info);
      }
    }

    return new WebGL2Pipeline(program, uniforms, bindingMap, desc.vertexStride, vertexAttrs);
  }

  getBindGroupLayout(pipeline: IGfxPipeline, groupIndex: number): IGfxBindGroupLayout {
    void pipeline;
    return new WebGL2BindGroupLayout(groupIndex);
  }

  createBindGroup(desc: BindGroupDesc): IGfxBindGroup {
    const layout = desc.layout as WebGL2BindGroupLayout;
    return new WebGL2BindGroup(layout.groupIndex, desc.entries);
  }

  writeBuffer(buf: IGfxBuffer, data: ArrayBufferView | ArrayBuffer, byteOffset = 0): void {
    const gl = this.gl;
    const b = buf as WebGL2BufferWithShadow;
    gl.bindBuffer(b.target, b.glBuffer);
    if (data instanceof ArrayBuffer) {
      gl.bufferSubData(b.target, byteOffset, data);
    } else {
      gl.bufferSubData(b.target, byteOffset, data);
    }
    if (data instanceof Float32Array) {
      b.cpuData = new Float32Array(data);
    }
    gl.bindBuffer(b.target, null);
  }

  async loadTexture(url: string): Promise<IGfxTexture> {
    const gl = this.gl;
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    bitmap.close();
    return WebGL2Texture.fromLoaded(gl, bitmap.width, bitmap.height, tex);
  }

  beginFrame(): IFrameEncoder {
    return new WebGL2FrameEncoder(this.gl);
  }

  destroy(): void {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}

```

## 📄 gfx/WebGPUDevice.ts

```typescript
import type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc,
} from './IGfxDevice.js';

// ── Resource wrappers ─────────────────────────────────────────────────────────

export class WebGPUBuffer implements IGfxBuffer {
  readonly size: number;
  readonly gpuBuffer: GPUBuffer;
  constructor(device: GPUDevice, desc: BufferDesc) {
    this.size = desc.size;
    this.gpuBuffer = device.createBuffer({
      label: desc.label,
      size: desc.size,
      usage: desc.usage,
      mappedAtCreation: desc.mappedAtCreation ?? false,
    });
  }
  destroy(): void { this.gpuBuffer.destroy(); }
}

export class WebGPUTexture implements IGfxTexture {
  readonly width: number;
  readonly height: number;
  readonly gpuTexture: GPUTexture;
  constructor(device: GPUDevice, desc: TextureDesc & { format?: GPUTextureFormat; usage?: GPUTextureUsageFlags }) {
    this.width = desc.width;
    this.height = desc.height;
    this.gpuTexture = device.createTexture({
      label: desc.label,
      size: [desc.width, desc.height],
      format: desc.format ?? 'rgba8unorm',
      usage: desc.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT),
    });
  }
  destroy(): void { this.gpuTexture.destroy(); }
}

export class WebGPUPipeline implements IGfxPipeline {
  readonly pipeline: GPURenderPipeline;
  constructor(pipeline: GPURenderPipeline) { this.pipeline = pipeline; }
  destroy(): void { /* GPURenderPipeline has no destroy */ }
}

export class WebGPUBindGroupLayout implements IGfxBindGroupLayout {
  readonly layout: GPUBindGroupLayout;
  constructor(layout: GPUBindGroupLayout) { this.layout = layout; }
}

export class WebGPUBindGroup implements IGfxBindGroup {
  readonly bindGroup: GPUBindGroup;
  constructor(bindGroup: GPUBindGroup) { this.bindGroup = bindGroup; }
}

// ── Render pass ───────────────────────────────────────────────────────────────

class WebGPURenderPass implements IRenderPass {
  constructor(private pass: GPURenderPassEncoder) {}

  setPipeline(p: IGfxPipeline): void {
    this.pass.setPipeline((p as WebGPUPipeline).pipeline);
  }
  setVertexBuffer(slot: number, buf: IGfxBuffer): void {
    this.pass.setVertexBuffer(slot, (buf as WebGPUBuffer).gpuBuffer);
  }
  setIndexBuffer(buf: IGfxBuffer, format: 'uint16' | 'uint32'): void {
    this.pass.setIndexBuffer((buf as WebGPUBuffer).gpuBuffer, format);
  }
  setBindGroup(index: number, group: IGfxBindGroup): void {
    this.pass.setBindGroup(index, (group as WebGPUBindGroup).bindGroup);
  }
  drawIndexed(indexCount: number, instanceCount = 1, firstIndex = 0): void {
    this.pass.drawIndexed(indexCount, instanceCount, firstIndex);
  }
  end(): void { this.pass.end(); }
}

class WebGPUFrameEncoder implements IFrameEncoder {
  private encoder: GPUCommandEncoder;
  private device: GPUDevice;
  private currentView: GPUTextureView;

  constructor(device: GPUDevice, currentView: GPUTextureView) {
    this.device = device;
    this.currentView = currentView;
    this.encoder = device.createCommandEncoder();
  }

  beginRenderPass(clearColor: [number, number, number, number]): IRenderPass {
    const [r, g, b, a] = clearColor;
    const pass = this.encoder.beginRenderPass({
      colorAttachments: [{
        view: this.currentView,
        clearValue: { r, g, b, a },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    return new WebGPURenderPass(pass);
  }

  submit(): void {
    this.device.queue.submit([this.encoder.finish()]);
  }
}

// ── Device ────────────────────────────────────────────────────────────────────

export class WebGPUDevice implements IGfxDevice {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;

  private _nearestSampler: GPUSampler | null = null;

  private constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device;
    this.context = context;
    this.format = format;
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGPUDevice> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    return new WebGPUDevice(device, context, format);
  }

  private _getNearestSampler(): GPUSampler {
    if (!this._nearestSampler) {
      this._nearestSampler = this.device.createSampler({
        magFilter: 'nearest',
        minFilter: 'nearest',
      });
    }
    return this._nearestSampler;
  }

  createBuffer(desc: BufferDesc): IGfxBuffer {
    return new WebGPUBuffer(this.device, desc);
  }

  createTexture(desc: TextureDesc): IGfxTexture {
    return new WebGPUTexture(this.device, desc);
  }

  createPipeline(desc: PipelineDesc): IGfxPipeline {
    if (!desc.wgsl) throw new Error('WebGPUDevice requires wgsl shader');
    const module = this.device.createShaderModule({ label: desc.label, code: desc.wgsl });

    const attributes: GPUVertexAttribute[] = desc.vertexAttributes.map(a => ({
      shaderLocation: a.shaderLocation,
      offset: a.offset,
      format: a.format as GPUVertexFormat,
    }));

    const blendAlpha: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    const blendAdditive: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'one',       dstFactor: 'one', operation: 'add' },
    };
    const blend = desc.blendMode === 'additive' ? blendAdditive
                : desc.blendMode === 'none'     ? undefined
                : blendAlpha;

    const pipeline = this.device.createRenderPipeline({
      label: desc.label,
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [{ arrayStride: desc.vertexStride, attributes }],
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: this.format, blend }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
    return new WebGPUPipeline(pipeline);
  }

  getBindGroupLayout(pipeline: IGfxPipeline, groupIndex: number): IGfxBindGroupLayout {
    const gpuPipeline = (pipeline as WebGPUPipeline).pipeline;
    return new WebGPUBindGroupLayout(gpuPipeline.getBindGroupLayout(groupIndex));
  }

  createBindGroup(desc: BindGroupDesc): IGfxBindGroup {
    const layout = (desc.layout as WebGPUBindGroupLayout).layout;
    const entries: GPUBindGroupEntry[] = desc.entries.map(e => {
      if (e.buffer) {
        return { binding: e.binding, resource: { buffer: (e.buffer as WebGPUBuffer).gpuBuffer } };
      }
      if (e.texture) {
        return { binding: e.binding, resource: (e.texture as WebGPUTexture).gpuTexture.createView() };
      }
      if (e.sampler) {
        return { binding: e.binding, resource: this._getNearestSampler() };
      }
      throw new Error('BindGroupEntry must have buffer, texture, or sampler');
    });
    return new WebGPUBindGroup(this.device.createBindGroup({ layout, entries }));
  }

  writeBuffer(buf: IGfxBuffer, data: ArrayBufferView | ArrayBuffer, byteOffset = 0): void {
    this.device.queue.writeBuffer((buf as WebGPUBuffer).gpuBuffer, byteOffset, data);
  }

  async loadTexture(url: string): Promise<IGfxTexture> {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const tex = new WebGPUTexture(this.device, {
      label: url,
      width: bitmap.width,
      height: bitmap.height,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: tex.gpuTexture },
      [bitmap.width, bitmap.height],
    );
    bitmap.close();
    return tex;
  }

  beginFrame(): IFrameEncoder {
    return new WebGPUFrameEncoder(this.device, this.context.getCurrentTexture().createView());
  }

  destroy(): void { this.device.destroy(); }
}

```

## 📄 index.ts

```typescript
export * from './GameLoop.js';
export * from './Input.js';
export * from './Math.js';
export * from './Camera2D.js';
export * from './audio.js';
export * from './gfx/SpriteBatch.js';
export * from './gfx/TextRenderer.js';
export { createGfxDevice } from './gfx/createGfxDevice.js';
export { BufferUsage } from './gfx/IGfxDevice.js';
export type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc, BindGroupEntry,
} from './gfx/IGfxDevice.js';
export type { AtlasRegion } from './gfx/SpriteBatch.js';

// Font
export * from './gfx/Font.js';

```

## 📄 Input.ts

```typescript
// ═════════════════════════════════════════════════════════════════════════════
// Input System — Unified Module
// Contains: InputManager, ActionMap, ActionState, and all type definitions
//
// 帧调用顺序契约：
//   input.update()       // 轮询手柄
//   ... 游戏逻辑 ...      // 读取 action().pressed / .down / .vec2()
//   input.endFrame()     // 清 pressed/released + delta
// ═════════════════════════════════════════════════════════════════════════════

// ── Enums & Types ────────────────────────────────────────────────────────────

export enum ActionType {
  Button,  // bool: Jump, Shoot, Pause
  Axis1D,  // float -1..1: Throttle
  Axis2D,  // vec2: Move, Look
}

export interface CompositeAxis2D {
  up:    string;
  down:  string;
  left:  string;
  right: string;
}

export interface Axis1DDef {
  negative: string;  // e.g. "KeyA", "ArrowLeft"
  positive: string;  // e.g. "KeyD", "ArrowRight"
}

export interface ActionDef {
  type:        ActionType;
  /** Button / Axis1D: 键盘/鼠标/手柄按钮，任一触发即可 */
  bindings?:   string[];
  /** Axis2D: 键盘组合方向键，可多套 */
  composites?: CompositeAxis2D[];
  /** Axis1D: 显式正/负绑定（替代 bindings[0]/[1] 约定） */
  axis1d?:     Axis1DDef;
  /** Axis2D: 手柄摇杆，格式 "Gamepad0_Stick0" */
  gamepadStick?: string;
}

// ── ActionState ──────────────────────────────────────────────────────────────

export class ActionState {
  // 预解析的手柄摇杆索引（避免每帧 regex）
  private readonly _gpIndex:    number = -1;
  private readonly _stickIndex: number = -1;

  constructor(
    private readonly mgr: InputManager,
    private readonly def: ActionDef,
  ) {
    // 预解析 gamepadStick 字符串
    if (def.gamepadStick) {
      const m = def.gamepadStick.match(/^Gamepad(\d+)_Stick(\d+)$/);
      if (m) {
        this._gpIndex    = +m[1];
        this._stickIndex = +m[2];
      }
    }
  }

  // ── Button ────────────────────────────────────────────────────────────────

  get down(): boolean {
    if (!this.def.bindings) return false;
    for (const key of this.def.bindings)
      if (this.mgr.rawDown(key)) return true;
    return false;
  }

  get pressed(): boolean {
    if (!this.def.bindings) return false;
    for (const key of this.def.bindings)
      if (this.mgr.rawPressed(key)) return true;
    return false;
  }

  get released(): boolean {
    if (!this.def.bindings) return false;
    for (const key of this.def.bindings)
      if (this.mgr.rawReleased(key)) return true;
    return false;
  }

  // ── Axis2D ────────────────────────────────────────────────────────────────

  vec2(): { x: number; y: number } {
    // 1. 手柄摇杆优先（有输入时直接返回）
    if (this._gpIndex >= 0) {
      const s = this.mgr.rawStickByIndex(this._gpIndex, this._stickIndex);
      if (s.x !== 0 || s.y !== 0) return s;
    }

    // 2. 键盘 composite
    if (!this.def.composites) return { x: 0, y: 0 };

    let x = 0, y = 0;
    for (const c of this.def.composites) {
      // 每组 composite 独立计算，先到先得（不互相覆盖）
      if (x === 0) {
        const r = this.mgr.rawDown(c.right) ? 1 : 0;
        const l = this.mgr.rawDown(c.left)  ? 1 : 0;
        if (r || l) x = r - l;
      }
      if (y === 0) {
        const d = this.mgr.rawDown(c.down)  ? 1 : 0;
        const u = this.mgr.rawDown(c.up)    ? 1 : 0;
        if (d || u) y = d - u;
      }
    }

    // 对角线归一化（和 Unity Composite 一致）
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      return { x: x * inv, y: y * inv };
    }
    return { x, y };
  }

  // ── Axis1D ────────────────────────────────────────────────────────────────

  axis(): number {
    // 优先使用显式 axis1d 定义
    if (this.def.axis1d) {
      const pos = this.mgr.rawDown(this.def.axis1d.positive) ? 1 : 0;
      const neg = this.mgr.rawDown(this.def.axis1d.negative) ? 1 : 0;
      return pos - neg;
    }
    // 兼容 bindings[0]=negative, bindings[1]=positive 的旧写法
    if (!this.def.bindings || this.def.bindings.length < 2) return 0;
    const pos = this.mgr.rawDown(this.def.bindings[1]) ? 1 : 0;
    const neg = this.mgr.rawDown(this.def.bindings[0]) ? 1 : 0;
    return pos - neg;
  }
}

// ── ActionMap ────────────────────────────────────────────────────────────────

export class ActionMap {
  readonly name: string;
  enabled = false;
  private readonly actions = new Map<string, ActionState>();

  constructor(
    name: string,
    defs: Record<string, ActionDef>,
    mgr: InputManager,
  ) {
    this.name = name;
    for (const [k, def] of Object.entries(defs))
      this.actions.set(k, new ActionState(mgr, def));
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  action(name: string): ActionState {
    const a = this.actions.get(name);
    if (!a) throw new Error(`Action "${name}" not found in map "${this.name}"`);
    return a;
  }

  enable():  void { this.enabled = true; }
  disable(): void { this.enabled = false; }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PREVENT_KEYS = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Tab', 'Backspace',
];

// Gamepad deadzone: values below MIN are zeroed, then remapped to 0..1 up to MAX
const DEADZONE_MIN = 0.25;
const DEADZONE_MAX = 0.85;

const STICK_ZERO: Readonly<{ x: number; y: number }> = { x: 0, y: 0 };

function applyDeadzone(v: number): number {
  const abs = Math.abs(v);
  if (abs < DEADZONE_MIN) return 0;
  const remapped = (abs - DEADZONE_MIN) / (DEADZONE_MAX - DEADZONE_MIN);
  return Math.sign(v) * Math.min(remapped, 1);
}

// ── InputManager ─────────────────────────────────────────────────────────────

export class InputManager {
  // ── LittleJS 3-bit 位域核心 ──────────────────────────────────────────────
  // bit 0 = isDown, bit 1 = wasPressed, bit 2 = wasReleased
  private state: Record<string, number> = {};

  // ── 手柄摇杆数据 ─────────────────────────────────────────────────────────
  // stickData[gamepadIndex][stickIndex] = { x, y }
  private stickData: { x: number; y: number }[][] = [];

  // ── 鼠标 ─────────────────────────────────────────────────────────────────
  screenX    = 0;
  screenY    = 0;
  deltaX     = 0;
  deltaY     = 0;
  wheelDelta = 0;
  inWindow   = true;

  // ── ActionMap 注册表 ──────────────────────────────────────────────────────
  private readonly maps = new Map<string, ActionMap>();

  private readonly canvas: HTMLCanvasElement;
  private readonly cfg: { preventDefault: boolean; preventKeys: string[] };
  private readonly handlers: [string, EventListener, AddEventListenerOptions?][] = [];

  constructor(canvas: HTMLCanvasElement, config?: {
    preventDefault?:     boolean;
    preventDefaultKeys?: string[];
  }) {
    this.canvas = canvas;
    this.cfg = {
      preventDefault: config?.preventDefault ?? true,
      preventKeys:    config?.preventDefaultKeys ?? DEFAULT_PREVENT_KEYS,
    };
    this._attachDOM();
  }

  // ── ActionMap 管理 ────────────────────────────────────────────────────────

  addMap(map: ActionMap): this {
    this.maps.set(map.name, map);
    return this;
  }

  map(name: string): ActionMap {
    const m = this.maps.get(name);
    if (!m) throw new Error(`ActionMap "${name}" not found`);
    return m;
  }

  /** 在所有已启用的 map 中查找 action（无 try/catch，用 has 检查） */
  action(name: string): ActionState {
    for (const m of this.maps.values()) {
      if (m.enabled && m.has(name)) return m.action(name);
    }
    throw new Error(`Action "${name}" not found in any enabled ActionMap`);
  }

  // ── 原始位域查询（ActionState 内部使用）──────────────────────────────────

  rawDown    (k: string): boolean { return !!(this.state[k] & 1); }
  rawPressed (k: string): boolean { return !!(this.state[k] & 2); }
  rawReleased(k: string): boolean { return !!(this.state[k] & 4); }

  /** 通过预解析的索引直接读取手柄摇杆（无 regex） */
  rawStickByIndex(gpIndex: number, stickIndex: number): { x: number; y: number } {
    return this.stickData[gpIndex]?.[stickIndex] ?? STICK_ZERO;
  }

  /**
   * 读取手柄摇杆，key 格式："Gamepad0_Stick0"
   * 保留给外部直接查询使用；ActionState 内部走 rawStickByIndex
   */
  rawStick(key: string): { x: number; y: number } {
    const m = key.match(/^Gamepad(\d+)_Stick(\d+)$/);
    if (!m) return STICK_ZERO;
    return this.stickData[+m[1]]?.[+m[2]] ?? STICK_ZERO;
  }

  // ── 帧生命周期 ────────────────────────────────────────────────────────────

  /**
   * 每帧开头调用：轮询手柄状态
   * （键盘/鼠标由 DOM 事件驱动，不需要在这里处理）
   */
  update(): void {
    this._pollGamepads();
  }

  /** 每帧结尾调用：清除 pressed/released 位，重置增量 */
  endFrame(): void {
    for (const k in this.state) this.state[k] &= 1;
    // 滚轮没有 "up" 事件，isDown 位必须手动清零
    delete this.state['WheelUp'];
    delete this.state['WheelDown'];
    this.deltaX = this.deltaY = this.wheelDelta = 0;
  }

  /** 全清（blur / 场景切换时调用） */
  clear(): void {
    this.state     = {};
    this.stickData = [];
    this.deltaX    = this.deltaY = this.wheelDelta = 0;
  }

  destroy(): void {
    for (const [evt, fn, opts] of this.handlers)
      document.removeEventListener(evt, fn, opts);
    this.handlers.length = 0;
  }

  // ── Gamepad 轮询 ──────────────────────────────────────────────────────────

  private _pollGamepads(): void {
    if (!navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    for (let gi = 0; gi < gamepads.length; gi++) {
      const gp = gamepads[gi];
      if (!gp) {
        // 手柄断开：清除该手柄的所有状态
        if (this.stickData[gi]) {
          this.stickData[gi] = [];
          const prefix = `Gamepad${gi}_`;
          for (const k in this.state) {
            if (k.startsWith(prefix)) delete this.state[k];
          }
        }
        continue;
      }

      // 摇杆（每对 axes 组成一个 stick）
      if (!this.stickData[gi]) this.stickData[gi] = [];
      for (let si = 0; si < Math.floor(gp.axes.length / 2); si++) {
        this.stickData[gi][si] = {
          x: applyDeadzone(gp.axes[si * 2]),
          y: applyDeadzone(gp.axes[si * 2 + 1]),
        };
      }

      // 按钮 → 3-bit 位域，key = "Gamepad0_Button0"
      for (let bi = 0; bi < gp.buttons.length; bi++) {
        const key     = `Gamepad${gi}_Button${bi}`;
        const pressed = gp.buttons[bi].pressed;
        const wasDown = !!(this.state[key] & 1);

        if (pressed && !wasDown)       this.state[key] = 3; // 新按下
        else if (pressed && wasDown)   this.state[key] = 1; // 持续按住
        else if (!pressed && wasDown)  this.state[key] = (this.state[key] & 2) | 4; // 释放
        // !pressed && !wasDown → 不写，保持 0/undefined
      }
    }
  }

  // ── DOM 事件绑定 ──────────────────────────────────────────────────────────

  private _attachDOM(): void {
    const on = (
      evt: string,
      fn: EventListener,
      opts?: AddEventListenerOptions,
    ) => {
      document.addEventListener(evt, fn, opts);
      this.handlers.push([evt, fn, opts]);
    };

    on('keydown',     this._onKD.bind(this));
    on('keyup',       this._onKU.bind(this));
    on('mousedown',   this._onMD.bind(this));
    on('mouseup',     this._onMU.bind(this));
    on('mousemove',   this._onMM.bind(this));
    on('mouseleave',  () => { this.inWindow = false; });
    on('wheel',       this._onWh.bind(this), { passive: false });
    on('contextmenu', (e) => { if (this.cfg.preventDefault) e.preventDefault(); });
    on('blur',        () => this.clear());
  }

  private _onKD(e: Event): void {
    const k = e as KeyboardEvent;
    if (k.repeat) return;
    this.state[k.code] = 3;
    this._preventKey(k);
  }

  private _onKU(e: Event): void {
    const k = e as KeyboardEvent;
    this.state[k.code] = (this.state[k.code] & 2) | 4;
  }

  private _onMD(e: Event): void {
    const m = e as MouseEvent;
    this.state[`Mouse${m.button}`] = 3;
    this._updateMousePos(m);
    if (this.cfg.preventDefault && m.cancelable) m.preventDefault();
  }

  private _onMU(e: Event): void {
    const m = e as MouseEvent;
    const k = `Mouse${m.button}`;
    this.state[k] = (this.state[k] & 2) | 4;
  }

  private _onMM(e: Event): void {
    const m = e as MouseEvent;
    this.inWindow = true;
    const px = this.screenX, py = this.screenY;
    this._updateMousePos(m);
    this.deltaX += this.screenX - px;
    this.deltaY += this.screenY - py;
  }

  private _onWh(e: Event): void {
    const w = e as WheelEvent;
    const d = Math.sign(w.deltaY);
    this.wheelDelta = w.ctrlKey ? 0 : d;
    if (d < 0) this.state['WheelUp']   = 3;
    if (d > 0) this.state['WheelDown'] = 3;
    if (this.cfg.preventDefault && w.cancelable) w.preventDefault();
  }

  private _updateMousePos(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.screenX = ((e.clientX - r.left) / r.width)  * this.canvas.width;
    this.screenY = ((e.clientY - r.top)  / r.height) * this.canvas.height;
  }

  private _preventKey(e: KeyboardEvent): void {
    if (!this.cfg.preventDefault || !e.cancelable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? '')) return;
    const printable = typeof e.key === 'string' && e.key.length === 1;
    if (printable || this.cfg.preventKeys.includes(e.code)) e.preventDefault();
  }
}

```

## 📄 Math.ts

```typescript
// ═════════════════════════════════════════════════════════════════════════════
// Math Utils — Color, Vec2, Mat4, Rect
// ═════════════════════════════════════════════════════════════════════════════

// ── Color ────────────────────────────────────────────────────────────────────

export class Color {
  constructor(
    public r: number = 1,
    public g: number = 1,
    public b: number = 1,
    public a: number = 1,
  ) {}

  static white(): Color  { return new Color(1, 1, 1, 1); }
  static black(): Color  { return new Color(0, 0, 0, 1); }
  static red(): Color    { return new Color(1, 0, 0, 1); }
  static green(): Color  { return new Color(0, 1, 0, 1); }
  static blue(): Color   { return new Color(0, 0, 1, 1); }
  static clear(): Color  { return new Color(0, 0, 0, 0); }

  static fromHex(hex: string): Color {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return new Color(r, g, b, a);
  }

  lerp(other: Color, t: number): Color {
    return new Color(
      this.r + (other.r - this.r) * t,
      this.g + (other.g - this.g) * t,
      this.b + (other.b - this.b) * t,
      this.a + (other.a - this.a) * t,
    );
  }

  withAlpha(a: number): Color { return new Color(this.r, this.g, this.b, a); }
  clone(): Color { return new Color(this.r, this.g, this.b, this.a); }
}

// ── Vec2 ─────────────────────────────────────────────────────────────────────

export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  static zero(): Vec2 { return new Vec2(0, 0); }
  static one(): Vec2  { return new Vec2(1, 1); }
  static from(x: number, y: number): Vec2 { return new Vec2(x, y); }

  add(v: Vec2): Vec2    { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: Vec2): Vec2    { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s: number): Vec2 { return new Vec2(this.x * s, this.y * s); }
  mul(v: Vec2): Vec2    { return new Vec2(this.x * v.x, this.y * v.y); }

  dot(v: Vec2): number  { return this.x * v.x + this.y * v.y; }
  length(): number      { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq(): number    { return this.x * this.x + this.y * this.y; }

  normalize(): Vec2 {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : Vec2.zero();
  }

  lerp(v: Vec2, t: number): Vec2 {
    return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
  }

  clone(): Vec2 { return new Vec2(this.x, this.y); }

  addSelf(v: Vec2): this { this.x += v.x; this.y += v.y; return this; }
  scaleSelf(s: number): this { this.x *= s; this.y *= s; return this; }
}

// ── Mat4 ─────────────────────────────────────────────────────────────────────

// Column-major 4x4 matrix (matches WebGPU/WGSL convention)
export class Mat4 {
  readonly data: Float32Array;

  constructor(data?: Float32Array) {
    this.data = data ?? new Float32Array(16);
  }

  static identity(): Mat4 {
    const m = new Mat4();
    m.data[0] = 1; m.data[5] = 1; m.data[10] = 1; m.data[15] = 1;
    return m;
  }

  // Orthographic projection: maps [left,right] x [bottom,top] x [near,far] → NDC
  static ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const m = new Mat4();
    const d = m.data;
    d[0]  =  2 / (right - left);
    d[5]  =  2 / (top - bottom);
    d[10] = -2 / (far - near);
    d[12] = -(right + left) / (right - left);
    d[13] = -(top + bottom) / (top - bottom);
    d[14] = -(far + near)   / (far - near);
    d[15] = 1;
    return m;
  }

  static multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Mat4();
    const A = a.data, B = b.data, C = out.data;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += A[k * 4 + row] * B[col * 4 + k];
        C[col * 4 + row] = sum;
      }
    }
    return out;
  }

  static translation(x: number, y: number): Mat4 {
    const m = Mat4.identity();
    m.data[12] = x;
    m.data[13] = y;
    return m;
  }

  static scaling(sx: number, sy: number): Mat4 {
    const m = Mat4.identity();
    m.data[0] = sx;
    m.data[5] = sy;
    return m;
  }

  static rotationZ(angle: number): Mat4 {
    const m = Mat4.identity();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[0] =  c; m.data[4] = -s;
    m.data[1] =  s; m.data[5] =  c;
    return m;
  }
}

// ── Rect ─────────────────────────────────────────────────────────────────────

export class Rect {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0,
  ) {}

  get left(): number   { return this.x; }
  get right(): number  { return this.x + this.width; }
  get top(): number    { return this.y; }
  get bottom(): number { return this.y + this.height; }

  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom;
  }

  intersects(other: Rect): boolean {
    return this.left < other.right  &&
           this.right > other.left  &&
           this.top < other.bottom  &&
           this.bottom > other.top;
  }

  clone(): Rect { return new Rect(this.x, this.y, this.width, this.height); }
}

```

## 📄 vite-env.d.ts

```typescript
// Vite ?raw import type declarations
declare module '*.wgsl?raw' {
  const content: string;
  export default content;
}

declare module '*.vert.glsl?raw' {
  const content: string;
  export default content;
}

declare module '*.frag.glsl?raw' {
  const content: string;
  export default content;
}

```

---

*文件由 export-code.mjs 自动生成*
