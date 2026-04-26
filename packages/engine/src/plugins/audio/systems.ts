// engine/src/plugins/audio/systems.ts
// 音频系统

import type { World } from '../../core/world.js';
import { AudioEmitter, BGMPlayer } from './components.js';
import { AudioManager, type PlayOptions } from './plugin.js';

/** 处理 AudioEmitter 组件 */
export function audioEmitterSystem(world: World, _dt: number): void {
  const audio = world.getResource<AudioManager>('audio');
  if (!audio) return;

  let listenerX = 0;
  let listenerY = 0;

  for (const eid of world.query(AudioEmitter)) {
    const emitter = world.get(eid, AudioEmitter);

    if (emitter.autoPlay) {
      const options: PlayOptions = {
        volume: emitter.volume,
        pitch: emitter.pitch,
        loop: emitter.loop,
      };

      if (emitter.maxDistance !== undefined) {
        const dx = emitter.x - listenerX;
        const dy = emitter.y - listenerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < emitter.maxDistance) {
          if (options.volume !== undefined) options.volume *= 1 - dist / emitter.maxDistance;
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
export function bgmPlayerSystem(world: World, _dt: number): void {
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
