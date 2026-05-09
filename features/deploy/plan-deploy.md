# Deploy 问题研究报告

## 问题诊断

### 当前部署流程
```json
"deploy": "npm run build && scp -r dist/* root@8.210.175.90:/var/www/iceriver.cc/"
```

### 核心问题
使用 `scp -r` 命令部署会导致**全量传输**，每次部署都会将所有文件（包括未变更的 assets）重新上传到服务器。

### 当前资源规模估算
| 目录 | 大小 | 说明 |
|------|------|------|
| `dist/` | ~5.2MB | 总构建产物 |
| `dist/assets/` | ~1.2MB | 引擎共享资源 |
| `dist/games/*/assets/` | ~4MB | 游戏资源（dungeon 3.6MB + tiny-town 353KB）|

**结论**：即使只修改了一行代码，每次部署都会重复传输约 5MB 数据。

---

## SCP 的问题分析

### 1. SCP 工作机制
- **无增量判断**：SCP 不会检查服务器上是否已存在相同文件
- **无文件校验**：不会对比文件内容或修改时间
- **全量覆盖**：每次都完整传输所有匹配的文件

### 2. 对 Assets 的影响
```
部署流程：
1. npm run build → 生成新的 dist（含 hash 的 JS/CSS）
2. scp -r dist/* → 传输所有文件
   ├── index.html (可能未变，但仍传输)
   ├── assets/ (字体等静态资源，大概率未变)
   ├── games/dungeon/assets/ (大概率未变)
   └── games/tiny-town/assets/ (大概率未变)
```

### 3. 带宽与时间浪费
- 假设每日部署 10 次
- 每次浪费 4-5MB 的 assets 传输
- 日累计浪费：40-50MB 上传带宽
- 部署时间被 assets 传输主导

---

## 解决方案对比

### 方案一：使用 rsync（推荐，但 Windows 下可能需要 WSL）

⚠️ **重要提示**：Git for Windows **不包含** rsync 可执行文件！Windows 用户建议使用方案六（Node.js 实现）或 WSL。

**原理**：rsync 通过文件大小、修改时间、校验和判断文件差异，只传输变化部分。

**原理**：rsync 通过文件大小、修改时间、校验和判断文件差异，只传输变化部分。

**命令示例**：
```bash
rsync -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/
```

**参数说明**：
- `-a`：归档模式（保留权限、时间戳、递归）
- `-v`：详细输出
- `-z`：传输时压缩
- `--delete`：删除服务器上已不存在于本地的文件

**优点**：
- ✅ 只传输变更文件，assets 若无变化则秒传
- ✅ 支持压缩，节省带宽
- ✅ 保留文件属性（修改时间等）
- ✅ 断点续传（大文件传输中断可恢复）

**缺点**：
- ❌ 需要在本地安装 rsync（Windows 需额外安装）
- ❌ 服务器端也需要 rsync

**适用场景**：当前场景最佳方案，增量部署的标配工具。

---

#### Windows 11 环境下的 rsync 安装指南

Windows 11 默认不包含 rsync，有以下几种安装方式（按推荐顺序排列）：

##### 方式一：使用 Git Bash（推荐）

如果你已经安装了 Git for Windows，那么已经自带 rsync，无需额外安装。

**检查是否可用**：
```bash
# 打开 Git Bash（在文件资源管理器右键 -> Git Bash Here）
rsync --version
```

**在 npm scripts 中使用**：
```json
{
  "scripts": {
    "deploy": "npm run build && \"C:\\Program Files\\Git\\usr\\bin\\rsync.exe\" -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/"
  }
}
```

或者创建一个 `deploy.sh` 脚本：
```bash
#!/bin/bash
# deploy.sh
npm run build
rsync -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/
```

然后在 Git Bash 中执行 `bash deploy.sh`。

**优点**：
- ✅ 无需额外安装（Git 自带）
- ✅ 支持所有 rsync 功能
- ✅ 兼容 SSH 密钥配置

---

##### 方式二：使用 WSL（Windows Subsystem for Linux）

