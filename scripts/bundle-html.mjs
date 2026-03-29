/**
 * bundle-html.mjs
 * 将指定游戏的构建产物打包成单个独立 HTML 文件，可直接发给朋友使用。
 *
 * 用法:
 *   node scripts/bundle-html.mjs breakout
 *   node scripts/bundle-html.mjs breakout --out ./breakout-standalone.html
 *
 * 原理：
 *   Vite 构建产物是多个 ES module 文件，模块间有 import/export。
 *   直接拼接会导致变量名冲突。
 *   解决方案：把每个 JS 模块编码为 base64 data URL，在运行时用
 *   动态 import() 加载，模块间的相对路径 import 替换为对应的 data URL。
 *   这样每个模块保持独立作用域，完全等价于原始的多文件加载。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ── CLI 参数 ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const gameName = args.find(a => !a.startsWith('--'));
const outFlagIdx = args.indexOf('--out');
const outArg = outFlagIdx !== -1 ? args[outFlagIdx + 1] : null;

if (!gameName) {
  console.error('Usage: node scripts/bundle-html.mjs <game-name> [--out <output.html>]');
  console.error('Example: node scripts/bundle-html.mjs breakout');
  process.exit(1);
}

const gameDistDir = path.join(DIST, 'games', gameName);
const htmlPath = path.join(gameDistDir, 'index.html');

if (!fs.existsSync(htmlPath)) {
  console.error(`Not found: ${htmlPath}`);
  console.error('Run "npm run build" first.');
  process.exit(1);
}

// 默认输出到对应游戏目录下
const defaultOutPath = path.join(ROOT, 'games', gameName, `${gameName}-standalone.html`);
const outPath = outArg ? path.resolve(outArg) : defaultOutPath;

// ── 工具函数 ──────────────────────────────────────────────────────────────────

/** 将 /assets/... 或 /games/{game}/assets/... 路径解析为绝对路径 */
function resolveAsset(assetPath, gameName) {
  // 处理 /games/{game}/assets/... 路径
  const gamesAssetsMatch = assetPath.match(/^\/games\/([^\/]+)\/assets\/(.*)/);
  if (gamesAssetsMatch) {
    const [, gName, subPath] = gamesAssetsMatch;
    return path.join(ROOT, 'games', gName, 'assets', subPath);
  }
  // 处理 /assets/... 路径
  return path.join(DIST, assetPath);
}

/** 读取文件为 base64 data URL */
function toDataUrl(filePath, mimeType) {
  const data = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

/** 根据扩展名推断 MIME */
function mimeOf(ext) {
  const map = {
    '.js':    'application/javascript',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.json':  'application/json',
    '.woff2': 'font/woff2',
    '.woff':  'font/woff',
    '.ttf':   'font/ttf',
    '.wav':   'audio/wav',
  };
  return map[ext] || 'application/octet-stream';
}

// ── 主逻辑 ────────────────────────────────────────────────────────────────────

let html = fs.readFileSync(htmlPath, 'utf-8');

// 1. 收集所有 JS 模块路径（/assets/xxx.js 形式）
const jsPathSet = new Set();

const preloadRe = /<link\s+rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g;
const scriptRe  = /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g;
let m;
while ((m = preloadRe.exec(html)) !== null) jsPathSet.add(m[1]);

let entryPath = null;
while ((m = scriptRe.exec(html)) !== null) {
  jsPathSet.add(m[1]);
  entryPath = m[1]; // 最后一个 src 是入口
}

if (!entryPath) {
  console.error('No entry <script type="module" src="..."> found in HTML.');
  process.exit(1);
}

console.log(`Found ${jsPathSet.size} JS module(s):`);
jsPathSet.forEach(f => console.log(`  ${f}`));
console.log(`Entry: ${entryPath}`);

// 2. 处理每个 JS 模块：
//    a) 替换模块内的静态资源 URL（字体等）为 base64 data URL
//    b) 替换模块间的相对 import 路径为对应模块的 base64 data URL
//
// 因为模块间 import 用的是相对路径（如 "./createGfxDevice-xxx.js"），
// 我们先建立一个 basename -> data URL 的映射表，然后替换。

const replacedAssets = new Set();

// 先处理所有非 JS 资源（字体等），建立 /assets/path -> dataUrl 映射
const assetDataUrls = new Map(); // assetAbsPath -> dataUrl
// 匹配 /assets/... 和 /games/{game}/assets/... 路径
const assetUrlRe = /['"`](\/?(?:assets\/|games\/[^\/]+\/assets\/)[^'"`]+?\.(png|jpg|jpeg|json|woff2|woff|ttf|wav))['"`]/gi;

// 扫描所有 JS 文件中引用的资源
for (const jsPath of jsPathSet) {
  const filePath = resolveAsset(jsPath);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf-8');
  let am;
  while ((am = assetUrlRe.exec(content)) !== null) {
    const fullAssetPath = am[1]; // 完整路径含扩展名
    const ext = path.extname(fullAssetPath);
    const filePath2 = resolveAsset(fullAssetPath, gameName);
    if (fs.existsSync(filePath2) && !assetDataUrls.has(fullAssetPath)) {
      const dataUrl = toDataUrl(filePath2, mimeOf(ext));
      assetDataUrls.set(fullAssetPath, dataUrl);
      console.log(`  Inlined asset: ${fullAssetPath} (${Math.round(dataUrl.length / 1024)}KB)`);
    }
  }
  assetUrlRe.lastIndex = 0;
}

// 3. 替换每个模块内的静态资源 URL，收集模块内容
const moduleContents = new Map(); // jsPath -> processedContent
for (const jsPath of jsPathSet) {
  const filePath = resolveAsset(jsPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: JS file not found: ${filePath}`);
    moduleContents.set(jsPath, '');
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(assetUrlRe, (match, fullAssetPath) => {
    const dataUrl = assetDataUrls.get(fullAssetPath);
    if (!dataUrl) return match;
    return `${match[0]}${dataUrl}${match[0]}`;
  });
  moduleContents.set(jsPath, content);
}

