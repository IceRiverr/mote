#!/bin/bash

# mote 项目 Git 提交助手
# 用法: ./git-commit.sh [提交信息]

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取提交信息
if [ -z "$1" ]; then
    echo -e "${YELLOW}请输入提交信息:${NC}"
    read -r commit_msg
else
    commit_msg="$1"
fi

# 检查提交信息是否为空
if [ -z "$commit_msg" ]; then
    echo -e "${YELLOW}⚠️  提交信息不能为空，已取消提交${NC}"
    exit 1
fi

# 自动检测修改的文件类型并添加前缀
if echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore):"; then
    # 已有前缀，不做修改
    final_msg="$commit_msg"
else
    # 根据文件变化自动推断前缀
    if git diff --cached --name-only | grep -q "test"; then
        final_msg="test: $commit_msg"
    elif git diff --cached --name-only | grep -qE "(md|txt)$"; then
        final_msg="docs: $commit_msg"
    elif git diff --cached --name-only | grep -qE "(css|scss|html)$"; then
        final_msg="style: $commit_msg"
    else
        final_msg="feat: $commit_msg"
    fi
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

# 提交
echo -e "\n${YELLOW}💬 提交信息: ${GREEN}$final_msg${NC}"
echo -e "${YELLOW}📝 正在提交...${NC}\n"

git commit -m "$final_msg"

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
