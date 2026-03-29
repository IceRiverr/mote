#!/usr/bin/env node
/**
 * 增量部署脚本 - Node.js 实现（无需 rsync）
 * 功能：对比本地和远程文件，只传输变更的文件
 */

import Client from 'ssh2-sftp-client';
import { createHash } from 'crypto';
import { createReadStream, existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, relative, dirname, posix } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 自动检测 SSH 私钥
function detectPrivateKey() {
  const keyPaths = [
    join(homedir(), '.ssh', 'id_ed25519'),
    join(homedir(), '.ssh', 'id_rsa'),
  ];
  
  for (const keyPath of keyPaths) {
    if (existsSync(keyPath)) {
      return readFileSync(keyPath);
    }
  }
  return null;
}

// 配置
const CONFIG = {
  host: '8.210.175.90',
  username: 'root',
  privateKey: detectPrivateKey(),
  // 如果使用密码而不是密钥，取消下面注释并注释掉上面的 privateKey：
  // password: '你的密码',
  localDir: join(process.cwd(), 'dist'),
  remoteDir: '/var/www/iceriver.cc',
};

// 计算文件 MD5
function getFileHash(filepath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = createReadStream(filepath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// 递归获取本地文件列表（带哈希）
async function getLocalFiles(dir, baseDir = dir) {
  const files = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...(await getLocalFiles(fullPath, baseDir)));
    } else {
      files.push({
        localPath: fullPath,
        relativePath: relative(baseDir, fullPath).replace(/\\/g, '/'),
        size: stat.size,
        mtime: stat.mtime,
      });
    }
  }

  return files;
}

// 获取远程文件列表
async function getRemoteFiles(sftp, remoteDir) {
  const files = [];

  async function listRecursive(currentDir) {
    try {
      const list = await sftp.list(currentDir);
      for (const item of list) {
        const remotePath = posix.join(currentDir, item.name);
        if (item.type === 'd') {
          await listRecursive(remotePath);
        } else {
          files.push({
            remotePath,
            relativePath: relative(remoteDir, remotePath).replace(/\\/g, '/'),
            size: item.size,
            modifyTime: item.modifyTime,
          });
        }
      }
    } catch (err) {
      // 目录不存在则忽略
      if (err.code !== 2) throw err;
    }
  }

  await listRecursive(remoteDir);
  return files;
}

