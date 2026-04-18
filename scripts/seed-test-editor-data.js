/**
 * 为编辑器测试创建本地测试项目目录
 * 用法: node scripts/seed-test-editor-data.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', 'test-editor-project');
const assetsDir = path.join(rootDir, 'assets');

// 1x1 透明 PNG 的 base64（用于测试图片/Sprite）
const TRANSPARENT_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 16x16 纯色红块 PNG base64
const RED_16X16_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVR42u3OMQ0AAAgDsPlX4wCdpeCjqaZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmY2YwNuvwWn8ZdR8AAAAABJRU5ErkJggg==';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── 创建目录 ──
ensureDir(assetsDir);

// ── 项目文件 ──
writeJson(path.join(rootDir, 'test-project.mote-project.json'), {
  id: 'test_project',
  name: 'Test Project',
  version: '1.0.0',
  assetsDir: 'assets',
  settings: {
    gridSize: 32,
    snapToGrid: true,
  },
  createdAt: new Date().toISOString(),
  modifiedAt: new Date().toISOString(),
});

// ── Prefab: Player ──
writeJson(path.join(assetsDir, 'player.mote-prefab.json'), {
  type: 'mote-prefab',
  version: '1.0.0',
  id: 'player',
  name: 'Player',
  tags: ['characters'],
  components: {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Sprite: {
      atlas: 'assets/player.png',
      frame: 'default',
      layer: 30,
      tint: '#ffffff',
      flipX: false,
      flipY: false,
      alpha: 1,
      visible: true,
    },
    Collider: {
      shapes: [{ type: 'rect', x: 0, y: 0, w: 16, h: 16 }],
      isTrigger: false,
      material: 'default',
      layer: 1,
      mask: 0xffffffff,
    },
  },
});

// ── Prefab: Enemy ──
writeJson(path.join(assetsDir, 'enemy.mote-prefab.json'), {
  type: 'mote-prefab',
  version: '1.0.0',
  id: 'enemy',
  name: 'Enemy',
  tags: ['characters'],
  components: {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Sprite: {
      atlas: 'assets/enemy.png',
      frame: 'default',
      layer: 30,
      tint: '#ff4444',
      visible: true,
    },
  },
});

// ── Prefab: Wall ──
writeJson(path.join(assetsDir, 'wall.mote-prefab.json'), {
  type: 'mote-prefab',
  version: '1.0.0',
  id: 'wall',
  name: 'Wall',
  tags: ['walls'],
  components: {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Sprite: {
      atlas: 'assets/wall.png',
      frame: 'default',
      layer: 20,
      tint: '#8b7355',
      visible: true,
    },
    Collider: {
      shapes: [{ type: 'rect', x: 0, y: 0, w: 32, h: 32 }],
      isTrigger: false,
      material: 'default',
      layer: 1,
      mask: 0xffffffff,
    },
  },
});

// ── Prefab: Tree (environment) ──
writeJson(path.join(assetsDir, 'tree.mote-prefab.json'), {
  type: 'mote-prefab',
  version: '1.0.0',
  id: 'tree',
  name: 'Tree',
  tags: ['environment'],
  components: {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Sprite: {
      atlas: 'assets/tree.png',
      frame: 'default',
      layer: 10,
      tint: '#4a7c59',
      visible: true,
    },
  },
});

// ── Scene: level1 ──
writeJson(path.join(assetsDir, 'level1.mote-scene.json'), {
  id: 'level1',
  name: 'Level 1',
  path: 'assets/level1.mote-scene.json',
  width: 640,
  height: 480,
  grid: { enabled: true, size: 32, snap: true, color: 'rgba(255,255,255,0.2)' },
  entities: [
    {
      id: 'e_1',
      prefab: 'assets/player.mote-prefab.json',
      overrides: { Transform: { x: 320, y: 240 } },
    },
    {
      id: 'e_2',
      prefab: 'assets/wall.mote-prefab.json',
      overrides: { Transform: { x: 100, y: 100 } },
    },
    {
      id: 'e_3',
      prefab: 'assets/enemy.mote-prefab.json',
      overrides: { Transform: { x: 500, y: 200 } },
    },
  ],
});

// ── Sprite Sheet: player ──
writeJson(path.join(assetsDir, 'player.mote-sprite.json'), {
  type: 'mote-sprite',
  version: '1.0.0',
  id: 'player_sprite',
  name: 'Player Sprite',
  image: 'assets/player.png',
  imageWidth: 16,
  imageHeight: 16,
  frames: {
    idle_0: {
      x: 0,
      y: 0,
      w: 16,
      h: 16,
      tags: ['idle'],
    },
    walk_0: {
      x: 0,
      y: 0,
      w: 16,
      h: 16,
      tags: ['walk'],
    },
  },
  animations: {},
});

// ── 图片文件 ──
fs.writeFileSync(path.join(assetsDir, 'player.png'), Buffer.from(RED_16X16_PNG_BASE64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'enemy.png'), Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'wall.png'), Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'tree.png'), Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));

console.log(`✅ 测试数据已创建: ${rootDir}`);
console.log('📁 目录结构:');
console.log(`  ${rootDir}`);
console.log(`  ├── test-project.mote-project.json`);
console.log(`  └── assets/`);
console.log(`      ├── player.mote-prefab.json`);
console.log(`      ├── enemy.mote-prefab.json`);
console.log(`      ├── wall.mote-prefab.json`);
console.log(`      ├── tree.mote-prefab.json`);
console.log(`      ├── level1.mote-scene.json`);
console.log(`      ├── player.mote-sprite.json`);
console.log(`      ├── player.png`);
console.log(`      ├── enemy.png`);
console.log(`      ├── wall.png`);
console.log(`      └── tree.png`);
console.log('');
console.log('🚀 测试步骤:');
console.log('  1. npm run dev 启动编辑器');
console.log('  2. 浏览器中 MenuBar → 文件 → 打开项目');
console.log('  3. 选择 test-editor-project 目录');
console.log('  4. 在 Content Browser 中测试双击/右键交互');