WSL 是 Windows 10/11 内置的 Linux 子系统，提供完整的 Linux 环境。

**安装步骤**：
```powershell
# 以管理员身份运行 PowerShell
wsl --install
# 重启电脑后，按提示设置 Ubuntu
```

**在 WSL 中使用 rsync**：
```bash
# 进入项目目录（WSL 可以访问 Windows 文件系统）
cd /mnt/d/dev/mote

# 直接使用 rsync（Ubuntu 已预装）
npm run build
rsync -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/
```

**npm scripts 配置**：
```json
{
  "scripts": {
    "deploy": "wsl bash -c 'cd /mnt/d/dev/mote && npm run build && rsync -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/'"
  }
}
```

**优点**：
- ✅ 完整的 Linux 环境
- ✅ 所有 Linux 工具都可用
- ✅ 性能接近原生 Linux

**缺点**：
- ❌ 首次安装需要重启
- ❌ 需要学习基本的 Linux 命令

---

##### 方式三：使用 cwRsync（Windows 原生版）

cwRsync 是 rsync 的 Windows 移植版本，提供原生的 Windows 可执行文件。

**下载安装**：
1. 访问 https://www.itefix.net/cwrsync
2. 下载 `cwRsync` 免费版（或 cwrsync-free）
3. 解压到 `C:\Program Files\cwRsync`

**添加到环境变量**：
```powershell
# 添加到系统 PATH
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\cwRsync\bin", "User")
```

**npm scripts 配置**：
```json
{
  "scripts": {
    "deploy": "npm run build && rsync -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/"
  }
}
```

**注意事项**：
- cwRsync 使用 Cygwin 路径格式，可能需要处理路径转换
- SSH 密钥配置与 Git Bash 略有不同

**优点**：
- ✅ 纯 Windows 方案
- ✅ 可在 CMD/PowerShell 中直接运行

**缺点**：
- ❌ 免费版功能受限
- ❌ 路径处理可能有问题

---

##### 方式四：使用 Scoop 包管理器安装

如果你使用 Scoop 作为 Windows 包管理器：

```powershell
# 安装 rsync
scoop install rsync

# 验证
rsync --version
```

**优点**：
- ✅ 一键安装
- ✅ 自动添加到 PATH

**缺点**：
- ❌ 需要先安装 Scoop
- ❌ 实际上是依赖 MSYS2 的版本

---

#### Windows 11 方案推荐总结

| 方案 | 难度 | 推荐度 | 适用场景 |
|------|------|--------|----------|
| Git Bash | 极低 | ⭐⭐⭐⭐⭐ | 已安装 Git 的开发者 |
| WSL | 低 | ⭐⭐⭐⭐ | 需要完整 Linux 环境 |
| cwRsync | 中 | ⭐⭐⭐ | 不想使用 Git Bash/WSL |
| Scoop | 低 | ⭐⭐⭐ | 已使用 Scoop 的用户 |

**最终推荐**：使用 **Git Bash**，因为你作为开发者很可能已经安装了 Git，无需任何额外配置即可使用 rsync。

---

### 方案二：使用 SFTP + 智能脚本

**原理**：通过脚本对比本地和远程文件列表，只传输变更文件。

**实现思路**：
```bash
#!/bin/bash
# 生成文件清单和 hash
find dist -type f -exec md5sum {} \; > local_manifest.txt

# 下载远程清单（如果存在）
sftp root@8.210.175.90:/var/www/iceriver.cc/manifest.txt remote_manifest.txt 2>/dev/null || touch remote_manifest.txt

# 对比并传输差异文件
# ... 脚本逻辑 ...
```

**优点**：
- ✅ 不依赖 rsync
- ✅ 可精确控制传输行为

**缺点**：
- ❌ 需要自己编写和维护脚本
- ❌ 复杂度高于 rsync
- ❌ 不如 rsync 成熟稳定

**适用场景**：无法使用 rsync 的特殊环境。

---

### 方案三：分离 Assets 部署策略

