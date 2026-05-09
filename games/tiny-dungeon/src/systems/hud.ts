// games/tiny-dungeon/src/systems/hud.ts
// Update: 同步玩家状态到 DOM HUD

import type { World, Commands } from '@mote/engine';
import { PlayerTag, Health, PlayerLevel } from '../components.js';
import { GameState } from '../resources.js';

let lastHp = -1;
let lastMax = -1;
let lastLv = -1;
let lastKills = -1;
let lastTimeStr = '';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function hudSystem(world: World, _dt: number, _cmd: Commands): void {
  const state = world.getResource<GameState>('GameState');
  if (!state) return;

  let hp = 0;
  let max = 0;
  let lv = 0;

  for (const eid of world.query(PlayerTag, Health, PlayerLevel)) {
    const h = world.get(eid, Health);
    const pl = world.get(eid, PlayerLevel);
    hp = h.current;
    max = h.max;
    lv = pl.level;
    break;
  }

  const kills = state.enemiesKilled;

  // 只有变化时才操作 DOM，减少开销
  if (hp !== lastHp || max !== lastMax) {
    const fill = document.getElementById('hp-fill') as HTMLDivElement | null;
    const text = document.getElementById('hp-text') as HTMLDivElement | null;
    if (fill && text) {
      const pct = max > 0 ? (hp / max) * 100 : 0;
      fill.style.width = `${Math.max(0, pct)}%`;

      // 根据血量比例变色
      if (pct > 60) fill.style.background = '#4caf50';
      else if (pct > 30) fill.style.background = '#ffc107';
      else fill.style.background = '#f44336';

      text.textContent = `${Math.max(0, hp)} / ${max}`;
    }
    lastHp = hp;
    lastMax = max;
  }

  if (lv !== lastLv) {
    const el = document.getElementById('hud-lv');
    if (el) el.textContent = String(lv);
    lastLv = lv;
  }

  if (kills !== lastKills) {
    const el = document.getElementById('hud-kills');
    if (el) el.textContent = String(kills);
    lastKills = kills;
  }

  const timeStr = formatTime(state.elapsedTime);
  if (timeStr !== lastTimeStr) {
    const el = document.getElementById('hud-time');
    if (el) el.textContent = timeStr;
    lastTimeStr = timeStr;
  }
}
