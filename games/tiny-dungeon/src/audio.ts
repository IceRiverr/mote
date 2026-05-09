// games/tiny-dungeon/src/audio.ts
// 程序化音效生成 —— 无需外部音频文件

import { AudioManager } from '@mote/engine';

const SAMPLE_RATE = 44100;

/** 为游戏生成所有音效并注册到 AudioManager */
export function generateAndRegisterSounds(audio: AudioManager): void {
  audio.register('shoot', createShootSound(audio.ctx));
  audio.register('hit', createHitSound(audio.ctx));
  audio.register('enemyDie', createEnemyDieSound(audio.ctx));
  audio.register('hurt', createHurtSound(audio.ctx));
  audio.register('pickup', createPickupSound(audio.ctx));
  audio.register('levelup', createLevelUpSound(audio.ctx));
}

// ═════════════════════════════════════════════════════════════════════════════
// 合成器辅助
// ═════════════════════════════════════════════════════════════════════════════

function createBuffer(ctx: AudioContext, durationSec: number, channels = 1): AudioBuffer {
  const frames = Math.ceil(durationSec * SAMPLE_RATE);
  return ctx.createBuffer(channels, frames, SAMPLE_RATE);
}

function writeNoise(data: Float32Array, amp = 1): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * amp;
  }
}

function writeSquare(data: Float32Array, freq: number, amp = 1): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sign(Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE)) * amp;
  }
}

function writeSawtooth(data: Float32Array, freq: number, amp = 1): void {
  for (let i = 0; i < data.length; i++) {
    const phase = ((freq * i) / SAMPLE_RATE) % 1;
    data[i] = (phase * 2 - 1) * amp;
  }
}

function writeSine(data: Float32Array, freq: number, amp = 1): void {
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * amp;
  }
}

/** 方波，带占空比扫描（duty 0..1，0.5 为标准方波） */
function writeSquareDutySweep(data: Float32Array, freq: number, startDuty: number, endDuty: number, amp = 1): void {
  for (let i = 0; i < data.length; i++) {
    const phase = ((freq * i) / SAMPLE_RATE) % 1;
    const duty = startDuty + (endDuty - startDuty) * (i / data.length);
    data[i] = (phase < duty ? 1 : -1) * amp;
  }
}

function applyEnvelope(data: Float32Array, attackSec: number, decaySec: number): void {
  const attackFrames = Math.floor(attackSec * SAMPLE_RATE);
  const decayFrames = Math.floor(decaySec * SAMPLE_RATE);
  for (let i = 0; i < data.length; i++) {
    let env = 1;
    if (i < attackFrames) {
      env = i / attackFrames;
    } else if (i < attackFrames + decayFrames) {
      env = 1 - (i - attackFrames) / decayFrames;
    } else {
      env = 0;
    }
    data[i] *= env;
  }
}

function applyExpDecay(data: Float32Array, decaySec: number): void {
  for (let i = 0; i < data.length; i++) {
    data[i] *= Math.exp(-i / (decaySec * SAMPLE_RATE));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 具体音效
// ═════════════════════════════════════════════════════════════════════════════

/** 射击：方波 + 占空比扫描，像激光/能量武器 */
function createShootSound(ctx: AudioContext): AudioBuffer {
  const duration = 0.12;
  const buf = createBuffer(ctx, duration);
  const data = buf.getChannelData(0);
  // 基础方波 800Hz，duty 从 0.8（宽脉冲，闷）扫到 0.05（窄脉冲，尖）
  writeSquareDutySweep(data, 800, 0.8, 0.05, 0.5);
  // 叠加一点白噪声增加颗粒感
  for (let i = 0; i < data.length; i++) {
    data[i] += (Math.random() * 2 - 1) * 0.15;
  }
  applyEnvelope(data, 0.005, 0.115);
  return buf;
}

/** 命中：方波快速降调，像击中肉体 */
function createHitSound(ctx: AudioContext): AudioBuffer {
  const duration = 0.1;
  const buf = createBuffer(ctx, duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 300 * Math.exp(-t * 20);
    data[i] = Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.5;
  }
  applyEnvelope(data, 0.005, 0.095);
  return buf;
}

/** 敌人死亡：噪声+低频衰减 */
function createEnemyDieSound(ctx: AudioContext): AudioBuffer {
  const duration = 0.2;
  const buf = createBuffer(ctx, duration);
  const data = buf.getChannelData(0);
  writeNoise(data, 0.4);
  applyExpDecay(data, 0.15);
  // 叠加一点低频正弦
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    data[i] += Math.sin(2 * Math.PI * 120 * t) * 0.3 * Math.exp(-t * 15);
  }
  return buf;
}

/** 受伤：锯齿波短促尖音 */
function createHurtSound(ctx: AudioContext): AudioBuffer {
  const duration = 0.12;
  const buf = createBuffer(ctx, duration);
  const data = buf.getChannelData(0);
  writeSawtooth(data, 440, 0.4);
  applyEnvelope(data, 0.01, 0.11);
  return buf;
}

/** 拾取：两个明亮小音 */
function createPickupSound(ctx: AudioContext): AudioBuffer {
  const duration = 0.18;
  const buf = createBuffer(ctx, duration);
  const data = buf.getChannelData(0);
  const note1Frames = Math.floor(0.08 * SAMPLE_RATE);
  for (let i = 0; i < note1Frames; i++) {
    const t = i / SAMPLE_RATE;
    data[i] = Math.sin(2 * Math.PI * 880 * t) * 0.3 * (1 - t / 0.08);
  }
  for (let i = note1Frames; i < data.length; i++) {
    const t = (i - note1Frames) / SAMPLE_RATE;
    data[i] = Math.sin(2 * Math.PI * 1175 * t) * 0.3 * (1 - t / 0.08);
  }
  return buf;
}

/** 升级：琶音快速上升 */
function createLevelUpSound(ctx: AudioContext): AudioBuffer {
  const duration = 0.4;
  const buf = createBuffer(ctx, duration);
  const data = buf.getChannelData(0);
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  const noteDur = duration / notes.length;
  const noteFrames = Math.floor(noteDur * SAMPLE_RATE);

  for (let n = 0; n < notes.length; n++) {
    const start = n * noteFrames;
    const end = Math.min((n + 1) * noteFrames, data.length);
    for (let i = start; i < end; i++) {
      const local = i - start;
      const t = local / SAMPLE_RATE;
      const env = Math.max(0, 1 - t / (noteDur * 0.8));
      data[i] += Math.sin(2 * Math.PI * notes[n] * t) * 0.25 * env;
    }
  }
  return buf;
}
