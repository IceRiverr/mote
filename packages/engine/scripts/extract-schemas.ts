#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════
// extract-schemas.ts - 从组件 JSDoc 提取 Schema
//
// 扫描目标：
//   - packages/engine/src/plugins/**/components.ts
//   - packages/engine/src/plugins/**/types.ts
//   - games/**/src/components.ts
//
// 用法: tsx scripts/extract-schemas.ts
// 输出: ../../editor/public/component-schemas.json
// ═══════════════════════════════════════════════════════════════

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

import type { ComponentSchema, PropertySchema, PropType } from '../src/core/schema.js';

// ═══════════════════════════════════════════════════════════════
// JSDoc 解析工具
// ═══════════════════════════════════════════════════════════════

/**
 * 解析属性默认值（从初始化表达式）
 */
function getDefaultValueFromInitializer(node: ts.PropertyDeclaration, type: string): any {
  if (!node.initializer) return undefined;

  const text = node.initializer.getText();

  // 处理 new Set() / new Map() / new Color()
  if (/^new\s+/.test(text)) {
    if (text.startsWith('new Set')) return [];
    if (text.startsWith('new Map')) return {};
    if (text.startsWith('new Color')) {
      // Color.white() / Color.fromHex('#87CEEB')
      const hexMatch = text.match(/fromHex\(['"]([^'"]+)['"]\)/);
      if (hexMatch) return hexMatch[1];
      return '#ffffff';
    }
    return undefined;
  }

  // 处理数组字面量
  if (text.startsWith('[')) {
    try {
      return JSON.parse(text.replace(/'/g, '"'));
    } catch {
      return [];
    }
  }

  // 处理数字
  if (type === 'number') {
    const num = parseFloat(text);
    return isNaN(num) ? undefined : num;
  }

  // 处理布尔值
  if (type === 'boolean') {
    return text === 'true';
  }

  // 处理字符串（去除引号）
  if (type === 'string' || type === 'color' || type === 'asset') {
    return text.replace(/^["']|["']$/g, '');
  }

  // 其他类型，尝试 JSON 解析
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 解析 JSDoc 标签
 */
function parseJSDocTags(jsDocTags: ts.JSDocTagInfo[]): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const tag of jsDocTags) {
    tags[tag.name] = tag.text?.[0].text || '';
  }
  return tags;
}

/**
 * 从类型推断 schema type
 */
function inferTypeFromNode(node: ts.PropertyDeclaration | ts.ParameterDeclaration, typeChecker: ts.TypeChecker): PropType {
  const type = typeChecker.getTypeAtLocation(node);
  const typeString = typeChecker.typeToString(type);

  // 数组类型
  if (typeString === 'string[]') return 'string[]';
  if (typeString === 'number[]') return 'number[]';

  // 映射到 schema 类型
  const typeMap: Record<string, PropType> = {
    'number': 'number',
    'string': 'string',
    'boolean': 'boolean',
    'Color': 'color',
  };

  return typeMap[typeString] || 'string';
}

/**
 * 解析 JSDoc 中 @default 标签的值
 */
function parseDefaultValue(text: string, type: string): any {
  if (text === undefined || text === '') return undefined;

  try {
    switch (type) {
      case 'number':
        return parseFloat(text);
      case 'boolean':
        return text === 'true';
      case 'string':
      case 'color':
      case 'asset':
        return text.replace(/^["']|["']$/g, '');  // 去除引号
      default:
        // 尝试解析为 JSON
        return JSON.parse(text);
    }
  } catch {
    return text;
  }
}

/**
 * 解析约束
 */
function parseConstraints(tags: Record<string, string>): PropertySchema['constraints'] {
  const constraints: PropertySchema['constraints'] = {};
  
  if (tags['range']) {
    const match = tags['range'].match(/\[\s*([^,]+),\s*([^\]]+)\s*\]/);
    if (match) {
      constraints.min = parseFloat(match[1]);
      constraints.max = parseFloat(match[2]);
    }
  }
  
  if (tags['step']) {
    constraints.step = parseFloat(tags['step']);
  }
  
  if (tags['options']) {
    try {
      constraints.options = JSON.parse(tags['options']);
    } catch {
      // 解析失败，忽略
    }
  }
  
  if (tags['nullable'] === 'true') {
    constraints.nullable = true;
  }
  
  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

// ═══════════════════════════════════════════════════════════════
// 主提取逻辑
// ═══════════════════════════════════════════════════════════════

function extractComponentSchemas(
  sourceFile: ts.SourceFile,
  typeChecker: ts.TypeChecker,
  category?: string
): ComponentSchema[] {
  const schemas: ComponentSchema[] = [];

  function visit(node: ts.Node) {
    // 查找 ClassDeclaration
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;

      // 跳过非组件类：如果没有 JSDoc 且属性少于 1 个，可能是内部工具类
      const classJsDoc = ts.getJSDocCommentsAndTags(node);
      const classTags = parseJSDocTags(classJsDoc.flatMap(d => ts.isJSDoc(d) ? d.tags || [] : []));

      // 如果标记了 @mote-internal，跳过整个类
      if (classTags['mote-internal'] === 'true') return;

      const properties: Record<string, PropertySchema> = {};
      let editable = true;

      // 遍历类成员
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && member.name) {
          const propName = member.name.getText(sourceFile);

          // 跳过私有属性（以下划线开头）
          if (propName.startsWith('_')) continue;

          // 获取属性的 JSDoc
          const propJsDoc = ts.getJSDocCommentsAndTags(member);
          const propTags = parseJSDocTags(propJsDoc.flatMap(d => ts.isJSDoc(d) ? d.tags || [] : []));

          // 如果标记了 @mote-internal，跳过
          if (propTags['mote-internal'] === 'true') continue;

          // 获取描述
          let description: string | undefined;
          const rawComment = propJsDoc
            .filter((d): d is ts.JSDoc => ts.isJSDoc(d))
            .map(d => d.comment)
            .filter((c): c is string => typeof c === 'string')[0];
          if (rawComment) {
            // 去掉 JSDoc 标签行，保留纯描述
            description = rawComment.replace(/\s*@\w+\s+.*$/gm, '').trim();
          }

          // 推断类型
          let type = inferTypeFromNode(member, typeChecker);

          // 检查是否有 @mote-type 覆盖
          if (propTags['mote-type']) {
            const mapped = propTags['mote-type'] as PropType;
            type = mapped;
          }

          // 解析默认值（优先从 JSDoc @default，其次从初始化表达式）
          let defaultValue: any;
          if (propTags['default'] !== undefined) {
            defaultValue = parseDefaultValue(propTags['default'], type);
          } else {
            defaultValue = getDefaultValueFromInitializer(member, type);
          }

          // 解析约束
          const constraints = parseConstraints(propTags);

          properties[propName] = {
            type,
            default: defaultValue,
            label: propTags['mote-label'] || propName,
            description,
            constraints,
          };
        }
      }

      // 获取类的描述
      let classDescription: string | undefined;
      const rawClassComment = classJsDoc
        .filter((d): d is ts.JSDoc => ts.isJSDoc(d))
        .map(d => d.comment)
        .filter((c): c is string => typeof c === 'string')[0];
      if (rawClassComment) {
        classDescription = rawClassComment.replace(/\s*@\w+\s+.*$/gm, '').trim();
      }

      // 检查类是否标记为不可编辑
      if (classTags['mote-editable'] === 'false') {
        editable = false;
      }

      // 只添加有属性的组件，或者标记为组件的空类（如 Tag）
      if (Object.keys(properties).length > 0 || classTags['mote-component'] !== undefined) {
        schemas.push({
          name: className,
          displayName: classTags['mote-displayName'] || className,
          description: classDescription,
          properties,
          icon: classTags['mote-icon'],
          editable,
          category,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return schemas;
}

// ═══════════════════════════════════════════════════════════════
// 文件扫描
// ═══════════════════════════════════════════════════════════════

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, pattern));
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// 入口
// ═══════════════════════════════════════════════════════════════

function main() {
  const engineRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(engineRoot, '../..');
  const outputPath = path.join(projectRoot, 'editor/public/component-schemas.json');

  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ── 收集扫描目标 ──
  const scanTargets: Array<{ files: string[]; category?: string }> = [];

  // 1. engine plugins
  const enginePluginsDir = path.join(engineRoot, 'src/plugins');
  const engineFiles = findFiles(enginePluginsDir, /^(components|types)\.ts$/);
  if (engineFiles.length > 0) {
    scanTargets.push({ files: engineFiles, category: 'engine' });
  }

  // 2. games
  const gamesDir = path.join(projectRoot, 'games');
  const gameEntries = fs.existsSync(gamesDir) ? fs.readdirSync(gamesDir, { withFileTypes: true }) : [];
  for (const entry of gameEntries) {
    if (!entry.isDirectory()) continue;
    const gameComponentsFile = path.join(gamesDir, entry.name, 'src/components.ts');
    if (fs.existsSync(gameComponentsFile)) {
      scanTargets.push({
        files: [gameComponentsFile],
        category: `game:${entry.name}`,
      });
    }
  }

  const allFiles = scanTargets.flatMap(t => t.files);
  console.log(`🔍 Found ${allFiles.length} component files`);

  // 创建 TypeScript 程序（一次性包含所有文件，保证跨文件类型引用正确）
  const program = ts.createProgram(allFiles, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    strict: true,
    esModuleInterop: true,
  });

  const typeChecker = program.getTypeChecker();
  const allSchemas: ComponentSchema[] = [];

  // 处理每个文件
  for (const target of scanTargets) {
    for (const filePath of target.files) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) continue;

      const schemas = extractComponentSchemas(sourceFile, typeChecker, target.category);
      allSchemas.push(...schemas);

      console.log(`  ✅ [${target.category || 'unknown'}] ${path.relative(projectRoot, filePath)}: ${schemas.length} component(s)`);
    }
  }

  // ── 输出 JSON（供 Editor fetch 使用） ──
  const output = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    componentCount: allSchemas.length,
    components: allSchemas,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✨ Generated ${allSchemas.length} component schemas`);
  console.log(`📄 Output  : ${outputPath}`);
}

main();
