---
name: git-commit
description: 为 mote 项目提供便捷的 Git 提交功能。当用户想要提交代码、保存开发进度、或使用中文描述提交时自动触发。支持自动添加提交前缀(feat/fix/docs等)、交互式确认、一键推送、双语提交格式。
---

# Git Commit Skill

为 mote 游戏引擎项目提供便捷的 Git 提交工作流。

## 功能

- 🏷️ **自动前缀**：根据修改文件自动推断 `feat:`/`fix:`/`docs:`/`test:`/`style:`
- 📝 **双语提交**：支持英文标题 + 中文详情的提交格式
- 🚀 **一键推送**：提交后询问是否推送到远程仓库
- 🎨 **彩色输出**：清晰的视觉反馈

## 使用方法

### 命令行使用

```bash
# 方式1：使用 npm 脚本
npm run commit "你的提交信息"
npm run cz                    # 短命令别名

# 方式2：直接使用脚本
./git-commit.sh "提交信息"

# 方式3：多行提交（推荐用于详细说明）
./git-commit.sh -m "feat: Add new feature" -m "添加新功能" -m "- 详细说明1" -m "- 详细说明2"
```

### 作为 pi 命令使用

```bash
/skill:git-commit             # 交互式输入提交信息
/skill:git-commit "提交信息"   # 直接提交
```

## 提交格式规范

### 推荐格式（双语）

```
type: English description here.
中文描述

详细说明（可选）：
- 变更点1
- 变更点2
```

**示例：**
```
style: Clean up the fix comments in the engine code.
清理引擎代码中的修复注释

已移除的注释类型：
- [Fix: 问题1] [Fix: 问题2] 等问题标记
- [Fix: Bug1] [Fix: Bug2] 等 bug 修复标记
- [Fix: 优化2] [Fix: 优化3] 等优化标记
- 冗余的中文说明注释

保留的注释：
- 文件结构分隔符
- 函数/类文档注释
- 必要的代码逻辑说明
```

### 单语格式（简洁）

```
feat: 添加贪吃蛇游戏
```

## 提交前缀规范

| 前缀 | 说明 | 自动触发条件 |
|------|------|-------------|
| `feat:` | 新功能 | 默认 |
| `fix:` | 修复 bug | 手动指定 |
| `docs:` | 文档更新 | 修改 .md/.txt 文件 |
| `style:` | 代码格式/注释清理 | 修改 .css/.scss/.html 或仅删除行 |
| `test:` | 测试相关 | 修改 test 目录下的文件 |
| `refactor:` | 重构代码 | 手动指定 |
| `chore:` | 构建/工具 | 手动指定 |

## 自动推断逻辑

当用户没有指定前缀时，skill 会：
1. 检查暂存区文件路径包含 `test` → 添加 `test:` 前缀
2. 检查文件后缀为 `.md` 或 `.txt` → 添加 `docs:` 前缀
3. 检查文件后缀为 `.css`/`.scss`/`.html` → 添加 `style:` 前缀
4. 检查修改主要是删除行（清理）→ 添加 `style:` 前缀
5. 其他情况 → 添加 `feat:` 前缀

如果用户已指定前缀（如 `fix: 修复bug`），则保留用户输入。

## 执行流程

```
用户输入 → 检测前缀 → 显示变更 → 添加文件 → 显示统计 → 提交 → 询问推送 → 完成
```

## 文件位置

- Skill 定义：`.pi/skills/git-commit/SKILL.md`
- 执行脚本：`git-commit.sh`（项目根目录）
