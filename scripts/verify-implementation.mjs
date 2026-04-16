/**
 * 验证 mote 文件夹结构重构实现
 */

import { validateAssetPath, resolveAssetPath } from '../packages/engine/src/core/path.ts';
import { assetLoaders } from '../packages/engine/src/core/loader.ts';
import '../packages/engine/src/core/json-loader.ts';
import { AssetManager } from '../packages/engine/src/core/asset-manager.ts';
import { sceneToJson, sceneFromJson, prefabToJson, prefabFromJson } from '../packages/editor/src/data/io.ts';
import { createSceneEntity, getEntityTransform } from '../packages/editor/src/data/Scene.ts';
import { createPrefab } from '../packages/editor/src/data/Prefab.ts';
import fs from 'fs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

// ── Path validation tests ──
test('validateAssetPath accepts valid path', () => {
  if (validateAssetPath('sprites/hero.png') !== null) throw new Error('should be null');
});

test('validateAssetPath rejects ../', () => {
  if (validateAssetPath('../bad.png') === null) throw new Error('should reject');
});

test('resolveAssetPath joins correctly', () => {
  const result = resolveAssetPath('games/aa/assets', 'sprites/hero.png');
  if (result !== 'games/aa/assets/sprites/hero.png') throw new Error(result);
});

// ── Loader / AssetManager tests ──
test('assetLoaders can get loader by extension', () => {
  const loader = assetLoaders.get('.json');
  if (!loader) throw new Error('json loader not found');
  if (loader.type !== 'json') throw new Error('wrong type');
});

test('AssetManager instantiates', () => {
  const am = new AssetManager('assets');
  if (!am) throw new Error('failed to instantiate');
});

// ── Scene serialization tests ──
test('sceneToJson puts transform into overrides', () => {
  const entity = createSceneEntity('prefabs/hero.mote-prefab.json', 100, 200, { rotation: 45 });
  const scene = {
    id: 'test-scene',
    name: 'Test',
    width: 640,
    height: 480,
    grid: { enabled: true, size: 32, snap: true },
    entities: [entity],
  };
  const json = sceneToJson(scene);
  const e = json.entities[0];
  if (e.x !== undefined) throw new Error('x should not be top-level');
  if (e.y !== undefined) throw new Error('y should not be top-level');
  if (e.overrides?.Transform?.x !== 100) throw new Error('x missing in overrides');
  if (e.overrides?.Transform?.y !== 200) throw new Error('y missing in overrides');
  if (e.overrides?.Transform?.rotation !== 45) throw new Error('rotation missing');
});

test('sceneFromJson restores transform from overrides', () => {
  const json = {
    type: 'mote-scene',
    version: '1.0.0',
    id: 'test',
    name: 'Test',
    width: 640,
    height: 480,
    grid: { enabled: true, size: 32, snap: true, color: '#fff' },
    entities: [
      {
        id: 'e1',
        prefab: 'prefabs/hero.mote-prefab.json',
        parent: null,
        overrides: { Transform: { x: 10, y: 20, scaleX: 2 } },
      },
    ],
  };
  const scene = sceneFromJson(json);
  const t = getEntityTransform(scene.entities[0]);
  if (t.x !== 10 || t.y !== 20 || t.scaleX !== 2 || t.scaleY !== 1) {
    throw new Error(`transform mismatch: ${JSON.stringify(t)}`);
  }
});

// ── Prefab serialization tests ──
test('prefabToJson uses tags instead of category', () => {
  const prefab = createPrefab('p1', 'Hero', ['characters', 'player'], {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  });
  const json = prefabToJson(prefab);
  if (json.category !== undefined) throw new Error('category should not exist');
  if (JSON.stringify(json.tags) !== '["characters","player"]') throw new Error('tags mismatch');
});

test('prefabFromJson validates atlas path', () => {
  const json = {
    type: 'mote-prefab',
    version: '1.0.0',
    id: 'p1',
    name: 'Hero',
    tags: ['env'],
    components: {
      Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      Sprite: { atlas: '../bad.png', frame: 'f1' },
    },
  };
  try {
    prefabFromJson(json);
    throw new Error('should have thrown');
  } catch (e) {
    if (!e.message.includes('Invalid atlas path')) throw new Error(`wrong error: ${e.message}`);
  }
});

// ── project.json format test ──
test('games/aa/project.json matches new format', () => {
  const raw = fs.readFileSync('games/aa/project.json', 'utf-8');
  const json = JSON.parse(raw);
  if (!json.assetsDir) throw new Error('missing assetsDir');
  if (!json.srcDir) throw new Error('missing srcDir');
  if (json.entryScript !== 'main.ts') throw new Error('entryScript mismatch');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
