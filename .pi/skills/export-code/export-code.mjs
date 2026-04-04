#!/usr/bin/env node
/**
 * Export Code Skill - 将项目源代码合并导出为 Markdown 文件
 * 供 AI 分析使用
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
function getOutputFileName(targetDir) {
  // 获取最后一级文件夹名
  const folderName = path.basename(targetDir);
  return `${folderName}-code-export.md`;
}

// 排除的文件和目录
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /dist/,
  /\.git/,
  /\.vscode/,
  /export-code\.m?js/,
  /\.txt$/,
  /\.md$/,              // 排除已导出的 markdown
  /package-lock\.json/,
  /\.DS_Store/,
  /Thumbs\.db/
];

// 要包含的文件扩展名
const INCLUDE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.css', '.scss', '.less',
  '.json', '.html'
];

// 文件扩展名到 Markdown 代码块语言的映射
const EXT_TO_LANG = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.html': 'html'
};

/**
 * 检查是否应该排除该路径
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * 检查是否应该包含该文件
 */
function shouldInclude(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return INCLUDE_EXTENSIONS.includes(ext);
}

/**
 * 递归获取所有文件
 */
function getAllFiles(dir, baseDir = dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (shouldExclude(fullPath) || shouldExclude(relativePath)) {
      continue;
    }

    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, baseDir, files);
    } else if (stat.isFile() && shouldInclude(fullPath)) {
      files.push({
        fullPath,
        relativePath
      });
    }
  }

  return files;
}

/**
 * 获取文件对应的 Markdown 代码块语言
 */
function getMarkdownLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_LANG[ext] || 'text';
}

/**
 * 生成文件清单（树形结构）
 */
function generateFileTree(files) {
  const tree = {};
  
  // 构建树形结构
  for (const file of files) {
    const parts = file.relativePath.split('/');
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      
      if (isFile) {
        current[part] = null;
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  // 渲染树形结构
  function renderTree(node, prefix = '', isLast = true) {
    const entries = Object.entries(node);
    let result = '';
    
    entries.forEach(([name, children], index) => {
      const isLastItem = index === entries.length - 1;
      const connector = isLastItem ? '└── ' : '├── ';
      
      if (children === null) {
        result += `${prefix}${connector}${name}\n`;
      } else {
        result += `${prefix}${connector}${name}/\n`;
        const newPrefix = prefix + (isLastItem ? '    ' : '│   ');
        result += renderTree(children, newPrefix, isLastItem);
      }
    });
    
    return result;
  }

  return renderTree(tree);
}

/**
 * 读取文件并格式化为 Markdown
 */
function readFileAsMarkdown(fileInfo) {
  const { fullPath, relativePath } = fileInfo;
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lang = getMarkdownLang(fullPath);

  return `## 📄 ${relativePath}

\`\`\`${lang}
${content}
\`\`\`
`;
}

/**
 * 主函数
 */
function main() {
  // 解析参数: [目标目录]
  const targetDir = process.argv[2] || './src';
  
  const targetPath = path.resolve(targetDir);

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ 错误: 目标目录不存在: ${targetPath}`);
    process.exit(1);
  }

  // 确定输出文件路径：放在目标目录的根目录下，文件名包含文件夹名
  const outputFile = path.join(targetPath, getOutputFileName(targetPath));

  console.log(`🔍 扫描目录: ${targetPath}`);

  // 获取所有文件
  const files = getAllFiles(targetPath);

  if (files.length === 0) {
    console.warn('⚠️ 没有找到符合条件的文件');
    process.exit(0);
  }

  // 按路径排序
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  console.log(`📁 找到 ${files.length} 个文件`);

  const timestamp = new Date().toISOString();
  const fileTree = generateFileTree(files);

  // 构建 Markdown 内容
  let output = `<!--
================================================================================
CODE EXPORT - Markdown Format
================================================================================
Generated: ${timestamp}
Total Files: ${files.length}
Source Directory: ${targetDir}
================================================================================
-->

# 📦 Code Export

> 导出时间: \`${timestamp}\`
> 文件数量: \`${files.length}\` 个
> 源目录: \`${targetDir}\`

---

## 📁 文件清单

\`\`\`
${targetDir}/
${fileTree}\`\`\`

---

## 📋 文件详情

`;

  // 添加快速导航索引
  output += `### 快速导航\n\n`;
  for (const file of files) {
    const anchor = file.relativePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    output += `- [${file.relativePath}](#${anchor})\n`;
  }
  output += `\n---\n\n`;

  // 添加每个文件的内容
  for (const file of files) {
    output += readFileAsMarkdown(file);
    output += '\n';
  }

  // 添加页脚
  output += `---\n\n*文件由 export-code skill 自动生成*\n`;

  // 写入文件
  fs.writeFileSync(outputFile, output, 'utf-8');

  // 统计信息
  const stats = fs.statSync(outputFile);
  const sizeKB = (stats.size / 1024).toFixed(2);

  console.log(`\n✅ 导出完成!`);
  console.log(`   文件: ${path.relative(process.cwd(), outputFile)}`);
  console.log(`   大小: ${sizeKB} KB`);
  console.log(`   行数: ${output.split('\n').length}`);
}

main();