// 4. 生成 bootstrap script：
//    在运行时为每个模块创建 Blob URL，替换模块间的相对 import，
//    最后 dynamic import 入口模块。
//    这样每个模块保持独立的 ES module 作用域，且 Blob URL 同源，
//    可以互相 import，不受 data: URL 的跨源限制。

// basename -> jsPath 映射
const basenameToPath = new Map();
for (const jsPath of jsPathSet) {
  basenameToPath.set(path.basename(jsPath), jsPath);
}

// 收集所有模块间的相对 import（用于运行时替换）
// 格式：{ jsPath, basename, relPattern }
const allRelImports = new Set();
for (const [jsPath, content] of moduleContents) {
  const re = /(['"`])(\.\/[^'"`\s]+\.js)\1/g;
  let mm;
  while ((mm = re.exec(content)) !== null) {
    allRelImports.add(path.basename(mm[2]));
  }
}

// 把每个模块内容 base64 编码，嵌入 bootstrap script
// bootstrap script 在运行时：
//   1. 为每个模块创建 Blob，得到 blobUrl
//   2. 对每个模块内容做字符串替换：把 "./xxx.js" 换成对应的 blobUrl
//   3. 重新创建替换后的 Blob
//   4. dynamic import 入口

// 按依赖顺序排列模块（叶子先，入口最后）
function getRelDeps(content) {
  const re = /['"`](\.\/[^'"`\s]+\.js)['"`]/g;
  const deps = [];
  let mm;
  while ((mm = re.exec(content)) !== null) {
    deps.push(path.basename(mm[1]));
  }
  return [...new Set(deps)];
}

const orderedModules = []; // [{basename, content}] 拓扑顺序
const visitedOrder = new Set();

function visitModule(jsPath) {
  if (visitedOrder.has(jsPath)) return;
  visitedOrder.add(jsPath);
  const content = moduleContents.get(jsPath) || '';
  for (const depBasename of getRelDeps(content)) {
    const depPath = basenameToPath.get(depBasename);
    if (depPath) visitModule(depPath);
  }
  orderedModules.push({ basename: path.basename(jsPath), content });
}

// 从入口开始遍历（会递归处理所有依赖）
visitModule(entryPath);
// 补上未被 import 引用但在 HTML 里声明的模块（如 modulepreload polyfill）
for (const jsPath of jsPathSet) {
  visitModule(jsPath);
}

// 生成 bootstrap script
const modulesJson = JSON.stringify(
  orderedModules.map(m => ({ b: m.basename, c: m.content }))
);

const bootstrapScript = `<script type="module">
(async () => {
  const modules = ${modulesJson};
  const blobUrls = new Map();
  // 第一遍：为每个模块创建初始 Blob URL（用于占位）
  for (const mod of modules) {
    const blob = new Blob([mod.c], { type: 'application/javascript' });
    blobUrls.set(mod.b, URL.createObjectURL(blob));
  }
  // 第二遍：替换模块内容中的相对 import，重新创建 Blob URL
  for (const mod of modules) {
    let src = mod.c;
    for (const [basename, blobUrl] of blobUrls) {
      // 替换所有形如 "./basename" 的引用
      src = src.replaceAll(JSON.stringify('./' + basename), JSON.stringify(blobUrl));
      src = src.replaceAll("'./" + basename + "'", "'" + blobUrl + "'");
      src = src.replaceAll('\`' + './' + basename + '\`', '\`' + blobUrl + '\`');
    }
    const blob = new Blob([src], { type: 'application/javascript' });
    blobUrls.set(mod.b, URL.createObjectURL(blob));
  }
  // 动态 import 入口模块
  const entryUrl = blobUrls.get(${JSON.stringify(path.basename(entryPath))});
  await import(entryUrl);
})();
</script>`;

// 5. 重建 HTML
html = html.replace(/<link\s+rel="modulepreload"[^>]*>\n?/g, '');
html = html.replace(/<script\s+type="module"[^>]*src="[^"]*"[^>]*><\/script>\n?/g, '');
html = html.replace('</head>', `${bootstrapScript}\n</head>`);

// 5. 写出文件
fs.writeFileSync(outPath, html, 'utf-8');

const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
console.log(`\nDone! Standalone HTML written to:`);
console.log(`  ${outPath}`);
console.log(`  Size: ${sizeKB} KB`);
