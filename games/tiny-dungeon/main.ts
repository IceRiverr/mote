// games/tiny-dungeon/main.ts
// ECS 架构入口

import { App } from '@mote/engine';
import { RenderPlugin, InputPlugin, PhysicsPlugin } from '@mote/engine';
import { TinyDungeonPlugin } from './src/plugin.js';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

async function init(): Promise<void> {
  const app = new App();

  await app.addPlugins([
    new RenderPlugin({ canvas, width: 640, height: 480, autoResize: true }),
    new InputPlugin({ canvas }),
    PhysicsPlugin,
    new TinyDungeonPlugin(),
  ]);

  statusEl.textContent = 'WASD 移动 · Space 攻击 · 碰药水拾取';

  app.run();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