// 主函数
async function deploy() {
  const sftp = new Client();

  try {
    console.log('🚀 开始增量部署...\n');

    // 1. 检查本地构建目录
    if (!existsSync(CONFIG.localDir)) {
      console.error('❌ 错误: dist 目录不存在，请先运行 npm run build');
      process.exit(1);
    }

    // 2. 连接服务器
    console.log(`🔌 连接到 ${CONFIG.host}...`);
    const connectConfig = {
      host: CONFIG.host,
      username: CONFIG.username,
    };
    
    if (CONFIG.privateKey) {
      connectConfig.privateKey = CONFIG.privateKey;
    }
    
    await sftp.connect(connectConfig);
    console.log('✅ 连接成功\n');

    // 3. 获取本地文件列表
    console.log('📦 扫描本地文件...');
    const localFiles = await getLocalFiles(CONFIG.localDir);
    console.log(`   找到 ${localFiles.length} 个文件`);
    
    // 计算本地文件哈希（用于精确对比）
    console.log('🔐 计算文件哈希...');
    for (const file of localFiles) {
      file.hash = await getFileHash(file.localPath);
    }
    console.log('   哈希计算完成\n');

    // 4. 获取远程文件列表
    console.log('🌐 扫描远程文件...');
    const remoteFiles = await getRemoteFiles(sftp, CONFIG.remoteDir);
    console.log(`   找到 ${remoteFiles.length} 个文件\n`);

    // 5. 对比文件，找出需要上传的
    console.log('🔍 对比文件差异...');
    const remoteFileMap = new Map(remoteFiles.map(f => [f.relativePath, f]));
    const filesToUpload = [];
    const filesToSkip = [];
    const htmlFilesToCheck = [];

    // 第一轮：快速对比（大小不同的一定要上传）
    for (const localFile of localFiles) {
      const remoteFile = remoteFileMap.get(localFile.relativePath);

      if (!remoteFile) {
        // 远程不存在，必须上传
        filesToUpload.push(localFile);
      } else if (remoteFile.size !== localFile.size) {
        // 大小不同，必须上传
        filesToUpload.push(localFile);
      } else if (localFile.relativePath.endsWith('.html')) {
        // 大小相同但可能是 HTML 文件，需要进一步检查哈希
        htmlFilesToCheck.push({ localFile, remoteFile });
      } else {
        // 大小相同的非 HTML 文件，假设内容相同
        filesToSkip.push(localFile);
      }
    }
    
    // 第二轮：对 HTML 文件进行哈希对比（下载远程文件计算哈希）
    if (htmlFilesToCheck.length > 0) {
      console.log(`   📝 发现 ${htmlFilesToCheck.length} 个 HTML 文件大小相同，正在精确对比...`);
      for (const { localFile, remoteFile } of htmlFilesToCheck) {
        try {
          // 下载远程文件到临时位置计算哈希
          const tempPath = join(process.cwd(), '.deploy-temp-' + Date.now());
          await sftp.get(remoteFile.remotePath, tempPath);
          const remoteHash = await getFileHash(tempPath);
          
          // 删除临时文件
          try {
            const { unlinkSync } = await import('fs');
            unlinkSync(tempPath);
          } catch (e) {
            // 忽略删除错误
          }
          
          if (remoteHash !== localFile.hash) {
            filesToUpload.push(localFile);
            console.log(`      ⚠️  ${localFile.relativePath} 内容已变化`);
          } else {
            filesToSkip.push(localFile);
          }
        } catch (err) {
          // 如果下载失败，直接上传
          console.log(`      ⚠️  无法对比 ${localFile.relativePath}，将重新上传`);
          filesToUpload.push(localFile);
        }
      }
    }

    const localFileSet = new Set(localFiles.map(f => f.relativePath));
    const filesToDelete = remoteFiles.filter(f => !localFileSet.has(f.relativePath));

    console.log(`   📝 需要上传: ${filesToUpload.length} 个文件`);
    console.log(`   ⏭️  跳过: ${filesToSkip.length} 个文件`);
    console.log(`   🗑️  远程多余: ${filesToDelete.length} 个文件\n`);

    // 6. 执行上传
    if (filesToUpload.length === 0) {
      console.log('✅ 所有文件已是最新，无需部署！');
    } else {
      console.log('📤 开始上传文件...');
      let uploaded = 0;
      const totalSize = filesToUpload.reduce((sum, f) => sum + f.size, 0);
      let uploadedSize = 0;

      for (const file of filesToUpload) {
        const remotePath = posix.join(CONFIG.remoteDir, file.relativePath);
        const remoteDir = dirname(remotePath);

        await sftp.mkdir(remoteDir, true);
        await sftp.put(file.localPath, remotePath);

        uploaded++;
        uploadedSize += file.size;
        const progress = ((uploadedSize / totalSize) * 100).toFixed(1);
        process.stdout.write(`   [${uploaded}/${filesToUpload.length}] ${progress}% - ${file.relativePath}\r`);
      }

      console.log(`\n   ✅ 上传完成 (${formatBytes(totalSize)})\n`);
    }

    // 7. 删除远程多余文件
    if (filesToDelete.length > 0) {
      console.log('🗑️  清理远程多余文件...');
      for (const file of filesToDelete) {
        await sftp.delete(file.remotePath);
        console.log(`   已删除: ${file.relativePath}`);
      }
      console.log('');
    }

    console.log('🎉 部署完成！');

  } catch (err) {
    console.error('\n❌ 部署失败:', err.message);
    process.exit(1);
  } finally {
    await sftp.end();
  }
}

// 格式化字节大小
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 运行
deploy();
