---
name: deploy
description: 当用户说"部署"时触发。先执行构建，然后将游戏增量部署到远端服务器。
---

# Deploy

自动执行 `npm run build` 和 `npm run deploy`，将游戏增量部署到远端服务器。

## 用法

```bash
# 部署游戏
/skill:deploy

# 或简单说
部署
```

## 部署流程

1. **构建** - 执行 `npm run build` 编译项目
2. **连接** - 通过 SSH/SFTP 连接到远端服务器
3. **对比** - 对比本地和远程文件，计算 MD5 哈希
4. **增量上传** - 只传输变更的文件
5. **清理** - 删除远程多余的文件

## 配置

部署配置位于 `scripts/deploy.mjs`：

```javascript
const CONFIG = {
  host: '8.210.175.90',
  username: 'root',
  privateKey: detectPrivateKey(), // 自动检测 ~/.ssh/id_ed25519 或 id_rsa
  localDir: join(process.cwd(), 'dist'),
  remoteDir: '/var/www/iceriver.cc',
};
```

## 手动部署

```bash
# 完整部署（构建+上传）
npm run deploy

# 强制完整上传（使用 scp）
npm run deploy:full
```
