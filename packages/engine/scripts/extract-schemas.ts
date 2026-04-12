#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════
// extract-schemas.ts - 从组件 JSDoc 提取 Schema
// 
// 用法: tsx scripts/extract-schemas.ts
// 输出: dist/component-schemas.json
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

interface PropertySchema {
  type: string;
  default: any;
  label?: string;
  description?: string;
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    nullable?: boolean;
  };
}

interface ComponentSchema {
  name: string;
  displayName?: string;
  description?: string;
  properties: Record<string, PropertySchema>;
  icon?: string;
  editable: boolean;
}

// ═══════════════════════════════════════════════════════════════
// JSDoc 解析工具
// ═══════════════════════════════════════════════════════════════

/**
 * 解析属性默认值（从初始化表达式）
 */
function getDefaultValueFromInitializer(node: ts.PropertyDeclaration, type: string): any {
  if (!node.initializer) return undefined;
  
  const text = node.initializer.getText();
  
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
  if (type === 'string' || type === 'color') {
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
function inferTypeFromNode(node: ts.PropertyDeclaration | ts.ParameterDeclaration, typeChecker: ts.TypeChecker): string {
  const type = typeChecker.getTypeAtLocation(node);
  const typeString = typeChecker.typeToString(type);
  
  // 映射到 schema 类型
  const typeMap: Record<string, string> = {
    'number': 'number',
    'string': 'string',
    'boolean': 'boolean',
    'color': 'color',  // 需要 @type color 标记
    'vec2': 'vec2',
  };
  
  return typeMap[typeString] || 'string';
}

/**
 * 解析默认值
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

function extractComponentSchemas(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker): ComponentSchema[] {
  const schemas: ComponentSchema[] = [];
  
  function visit(node: ts.Node) {
    // 查找 ClassDeclaration
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      
      // 获取类的 JSDoc
      const classJsDoc = ts.getJSDocCommentsAndTags(node);
      const classTags = parseJSDocTags(classJsDoc.flatMap(d => ts.isJSDoc(d) ? d.tags || [] : []));
      
      const properties: Record<string, PropertySchema> = {};
      let editable = true;
      
      // 遍历类成员
      for (const member of node.members) {
        if (ts.isPropertyDeclaration(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          
          // 获取属性的 JSDoc
          const propJsDoc = ts.getJSDocCommentsAndTags(member);
          const propTags = parseJSDocTags(propJsDoc.flatMap(d => ts.isJSDoc(d) ? d.tags || [] : []));
          
          // 获取描述
          const description = propJsDoc
            .filter((d): d is ts.JSDoc => ts.isJSDoc(d))
            .map(d => d.comment)
            .filter((c): c is string => typeof c === 'string')[0];
          
          // 推断类型
          let type = inferTypeFromNode(member, typeChecker);
          
          // 检查是否有 @type 覆盖
          if (propTags['type']) {
            type = propTags['type'];
          }
          
          // 解析默认值（优先从 JSDoc，其次从初始化表达式）
          let defaultValue: any;
          if (propTags['default'] !== undefined) {
            defaultValue = parseDefaultValue(propTags['default'], type);
          } else {
            defaultValue = getDefaultValueFromInitializer(member, type);
          }
          
          // 如果是 @readonly，标记为不可编辑
          if (propTags['readonly'] === 'true') {
            continue;  // 跳过只读属性
          }
          
          properties[propName] = {
            type,
            default: defaultValue,
            label: propTags['label'] || propName,
            description,
            constraints: parseConstraints(propTags),
          };
        }
      }
      
      // 获取类的描述
      const classDescription = classJsDoc
        .filter((d): d is ts.JSDoc => ts.isJSDoc(d))
        .map(d => d.comment)
        .filter((c): c is string => typeof c === 'string')[0];
      
      // 检查类是否标记为不可编辑
      if (classTags['editable'] === 'false') {
        editable = false;
      }
      
      // 只添加有属性的组件
      if (Object.keys(properties).length > 0 || !editable) {
        schemas.push({
          name: className,
          displayName: classTags['displayName'] || className,
          description: classDescription,
          properties,
          icon: classTags['icon'],
          editable,
        });
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return schemas;
}

// ═══════════════════════════════════════════════════════════════
// 入口
// ═══════════════════════════════════════════════════════════════

function main() {
  const componentsDir = path.join(__dirname, '../src/components');
  const outputPath = path.join(__dirname, '../dist/component-schemas.json');
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 读取所有组件文件
  const files = fs.readdirSync(componentsDir)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    .map(f => path.join(componentsDir, f));
  
  console.log(`🔍 Found ${files.length} component files`);
  
  // 创建 TypeScript 程序
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
  });
  
  const typeChecker = program.getTypeChecker();
  const allSchemas: ComponentSchema[] = [];
  
  // 处理每个文件
  for (const filePath of files) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;
    
    const schemas = extractComponentSchemas(sourceFile, typeChecker);
    allSchemas.push(...schemas);
    
    console.log(`  ✅ ${path.basename(filePath)}: ${schemas.length} component(s)`);
  }
  
  // 输出
  const output = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    components: allSchemas,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  console.log(`\n✨ Generated ${allSchemas.length} component schemas`);
  console.log(`📄 Output: ${outputPath}`);
}

main();
