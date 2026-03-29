#!/bin/bash
# Git commit helper - 自动添加前缀并生成结构化提交信息

set -e

# 检查参数
if [ $# -lt 1 ]; then
  echo "用法: $0 <提交信息> [核心内容1] [核心内容2] [核心内容3]"
  exit 1
fi

msg="$1"
shift

# 已有前缀则跳过，否则自动推断
if echo "$msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore):"; then
  final_msg="$msg"
else
  prefix="feat"
  git diff --cached --name-only 2>/dev/null | grep -q "test" && prefix="test"
  git diff --cached --name-only 2>/dev/null | grep -qE "\.(md|txt)$" && prefix="docs"
  git diff --cached --name-only 2>/dev/null | grep -qE "\.(css|scss|html)$" && prefix="style"
  final_msg="$prefix: $msg"
fi

# 添加核心内容（bullet points）
if [ $# -gt 0 ]; then
  final_msg="$final_msg

"
  for point in "$@"; do
    final_msg="${final_msg}- $point
"
  done
fi

# 执行提交
git add -A
git commit -m "$final_msg"
echo "✓ Committed"
