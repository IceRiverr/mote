#!/usr/bin/env node
/**
 * Export Code Skill - 入口文件
 * 调用 export-code.mjs
 */

const { spawn } = require('child_process');
const path = require('path');

const mjsPath = path.join(__dirname, 'export-code.mjs');
const args = process.argv.slice(2);

const child = spawn('node', [mjsPath, ...args], {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code);
});
