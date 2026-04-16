/**
 * 微尘引擎 — 资源路径验证与解析
 * 所有资源路径统一使用 POSIX 正斜杠，相对 assets/ 根目录解析
 */

/**
 * 验证资源路径是否符合规范
 * - POSIX 正斜杠
 * - 禁止 ../
 * - 禁止绝对路径
 * - 禁止 assets/ 前缀
 * - 禁止 Windows 盘符
 * - 禁止 ./ 开头
 */
export function validateAssetPath(path: string): string | null {
  if (typeof path !== "string" || path.trim() === "") {
    return "Path must be a non-empty string";
  }

  // 禁止反斜杠
  if (path.includes("\\")) {
    return `Path must use forward slashes (/), not backslashes: "${path}"`;
  }

  // 禁止绝对路径（以 / 开头）
  if (path.startsWith("/")) {
    return `Absolute paths are not allowed: "${path}"`;
  }

  // 禁止盘符（Windows）
  if (/^[a-zA-Z]:/.test(path)) {
    return `Drive letters are not allowed: "${path}"`;
  }

  // 禁止跳出 assets
  if (path === ".." || path.startsWith("../") || path.includes("/../")) {
    return `Path traversal (../) is not allowed: "${path}"`;
  }

  // 禁止 assets/ 前缀（路径已经是相对于 assets 的）
  if (path.startsWith("assets/") || path === "assets") {
    return `Path should not include "assets/" prefix: "${path}"`;
  }

  // 禁止 . 开头（当前目录）
  if (path.startsWith("./")) {
    return `Path should not start with "./": "${path}"`;
  }

  return null; // 有效
}

/**
 * 解析资源路径（拼接 assetsRoot + relativePath）
 */
export function resolveAssetPath(assetsRoot: string, relativePath: string): string {
  const error = validateAssetPath(relativePath);
  if (error) {
    throw new Error(`Invalid asset reference "${relativePath}": ${error}`);
  }

  // 使用 POSIX 风格拼接
  if (assetsRoot.endsWith("/")) {
    return assetsRoot + relativePath;
  }
  return assetsRoot + "/" + relativePath;
}
