// ═══════════════════════════════════════════════════════════════
// PrefabThumbnail.tsx — 从 Prefab 的 Sprite 组件渲染实际帧缩略图
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect } from 'preact/hooks';
import type { Prefab } from '../../data/Prefab';
import { spriteSheets, spriteSheetImages } from '../../store/spriteSheet';

interface PrefabThumbnailProps {
  prefab: Prefab;
  size?: number;
}

export function PrefabThumbnail({ prefab, size = 80 }: PrefabThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimRef = useRef({ w: 0, h: 0 });
  const sprite = prefab.components.Sprite;

  useEffect(() => {
    if (!sprite?.atlas || !sprite?.frame) return;

    const atlas = sprite.atlas as string;
    const frameId = sprite.frame as string;

    // 1. 通过 atlas 路径找到对应的 sheet（匹配 jsonPath / sourcePath / image）
    const sheet = spriteSheets.value.find(
      (s) => s.jsonPath === atlas || s.sourcePath === atlas || s.image === atlas,
    );
    if (!sheet) return;

    // 2. 获取帧数据
    const frame = sheet.frames[frameId];
    if (!frame) return;

    // 3. 获取图片
    const img = spriteSheetImages.value.get(sheet.id);
    if (!img || !img.complete) return;

    // 4. Canvas 截取帧区域
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸：小精灵放大、大精灵缩小，始终适配容器
    const scale = Math.min(size / frame.w, size / frame.h);
    const drawW = Math.round(frame.w * scale);
    const drawH = Math.round(frame.h * scale);

    canvas.width = drawW;
    canvas.height = drawH;
    dimRef.current = { w: drawW, h: drawH };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 像素风：禁用平滑过滤
    ctx.imageSmoothingEnabled = false;

    // 绘制帧区域（使用整数坐标避免子像素模糊）
    ctx.drawImage(
      img,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      drawW,
      drawH,
    );
  }, [prefab, size]);

  // 如果有 Sprite 组件且 atlas/frame 有效，尝试渲染 canvas
  if (sprite?.atlas && sprite?.frame) {
    const atlas = sprite.atlas as string;
    const frameId = sprite.frame as string;
    const sheet = spriteSheets.value.find(
      (s) => s.jsonPath === atlas || s.sourcePath === atlas || s.image === atlas,
    );
    const frame = sheet?.frames[frameId];

    if (sheet && frame) {
      const img = spriteSheetImages.value.get(sheet.id);
      if (img?.complete) {
        // 复用 useEffect 中已计算的尺寸，确保 canvas 内部像素和 CSS 显示像素 1:1 对齐
        const { w, h } = dimRef.current;
        const styleW = w || Math.round(frame.w * Math.min(size / frame.w, size / frame.h));
        const styleH = h || Math.round(frame.h * Math.min(size / frame.w, size / frame.h));
        return (
          <canvas
            ref={canvasRef}
            style={{
              imageRendering: 'pixelated',
              width: styleW,
              height: styleH,
            }}
            title={`${atlas}:${frameId} (${frame.w}×${frame.h})`}
          />
        );
      }
    }
  }

  // Fallback：无 Sprite / 无对应 sheet / 图片未加载
  const hasSprite = !!sprite;
  return (
    <span style={{ fontSize: size * 0.5, opacity: 0.5 }}>
      {hasSprite ? '🎨' : '📦'}
    </span>
  );
}
