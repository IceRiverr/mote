---
name: git-commit
description: 当用户说"提交"、"commit"或"保存进度"时触发。自动生成带前缀(feat/fix/docs等)和核心要点的规范提交信息，执行 git add -A && git commit。
---

# Git Commit

自动推断提交前缀（feat/fix/docs/style/test），执行 `git add -A` 和 `git commit`。

## 用法

```bash
# 简单提交
/skill:git-commit "添加敌人 AI"

# 带核心内容（推荐）
/skill:git-commit "添加敌人 AI" "实现路径寻找算法" "添加攻击状态机"
```

## 输出格式

```
feat: 添加敌人 AI

- 实现路径寻找算法
- 添加攻击状态机
```

## 前缀规则

| 前缀 | 触发条件 |
|------|----------|
| feat: | 默认 |
| test: | 修改 test 目录文件 |
| docs: | 修改 .md/.txt 文件 |
| style: | 修改 .css/.scss/.html 文件 |
| fix:/refactor:/chore: | 手动指定 |

手动指定前缀时保留原样：
```bash
/skill:git-commit "fix: 修复碰撞检测"
```
