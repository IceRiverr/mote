// games/tiny-dungeon/main.ts
// ECS 架构入口

import { App } from '@mote/engine';
import { RenderPlugin, InputPlugin, PhysicsPlugin } from '@mote/engine';
import { TinyDungeonPlugin } from './src/plugin.js';
import { GameState } from './src/resources.js';
import { Weapon } from './src/components.js';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const panelEl = document.getElementById('levelup-panel') as HTMLDivElement;
const upgBtns = [
  document.getElementById('upg0') as HTMLButtonElement,
  document.getElementById('upg1') as HTMLButtonElement,
  document.getElementById('upg2') as HTMLButtonElement,
];

// 升级选项定义
interface UpgradeDef {
  label: string;
  desc: string;
  apply: (w: Weapon) => void;
}

const UPGRADES: UpgradeDef[] = [
  { label: '伤害 +20%', desc: '投射物造成更多伤害', apply: (w) => { w.damage = Math.floor(w.damage * 1.2); } },
  { label: '攻速 +15%', desc: '发射间隔缩短', apply: (w) => { w.cooldown *= 0.85; } },
  { label: '投射物 +1', desc: '每次多发射一枚', apply: (w) => { w.projectileCount++; } },
  { label: '穿透 +1', desc: '可穿透更多敌人', apply: (w) => { w.pierce++; } },
  { label: '射程 +30%', desc: '投射物飞得更远', apply: (w) => { w.range = Math.floor(w.range * 1.3); } },
  { label: '移速 +10%', desc: '移动更快', apply: (_w) => { /* 需要修改 MOVE_PER_TICK，暂不实现 */ } },
];

function getRandomUpgrades(count: number): UpgradeDef[] {
  const pool = [...UPGRADES];
  const result: UpgradeDef[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

function showLevelUpPanel(world: App['world']) {
  const state = world.getResource<GameState>('GameState');
  if (!state) return;
  state.paused = true;

  const options = getRandomUpgrades(3);

  for (let i = 0; i < 3; i++) {
    const btn = upgBtns[i];
    const opt = options[i];
    if (!opt) {
      btn.style.display = 'none';
      continue;
    }
    btn.style.display = 'block';
    btn.querySelector('.label')!.textContent = opt.label;
    btn.querySelector('.desc')!.textContent = opt.desc;

    // 移除旧监听器（简单替换）
    const newBtn = btn.cloneNode(true) as HTMLButtonElement;
    btn.parentNode!.replaceChild(newBtn, btn);
    upgBtns[i] = newBtn;

    newBtn.addEventListener('click', () => {
      // 应用升级
      for (const eid of world.query(Weapon)) {
        const w = world.get(eid, Weapon);
        opt.apply(w);
      }
      state.paused = false;
      panelEl.classList.remove('active');
    });
  }

  panelEl.classList.add('active');
}

async function init(): Promise<void> {
  const app = new App({ fixedHz: 60 });

  await app.addPlugins([
    new RenderPlugin({ canvas, width: window.innerWidth, height: window.innerHeight, autoResize: true }),
    new InputPlugin({ canvas }),
    PhysicsPlugin,
    new TinyDungeonPlugin(),
  ]);

  statusEl.textContent = 'WASD 移动 · 敌人不断涌现 · 存活下去';

  // 监听升级事件
  app.world.on('levelup', () => {
    showLevelUpPanel(app.world);
  });

  app.run();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
