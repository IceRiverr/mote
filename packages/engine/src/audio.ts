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
