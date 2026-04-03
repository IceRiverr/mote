#!/usr/bin/env node
/**
 * 代码导入工具 - 从 Markdown 文件恢复代码到本地
 * 使用: node import-code.mjs [输入文件] [选项]
 * 
 * 选项:
 *   --base-dir   指定基础目录 (默认: src)
 *   --dry-run    预览模式，显示将要修改的文件但不实际写入
 *   --backup     自动备份将被覆盖的原文件
 *   --yes, -y    跳过确认直接执行
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_INPUT = 'editor-code.md';
const DEFAULT_BASE_DIR = 'src';
const BACKUP_DIR = '.import-backups';

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT,
    baseDir: DEFAULT_BASE_DIR,
    dryRun: false,
    backup: false,
    yes: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--backup') {
      options.backup = true;
    } else if (arg === '--yes' || arg === '-y') {
      options.yes = true;
    } else if (arg === '--base-dir' && i + 1 < args.length) {
      options.baseDir = args[++i];
    } else if (!arg.startsWith('--') && !options.inputSet) {
      options.input = arg;
      options.inputSet = true;
    }
  }

  return options;
}

/**
 * 从 Markdown 解析文件块
 * 格式: ## 📄 filepath
 *       ```lang
 *       content
 *       ```
 */
function parseMarkdown(content) {
  const files = [];
  
  // 匹配文件块：## 📄 filepath 后跟代码块
  // 修复：使用正确的正则，匹配文件路径直到换行
  const pattern = /## 📄 ([^\n]+)\n[\s\S]*?```(?:\w+)?\n([\s\S]*?)```/g;
  let match;
  
  while ((match = pattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const fileContent = match[2];
    
    // 移除末尾可能多余的换行
    const trimmedContent = fileContent.replace(/\n+$/, '');
    
    files.push({
      path: filePath,
      content: trimmedContent
    });
  }
  
  return files;
}

/**
 * 检查文件是否存在并获取信息
 */
function getFileStatus(filePath) {
  const fullPath = path.resolve(filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { exists: false, fullPath };
  }
  
  const stat = fs.statSync(fullPath);
  const originalContent = fs.readFileSync(fullPath, 'utf-8');
  
  return {
    exists: true,
    fullPath,
    size: stat.size,
    mtime: stat.mtime,
    originalContent
  };
}

/**
 * 创建备份
 */
function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(BACKUP_DIR, timestamp);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDir, filePath.replace(/[\/]/g, '_'));
  
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * 统一路径分隔符（Windows/Linux兼容）
 */
function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

/**
 * 显示差异（简单版本）
 */
