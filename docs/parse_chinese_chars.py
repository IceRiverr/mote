#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解析常用汉字表3500.md，提取汉字和ID，生成CSV文件
"""

import re
import csv
import os
import sys

# 设置标准输出编码
sys.stdout.reconfigure(encoding='utf-8')

def parse_chinese_chars(input_file, output_file):
    """解析汉字表并生成CSV"""
    
    # 读取文件内容
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 使用正则表达式匹配 4位数字+汉字+顿号 的模式
    # 如：0001一、0002乙、
    pattern = r'(\d{4})([^、\s])、'
    matches = re.findall(pattern, content)
    
    print(f"共找到 {len(matches)} 个汉字")
    
    # 确保输出目录存在
    output_dir = os.path.dirname(output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 写入CSV文件
    with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['id', 'char'])  # 写入表头
        
        for char_id, char in matches:
            writer.writerow([char_id, char])
    
    print(f"CSV文件已生成: {output_file}")
    
    # 显示前10条和后5条数据作为验证
    print("前10条数据:")
    for i in range(min(10, len(matches))):
        print(f"  {matches[i][0]} -> {matches[i][1]}")
    
    print("后5条数据:")
    for i in range(max(0, len(matches)-5), len(matches)):
        print(f"  {matches[i][0]} -> {matches[i][1]}")

if __name__ == '__main__':
    input_file = r'D:\dev\mote\docs\常用汉字表3500.md'
    output_file = r'D:\dev\mote\chinese_chars_3500.csv'
    
    parse_chinese_chars(input_file, output_file)
