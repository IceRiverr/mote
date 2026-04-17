// ═══════════════════════════════════════════════════════════════
// fs.test.ts - 文件系统测试（在浏览器控制台运行）
// 
// 用法：
// 1. 在浏览器中打开 Editor
// 2. 打开控制台
// 3. 粘贴并运行以下代码
// ═══════════════════════════════════════════════════════════════

import { FileSystem, PrefabFS, SceneFS, getFileSystem, getPrefabFS, getSceneFS } from './index';
import { createPrefab } from '../data/Prefab';
import { createScene } from '../data/Scene';

/**
 * 测试文件系统
 */
export async function testFileSystem(): Promise<void> {
  console.log('🧪 Testing File System...');

  // 1. 创建文件系统实例
  const fs = getFileSystem();
  console.log('FileSystem mode:', fs.getMode());

  // 2. 测试目录操作
  console.log('Creating directories...');
  await fs.createDirectory('test/nested/dir');

  // 3. 测试文件写入
  console.log('Writing file...');
  const testContent = JSON.stringify({ test: true, timestamp: Date.now() }, null, 2);
  const writeSuccess = await fs.writeFile('test/nested/dir/sample.json', testContent);
  console.log('Write success:', writeSuccess);

  // 4. 测试文件读取
  console.log('Reading file...');
  const readContent = await fs.readFile('test/nested/dir/sample.json');
  console.log('Read content:', readContent);

  // 5. 测试文件存在性
  console.log('Checking existence...');
  const exists = await fs.exists('test/nested/dir/sample.json');
  console.log('File exists:', exists);

  // 6. 列出目录
  console.log('Listing directory...');
  for await (const entry of fs.listDirectory('test')) {
    console.log('  -', entry.name, `(${entry.kind})`);
  }

  // 7. 清理
  console.log('Cleaning up...');
  await fs.remove('test', true);

  console.log('✅ File System test completed');
}

/**
 * 测试 PrefabFS
 */
export async function testPrefabFS(): Promise<void> {
  console.log('🧪 Testing PrefabFS...');

  const prefabFS = getPrefabFS();
  prefabFS.setAssetsDir('test-assets');
  
  // 初始化
  await prefabFS.initialize();
  console.log('PrefabFS initialized');

  // 创建测试 Prefab
  const prefab = createPrefab(
    'test_grass',
    '测试草地',
    ['environment'],
    {
      Transform: { x: 0, y: 0 },
      Sprite: { atlas: 'sprites/terrain.mote-sprite.json', frame: 'grass_01' },
    }
  );

  const path = 'environment/test_grass.mote-prefab.json';

  // 保存
  console.log('Saving prefab to', path);
  const saveSuccess = await prefabFS.save(prefab, path);
  console.log('Save success:', saveSuccess);

  // 读取（通过路径）
  console.log('Loading prefab from path...');
  const loadedByPath = await prefabFS.loadFromPath(path);
  console.log('Loaded by path:', loadedByPath);

  // 读取（通过 ID，降级）
  console.log('Loading prefab by id...');
  const loadedById = await prefabFS.load('test_grass');
  console.log('Loaded by id:', loadedById);

  // 获取所有路径
  console.log('All paths:', prefabFS.getAllPaths());

  // 清理
  console.log('Cleaning up...');
  await prefabFS.delete(path);

  console.log('✅ PrefabFS test completed');
}

/**
 * 测试 SceneFS
 */
export async function testSceneFS(): Promise<void> {
  console.log('🧪 Testing SceneFS...');

  const sceneFS = getSceneFS();
  sceneFS.setAssetsDir('test-assets');
  
  // 初始化
  await sceneFS.initialize();
  console.log('SceneFS initialized');

  // 创建场景
  console.log('Creating scene...');
  const scene = await sceneFS.create('test_level', '测试关卡', 800, 600, 'scenes/test_level.mote-scene.json');
  console.log('Created scene:', scene);

  // 设置当前场景
  if (scene?.path) {
    sceneFS.setCurrent(scene.path);
  }

  // 获取所有场景
  console.log('All scenes:', sceneFS.getAllMeta());

  // 导出 ECS 格式
  if (scene?.path) {
    console.log('Exporting for ECS...');
    const ecsData = await sceneFS.exportForECS(scene.path);
    console.log('ECS data:', ecsData);
  }

  // 清理
  if (scene?.path) {
    console.log('Cleaning up...');
    await sceneFS.delete(scene.path);
  }

  console.log('✅ SceneFS test completed');
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('              File System Test Suite');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    await testFileSystem();
    console.log('');
    await testPrefabFS();
    console.log('');
    await testSceneFS();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('              ✅ All tests passed!');
    console.log('═══════════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

// 导出到全局（便于控制台测试）
if (typeof window !== 'undefined') {
  (window as any).fsTest = {
    testFileSystem,
    testPrefabFS,
    testSceneFS,
    runAllTests,
    // 导出类
    FileSystem,
    PrefabFS,
    SceneFS,
    // 导出 getter
    getFileSystem,
    getPrefabFS,
    getSceneFS,
  };
}