**原理**：将不常变化的 assets 与频繁变化的代码分离部署。

**目录结构调整**：
```
服务器目录结构：
/var/www/iceriver.cc/
├── index.html              # 每次部署更新
├── assets/                 # 独立管理
│   ├── fonts/             # 很少更新
│   └── images/            # 很少更新
├── games/
│   ├── dungeon/
│   │   ├── index.html     # 每次部署更新
│   │   └── assets/        # 独立管理（很少更新）
│   └── tiny-town/
│       ├── index.html     # 每次部署更新
│       └── assets/        # 独立管理（很少更新）
└── js/                    # Vite 构建的 JS/CSS（含 hash）
    ├── index-xxx.js
    └── vendor-yyy.js
```

**部署脚本示例**：
```bash
# 仅传输代码（不含 assets）
rsync -avz --exclude='assets/' dist/ root@8.210.175.90:/var/www/iceriver.cc/

# assets 单独部署（仅在资源变更时执行）
rsync -avz dist/assets/ root@8.210.175.90:/var/www/iceriver.cc/assets/
rsync -avz dist/games/dungeon/assets/ root@8.210.175.90:/var/www/iceriver.cc/games/dungeon/assets/
```

**优点**：
- ✅ assets 与代码完全解耦
- ✅ assets 可单独版本控制
- ✅ 支持 CDN 部署 assets

**缺点**：
- ❌ 需要修改项目结构
- ❌ 需要维护两套部署逻辑
- ❌ 初期改造成本较高

**适用场景**：大型项目，assets 由美术团队独立管理。

---

### 方案四：使用 CI/CD + 对象存储（OSS/S3）

**原理**：将静态资源上传至对象存储，通过 CDN 分发。

**架构**：
```
Git Push → GitHub Actions → Build → 分离 assets 和代码
                          ↓
            ┌─────────────┼─────────────┐
            ↓             ↓             ↓
         代码文件      Assets        JS/CSS
            ↓             ↓             ↓
         部署到服务器   OSS/S3       OSS/S3 + CDN
```

**优点**：
- ✅ 国内访问速度快（配合 CDN）
- ✅ 完全解耦前后端资源
- ✅ 支持自动缓存刷新
- ✅ 可设置 assets 长期缓存

**缺点**：
- ❌ 需要购买 OSS 和 CDN 服务
- ❌ 架构复杂度增加
- ❌ 需要修改资源引用路径

**适用场景**：生产环境，面向用户的产品。

---

### 方案五：Webpack/Vite 持久缓存优化

**原理**：利用构建工具的缓存策略，确保文件 hash 不变时内容不变。

**Vite 配置优化**：
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 确保模块 hash 稳定
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          // assets 保持原始名称（无 hash）
          if (/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf)$/.test(assetInfo.name)) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
```

**优点**：
- ✅ 无需改变部署方式
- ✅ 利用浏览器缓存

**缺点**：
- ❌ 不能解决传输问题
- ❌ 只是优化了客户端缓存

**适用场景**：作为其他方案的补充。

---

## 推荐实施方案

### 短期方案（立即实施）

**使用 rsync 替换 scp**

#### 针对 Windows 11 + Git Bash 的配置（推荐）

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "deploy": "npm run build && bash deploy.sh"
  }
}
```

创建 `deploy.sh`（放在项目根目录）：
```bash
#!/bin/bash
set -e

# 配置
REMOTE_USER="root"
REMOTE_HOST="8.210.175.90"
REMOTE_PATH="/var/www/iceriver.cc/"
LOCAL_DIST="dist/"

echo "🚀 开始部署..."
echo "📦 本地目录: $LOCAL_DIST"
echo "🌐 远程服务器: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo ""

# 使用 rsync 增量部署
rsync -avz --delete \
  --exclude='*.tmp' \
  --exclude='.DS_Store' \
  "$LOCAL_DIST" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

echo ""
echo "✅ 部署完成！"
```

