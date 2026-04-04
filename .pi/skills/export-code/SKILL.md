---
name: export-code
description: 当用户说"导出代码"、"export code"、"export-code"时触发。将指定目录下的源代码合并导出为一个 Markdown 文件，方便给 AI 分析。
---

# Export Code

将项目源代码合并导出为 Markdown 文件，方便给 AI 分析或备份代码。

## 用法

```bash
# 导出指定目录（输出文件放在该目录下）
/skill:export-code <目标目录>

# 或简单说
导出代码 src
导出代码 games/tiny-dungeon
export-code ./packages/editor
```

## 支持的文件类型

- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- 样式: `.css`, `.scss`, `.less`
- HTML: `.html`
- 配置: `.json`

## 输出

导出的文件位于目标目录的根目录下，文件名格式为 `{folder-name}-code-export.md`：
```
{target-dir}/{folder-name}-code-export.md
```

## 示例

```bash
# 导出 src 目录
导出代码 src
# 输出: src/src-code-export.md

# 导出游戏目录
导出代码 games/tiny-dungeon
# 输出: games/tiny-dungeon/tiny-dungeon-code-export.md

# 导出编辑器目录
导出代码 ./packages/editor
# 输出: ./packages/editor/editor-code-export.md

# 导出当前目录
导出代码 ./
# 输出: ./mote-code-export.md
```

## 导出内容

生成的 Markdown 文件包含：
1. **文件清单树** - 展示目录结构
2. **快速导航** - 文件索引链接
3. **文件详情** - 每个文件的完整代码（带语法高亮）
