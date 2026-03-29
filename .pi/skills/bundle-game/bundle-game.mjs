#!/usr/bin/env node
/**
 * Bundle Game Skill
 * 将指定游戏打包成单个独立 HTML 文件
 *
 * 用法:
 *   node .pi/skills/bundle-game/bundle-game.mjs <game-name>
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const SKILLS_DIR = path.join(ROOT, '.pi/skills/bundle-game');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 获取可用游戏列表
function getAvailableGames() {
  const gamesDir = path.join(ROOT, 'games');
  if (!fs.existsSync(gamesDir)) return [];
  
  return fs.readdirSync(gamesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => {
      // 检查是否有 main.ts 或 main.js
      const hasMain = fs.existsSync(path.join(gamesDir, name, 'main.ts')) ||
                      fs.existsSync(path.join(gamesDir, name, 'main.js'));
      return hasMain;
    });
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  let gameName = args[0];

  // 如果没有提供游戏名，显示列表让用户选择
  const availableGames = getAvailableGames();
  
  if (!gameName) {
    if (availableGames.length === 0) {
      log('❌ 没有找到可打包的游戏', 'red');
      process.exit(1);
    }

    log('\n📦 可用游戏:', 'cyan');
    availableGames.forEach((game, i) => {
      log(`  ${i + 1}. ${game}`, 'blue');
    });
    log('\n用法: 打包游戏 <游戏名>', 'yellow');
    log('例如: 打包游戏 snake\n', 'green');
    process.exit(0);
  }

  // 验证游戏是否存在
  if (!availableGames.includes(gameName)) {
    log(`❌ 游戏 "${gameName}" 不存在`, 'red');
    log('\n可用游戏:', 'cyan');
    availableGames.forEach(game => log(`  • ${game}`, 'blue'));
    process.exit(1);
  }

  log(`\n🎮 开始打包游戏: ${gameName}`, 'cyan');
  log('─'.repeat(40), 'reset');

  // 步骤1: 构建
  log('\n📋 步骤 1/3: 构建项目...', 'yellow');
  try {
    execSync('npm run build', {
      cwd: ROOT,
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    log('✅ 构建完成', 'green');
  } catch (e) {
    log('❌ 构建失败', 'red');
    process.exit(1);
  }

  // 步骤2: 检查 dist 目录
  const distGameDir = path.join(ROOT, 'dist/games', gameName);
  if (!fs.existsSync(distGameDir)) {
    log(`❌ 构建输出不存在: ${distGameDir}`, 'red');
    log('请检查游戏是否配置正确', 'yellow');
    process.exit(1);
  }

  // 步骤3: 打包
  log('\n📋 步骤 2/3: 打包成单页 HTML...', 'yellow');
  const outPath = path.join(ROOT, `${gameName}-standalone.html`);
  
  try {
    const bundleScript = path.join(ROOT, 'scripts/bundle-html.mjs');
    execSync(`node "${bundleScript}" "${gameName}" --out "${outPath}"`, {
      cwd: ROOT,
      stdio: 'inherit',
      encoding: 'utf-8'
    });
  } catch (e) {
    log('❌ 打包失败', 'red');
    process.exit(1);
  }

  // 步骤4: 显示结果
  log('\n📋 步骤 3/3: 完成！', 'yellow');
  
  if (fs.existsSync(outPath)) {
    const stats = fs.statSync(outPath);
    const sizeKB = Math.round(stats.size / 1024);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    log('\n' + '═'.repeat(40), 'green');
    log('✅ 打包成功！', 'green');
    log('═'.repeat(40), 'green');
    log(`\n📄 文件: ${outPath}`, 'cyan');
    log(`📊 大小: ${sizeKB} KB (${sizeMB} MB)`, 'cyan');
    log(`\n🚀 使用方式:`, 'yellow');
    log(`   • 双击打开`, 'blue');
    log(`   • 拖拽到浏览器`, 'blue');
    log(`   • 发给朋友离线玩`, 'blue');
    log('\n💡 提示: 文件包含所有资源，可直接离线运行\n', 'reset');
  } else {
    log('❌ 输出文件未生成', 'red');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