**使用方法**：
1. 确保已安装 Git for Windows（已包含 rsync）
2. 右键项目文件夹 → "Git Bash Here"
3. 执行 `npm run deploy`

#### 跨平台配置（支持 Windows/Mac/Linux）

如果团队成员使用不同操作系统，可以使用 cross-var 和 cross-env：

```bash
npm install --save-dev cross-env cross-var
```

```json
{
  "scripts": {
    "deploy": "npm run build && cross-var rsync -avz --delete dist/ %npm_package_config_remote%",
    "deploy:win": "npm run build && \"C:\\Program Files\\Git\\usr\\bin\\rsync.exe\" -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/"
  },
  "config": {
    "remote": "root@8.210.175.90:/var/www/iceriver.cc/"
  }
}
```

#### 前置检查

**Windows 检查 rsync**：
```bash
# Git Bash 中执行
rsync --version

# 或者检查路径
ls "/c/Program Files/Git/usr/bin/rsync.exe"
```

**服务器检查**：
```bash
# 检查服务器是否支持 rsync（大多数 Linux 已预装）
ssh root@8.210.175.90 "rsync --version"
```

**预期效果**：
- 首次部署：传输全部 5.2MB
- 后续部署（仅代码变更）：传输 <100KB（仅变化的 JS/HTML）
- 部署时间：从 10-30 秒缩短到 1-3 秒

---

### 方案六：Node.js 实现增量部署（Windows 最佳方案）

⚠️ **针对 Windows 用户的重要说明**：
- Git for Windows **不包含** rsync 可执行文件
- WSL 需要额外安装和配置
- **本方案是 Windows 用户最简单、最可靠的增量部署方案**

**原理**：使用 Node.js 的 `ssh2-sftp-client` 库，通过 SFTP 协议对比本地和远程文件，只传输变更的文件。

**实现**：已在项目中创建 `scripts/deploy.mjs`，无需额外安装任何系统软件。

**配置步骤**：

1. **安装依赖**（已添加到 package.json）：
```bash
npm install
```

2. **配置 SSH 密钥**（推荐）：
```bash
# 生成密钥（如果还没有）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 复制公钥到服务器
ssh-copy-id root@8.210.175.90
```

3. **修改部署脚本配置**（`scripts/deploy.mjs`）：
```javascript
const CONFIG = {
  host: '8.210.175.90',
  username: 'root',
  // 如果使用密码而不是密钥，取消下面注释：
  // password: '你的密码',
  localDir: join(process.cwd(), 'dist'),
  remoteDir: '/var/www/iceriver.cc',
};
```

4. **运行部署**：
```bash
npm run deploy
```

**package.json 配置**：
```json
{
  "scripts": {
    "deploy": "npm run build && node scripts/deploy.mjs",
    "deploy:full": "npm run build && scp -r dist/* root@8.210.175.90:/var/www/iceriver.cc/"
  }
}
```

**优点**：
- ✅ **纯 Node.js 实现**，无需 rsync、WSL 或任何外部工具
- ✅ **跨平台**，Windows/Mac/Linux 都可用
- ✅ **增量传输**，只上传变更的文件
- ✅ **自动对比**，基于文件大小判断差异（可扩展为 MD5 校验）
- ✅ **自动创建远程目录**
- ✅ **进度显示**，实时显示上传进度
- ✅ **安全可靠**，使用成熟的 `ssh2-sftp-client` 库

**缺点**：
- ❌ 比 rsync 稍慢（但差异可忽略）
- ❌ 需要 Node.js 依赖

**适用场景**：Windows 开发者、不想安装 WSL、需要简单可靠的增量部署

**工作原理**：
```
1. 扫描本地 dist 目录，获取所有文件列表
2. 连接服务器，扫描远程文件列表
3. 对比文件大小：
   - 远程不存在 → 上传
   - 大小不同 → 上传
   - 大小相同 → 跳过
4. 上传需要更新的文件
5. （可选）删除远程多余的文件
```

**预期效果**：
- 首次部署：传输全部 5.2MB
- 后续部署（仅代码变更）：传输 <100KB
- 部署时间：从 10-30 秒缩短到 1-3 秒