function showDiff(original, newContent) {
  const origLines = original.split('\n');
  const newLines = newContent.split('\n');
  const maxLines = Math.max(origLines.length, newLines.length);
  let changes = 0;
  
  for (let i = 0; i < Math.min(maxLines, 10); i++) {
    const orig = origLines[i] || '';
    const newL = newLines[i] || '';
    
    if (orig !== newL) {
      changes++;
      if (changes <= 5) {
        console.log(`     - ${i + 1}: ${orig.substring(0, 40)}...`);
        console.log(`     + ${i + 1}: ${newL.substring(0, 40)}...`);
      }
    }
  }
  
  if (changes > 5) {
    console.log(`     ... 还有 ${changes - 5} 处变更 ...`);
  }
  
  return changes;
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();
  
  console.log(`📥 代码导入工具`);
  console.log(`================\n`);
  
  // 检查输入文件
  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 错误: 输入文件不存在: ${options.input}`);
    console.log(`\n提示: 请指定正确的 Markdown 文件路径`);
    console.log(`   node import-code.mjs my-code.md`);
    process.exit(1);
  }
  
  console.log(`📄 输入文件: ${options.input}`);
  console.log(`📁 基础目录: ${options.baseDir}`);
  console.log(`📂 工作目录: ${process.cwd()}`);
  
  if (options.dryRun) {
    console.log(`\n🔍 预览模式 (不会实际修改文件)`);
  }
  if (options.backup) {
    console.log(`💾 自动备份已启用`);
  }
  console.log('');
  
  // 读取并解析 Markdown
  const content = fs.readFileSync(inputPath, 'utf-8');
  const files = parseMarkdown(content);
  
  if (files.length === 0) {
    console.error(`❌ 错误: 未在文件中找到有效的代码块`);
    console.log(`\n确保 Markdown 文件包含以下格式:`);
    console.log(`## 📄 src/App.tsx`);
    console.log('```tsx');
    console.log('// code here');
    console.log('```');
    process.exit(1);
  }
  
  console.log(`✅ 解析到 ${files.length} 个文件:\n`);
  
  // 分析每个文件的状态
  let newFiles = 0;
  let modifiedFiles = 0;
  let unchangedFiles = 0;
  
  for (const file of files) {
    // 将文件路径与基础目录组合
    const relativePath = normalizePath(path.join(options.baseDir, file.path));
    const status = getFileStatus(relativePath);
    
    file.relativePath = relativePath;
    file.fullPath = status.fullPath;
    file.exists = status.exists;
    
    if (!status.exists) {
      newFiles++;
      console.log(`🆕 ${relativePath} (新文件)`);
    } else {
      const changed = status.originalContent.trim() !== file.content.trim();
      if (changed) {
        modifiedFiles++;
        console.log(`✏️  ${relativePath} (已修改)`);
        showDiff(status.originalContent, file.content);
      } else {
        unchangedFiles++;
        console.log(`✅ ${relativePath} (无变化)`);
      }
    }
    console.log('');
  }
  
  // 汇总
  console.log(`📊 变更汇总:`);
  console.log(`   新文件: ${newFiles}`);
  console.log(`   已修改: ${modifiedFiles}`);
  console.log(`   无变化: ${unchangedFiles}`);
  console.log('');
  
  // 如果是 dry-run 模式，到此结束
  if (options.dryRun) {
    console.log(`🔍 预览模式完成，未写入任何文件`);
    console.log(`   使用普通模式执行修改:`);
    console.log(`   node import-code.mjs ${options.input} --base-dir ${options.baseDir}`);
    return;
  }
  
  // 确认操作
  if (!options.yes) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question(`⚠️  确认要写入 ${newFiles + modifiedFiles} 个文件吗? (y/N): `, resolve);
    });
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ 操作已取消');
      process.exit(0);
    }
  }
  
  console.log('\n📝 开始写入文件...\n');
  
  // 执行写入
  let successCount = 0;
  let errorCount = 0;
  
  for (const file of files) {
    try {
      // 如果需要备份且文件存在
      if (options.backup && file.exists) {
        const backupPath = createBackup(file.fullPath);
        console.log(`💾 备份: ${file.relativePath} → ${backupPath}`);
      }
      
      // 确保目录存在
      const dir = path.dirname(file.fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 创建目录: ${path.relative(process.cwd(), dir)}`);
      }
      
      // 写入文件
      fs.writeFileSync(file.fullPath, file.content, 'utf-8');
      
      const action = file.exists ? '更新' : '创建';
      console.log(`✅ ${action}: ${file.relativePath}`);
      successCount++;
      
    } catch (err) {
      console.error(`❌ 失败: ${file.relativePath} - ${err.message}`);
      errorCount++;
    }
  }
  
  console.log('\n================');
  console.log(`✅ 成功: ${successCount} 个文件`);
  if (errorCount > 0) {
    console.log(`❌ 失败: ${errorCount} 个文件`);
  }
  
  if (options.backup && (newFiles + modifiedFiles) > 0) {
    console.log(`\n💾 备份文件位于: ${BACKUP_DIR}/`);
  }
  
  console.log('\n🎉 导入完成!');
}

main().catch(err => {
  console.error(`❌ 错误: ${err.message}`);
  process.exit(1);
});
