#!/bin/bash

# mote 项目 Git 提交助手
# 用法: ./git-commit.sh [提交信息]
#      ./git-commit.sh -m "第一行" -m "第二行" -m "第三行"

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 收集所有 -m 参数
commit_lines=()
while getopts "m:" opt; do
    case $opt in
        m) commit_lines+=("$OPTARG") ;;
        *) echo "用法: $0 [-m '提交信息']..." >&2; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

# 如果没有 -m 参数，检查位置参数
if [ ${#commit_lines[@]} -eq 0 ]; then
    if [ -z "$1" ]; then
        echo -e "${YELLOW}请输入提交信息:${NC}"
        read -r line
        commit_lines+=("$line")
    else
        commit_lines+=("$1")
    fi
fi

# 检查第一行是否为空
if [ -z "${commit_lines[0]}" ]; then
    echo -e "${YELLOW}⚠️  提交信息不能为空，已取消提交${NC}"
    exit 1
fi

# 自动检测前缀
first_line="${commit_lines[0]}"
if echo "$first_line" | grep -qE "^(feat|fix|docs|style|refactor|test|chore):"; then
    # 已有前缀，不做修改
    final_msg_lines=("${commit_lines[@]}")
else
    # 根据文件变化自动推断前缀
    prefix="feat"
    if git diff --cached --name-only 2>/dev/null | grep -q "test"; then
        prefix="test"
    elif git diff --cached --name-only 2>/dev/null | grep -qE "\.(md|txt)$"; then
        prefix="docs"
    elif git diff --cached --name-only 2>/dev/null | grep -qE "\.(css|scss|html)$"; then
        prefix="style"
    fi
    
    # 检查是否主要是删除操作（清理类提交）
    if git diff --cached --stat 2>/dev/null | grep -q "^.*|.*\+.*\-.*$"; then
        # 检查删除行数是否明显多于添加行数
        added=$(git diff --cached --numstat 2>/dev/null | awk '{sum+=$1} END {print sum}')
        deleted=$(git diff --cached --numstat 2>/dev/null | awk '{sum+=$2} END {print sum}')
        if [ -n "$deleted" ] && [ -n "$added" ] && [ "$deleted" -gt "$added" ]; then
            prefix="style"
        fi
    fi
    
    # 给第一行添加前缀
    final_msg_lines=("$prefix: $first_line")
    # 保留其余行
    for ((i=1; i<${#commit_lines[@]}; i++)); do
        final_msg_lines+=("${commit_lines[$i]}")
    done
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📦 mote Git 提交助手${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 显示当前状态
echo -e "\n${YELLOW}📋 当前变更:${NC}"
git status -s

# 添加所有变更
echo -e "\n${YELLOW}➕ 添加所有变更...${NC}"
git add -A

# 显示暂存区文件
echo -e "\n${YELLOW}📂 已暂存文件:${NC}"
git diff --cached --stat

# 构建提交信息
final_msg=""
for line in "${final_msg_lines[@]}"; do
    if [ -z "$final_msg" ]; then
        final_msg="$line"
    else
        final_msg="$final_msg

$line"
    fi
done

# 显示提交信息（仅第一行）
echo -e "\n${YELLOW}💬 提交信息: ${GREEN}${final_msg_lines[0]}${NC}"
echo -e "${YELLOW}📝 正在提交...${NC}\n"

# 使用 printf 支持多行提交
printf '%s' "$final_msg" | git commit -F -

# 提交成功提示
echo -e "\n${GREEN}✅ 提交成功!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 询问是否推送
echo -e "\n${YELLOW}是否要推送到远程仓库? (y/n)${NC}"
read -r push_confirm

if [ "$push_confirm" = "y" ] || [ "$push_confirm" = "Y" ]; then
    current_branch=$(git branch --show-current)
    echo -e "${YELLOW}🚀 推送到 origin/$current_branch...${NC}"
    git push origin "$current_branch"
    echo -e "${GREEN}✅ 推送成功!${NC}"
else
    echo -e "${YELLOW}⏸️  已跳过推送${NC}"
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎮 继续开发你的 mote 引擎吧!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