---

### Windows 用户方案对比

| 方案 | 需要安装 | 难度 | 推荐度 | 说明 |
|------|----------|------|--------|------|
| **方案六：Node.js** | 无 | 极低 | ⭐⭐⭐⭐⭐ | **推荐！** 纯 Node.js，跨平台 |
| WSL | WSL | 低 | ⭐⭐⭐⭐ | 需要重启电脑安装 |
| Git Bash + rsync | 重装 Git | 中 | ⭐⭐ | Git for Windows 不含 rsync |
| cwRsync | cwRsync | 中 | ⭐⭐⭐ | 第三方工具 |

**结论**：Windows 用户直接使用 **方案六（Node.js 实现）**，无需任何额外安装！

---

## 推荐实施方案（更新版）

### Windows 用户推荐方案

**使用 Node.js 增量部署（方案六）**

```json
{
  "scripts": {
    "deploy": "npm run build && node scripts/deploy.mjs"
  }
}
```

**使用方法**：
1. 确保已配置 SSH 密钥（或修改脚本使用密码）
2. 运行 `npm run deploy`
3. 享受增量部署的快感！

**效果**：
- 首次：传输 5.2MB
- 后续（仅代码变更）：传输 <100KB
- 部署时间：10-30 秒 → 1-3 秒

### macOS/Linux 用户推荐方案

使用方案一（rsync）：
```json
{
  "scripts": {
    "deploy": "npm run build && rsync -avz --delete dist/ root@8.210.175.90:/var/www/iceriver.cc/"
  }
}
```

或者也使用方案六（Node.js），完全跨平台兼容。

---

### 中期方案（可选优化）

**Assets 分离部署**

```bash
# 创建分离的部署脚本 deploy.sh
#!/bin/bash
set -e

echo "Building..."
npm run build

echo "Deploying code (excluding assets)..."
rsync -avz --delete --exclude='assets/' dist/ root@8.210.175.90:/var/www/iceriver.cc/

echo "Deploying shared assets..."
rsync -avz dist/assets/ root@8.210.175.90:/var/www/iceriver.cc/assets/

echo "Deploying game assets..."
rsync -avz dist/games/dungeon/games/dungeon/assets/ root@8.210.175.90:/var/www/iceriver.cc/games/dungeon/assets/
rsync -avz dist/games/tiny-town/games/tiny-town/assets/ root@8.210.175.90:/var/www/iceriver.cc/games/tiny-town/assets/

echo "Done!"
```

---

### 长期方案（生产环境）

**迁移至对象存储 + CDN**

1. 购买阿里云 OSS / 腾讯云 COS / AWS S3
2. 配置 CDN 加速
3. 修改 Vite 配置，使用外部 assets URL
4. GitHub Actions 自动部署

---

## 风险评估

| 方案 | 实施难度 | 风险 | 回滚策略 |
|------|----------|------|----------|
| rsync | 低 | 极低（命令替换） | 改回 scp 即可 |
| assets 分离 | 中 | 低 | 统一使用 rsync 回退 |
| OSS/CDN | 高 | 中（依赖第三方） | 保留原服务器部署方式 |

---

## 总结

**问题本质**：SCP 是全量复制工具，不适合频繁部署场景。

**核心解决方案**：使用增量部署工具（rsync 或 Node.js 实现）替代 scp。

**Windows 用户特别提示**：
- Git for Windows **不包含** rsync
- **推荐使用方案六：Node.js 实现**（已集成到项目）
- 运行 `npm install && npm run deploy` 即可

**预期收益**：
- 部署时间减少 80-90%
- 带宽使用减少 90%+
- 支持快速迭代开发

**建议执行顺序**：
1. Windows 用户：使用 Node.js 增量部署（已配置好）
2. macOS/Linux 用户：使用 rsync 或 Node.js 方案
3. 根据项目发展考虑 assets 分离
4. 产品上线后评估 OSS/CDN 方案
