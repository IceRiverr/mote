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
  const sprite = prefab.components.Sprite;

  useEffect(() => {
    if (!sprite?.atlas || !sprite?.frame) return;

    const atlas = sprite.atlas as string;
    const frameId = sprite.frame as string;

    // 1. 通过 atlas 路径找到对应的 sheet
    const sheet = spriteSheets.value.find((s) => s.image === atlas || s.sourcePath === atlas);
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

    // 设置 canvas 尺寸为帧尺寸（但限制最大 size）
    const scale = Math.min(size / frame.w, size / frame.h, 1);
    const drawW = frame.w * scale;
    const drawH = frame.h * scale;

    canvas.width = Math.round(drawW);
    canvas.height = Math.round(drawH);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制帧区域
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
    const sheet = spriteSheets.value.find((s) => s.image === atlas || s.sourcePath === atlas);
    const frame = sheet?.frames[frameId];

    if (sheet && frame) {
      const img = spriteSheetImages.value.get(sheet.id);
      if (img?.complete) {
        return (
          <canvas
            ref={canvasRef}
            style={{
              imageRendering: 'pixelated',
              maxWidth: size,
              maxHeight: size,
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
