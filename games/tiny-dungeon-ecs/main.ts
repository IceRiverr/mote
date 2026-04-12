// games/tiny-dungeon/main.ts
// ECS 架构入口

import { World, GameLoop } from '@mote/engine';
import { RenderPlugin, InputPlugin, PhysicsPlugin } from '@mote/engine';
import { GamePlugin } from './src/systems.js';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;

async function init(): Promise<void> {
  const world = new World();

  // 注册插件（注意顺序：PhysicsPlugin 必须在 GamePlugin 之前，因为 GamePlugin 依赖 Transform 等组件）
  await world.use(
    [RenderPlugin, { 
      canvas, 
      backend: 'auto',
      width: 640, 
      height: 480,
      autoResize: true,
    }],
    [InputPlugin, { canvas }],
    PhysicsPlugin,
    GamePlugin
  );

  statusEl.textContent = 'WASD 移动 · Space 攻击 · 碰药水拾取';

  // 使用引擎的 GameLoop
  const loop = new GameLoop(60);
  
  loop.onUpdate = (dt) => {
    world.update(dt);
  };
  
  // 渲染在 ECS 系统中处理，onRender 留空
  loop.onRender = () => {};

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
