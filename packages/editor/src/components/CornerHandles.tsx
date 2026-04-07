import { useRef, useState } from 'preact/hooks';
import { Corner } from '../layout/types';
import { useDrag } from '../hooks/useDrag';

interface Props {
  areaId: string;
  onSplit: (corner: Corner, direction: 'horizontal' | 'vertical', ratio: number) => void;
}

const CORNER_SIZE = 12;
const HIT_AREA_SIZE = 20; // Larger hit area for easier grabbing
const DRAG_THRESHOLD = 20;

interface CornerConfig {
  corner: Corner;
  style: { left?: number; right?: number; top?: number; bottom?: number };
  cursor: string;
}

const corners: CornerConfig[] = [
  { corner: 'tl', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { corner: 'tr', style: { right: 0, top: 0 }, cursor: 'nesw-resize' },
  { corner: 'bl', style: { left: 0, bottom: 0 }, cursor: 'nesw-resize' },
  { corner: 'br', style: { right: 0, bottom: 0 }, cursor: 'nwse-resize' },
];

// Helper to get margin for hit area expansion
const getHitAreaOffset = (corner: Corner) => {
  const offset = (HIT_AREA_SIZE - CORNER_SIZE) / 2;
  switch (corner) {
    case 'tl': return { marginLeft: -offset, marginTop: -offset };
    case 'tr': return { marginRight: -offset, marginTop: -offset };
    case 'bl': return { marginLeft: -offset, marginBottom: -offset };
    case 'br': return { marginRight: -offset, marginBottom: -offset };
  }
};

export function CornerHandles({ areaId, onSplit }: Props) {
  const [draggingCorner, setDraggingCorner] = useState<Corner | null>(null);
  const [previewDirection, setPreviewDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [previewPosition, setPreviewPosition] = useState<number>(50); // percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; corner: Corner } | null>(null);

  const { onPointerDown } = useDrag({
    onStart(e) {
      // Get corner from data attribute
      const target = e.currentTarget as HTMLElement;
      const corner = target.dataset.corner as Corner;
      if (!corner) return;

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        corner,
      };
      setDraggingCorner(corner);
    },
    onMove(e) {
      if (!dragStartRef.current || !containerRef.current) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const container = containerRef.current.parentElement;

      if (distance > DRAG_THRESHOLD && container) {
        // Determine direction based on drag vector
        const direction = Math.abs(dx) > Math.abs(dy) ? 'vertical' : 'horizontal';
        setPreviewDirection(direction);
        
        // Calculate preview position based on mouse position
        const rect = container.getBoundingClientRect();
        let position: number;
        if (direction === 'horizontal') {
          // Horizontal split line - position is vertical percentage
          const localY = e.clientY - rect.top;
          position = (localY / rect.height) * 100;
        } else {
          // Vertical split line - position is horizontal percentage
          const localX = e.clientX - rect.left;
          position = (localX / rect.width) * 100;
        }
        setPreviewPosition(Math.max(10, Math.min(90, position)));
      } else {
        setPreviewDirection(null);
      }
    },
    onEnd(e) {
      if (!dragStartRef.current || !containerRef.current) return;

      const { x, y, corner } = dragStartRef.current;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > DRAG_THRESHOLD) {
        // Calculate ratio based on direction and container size
        const container = containerRef.current.parentElement;
        if (container) {
          const rect = container.getBoundingClientRect();
          const direction = Math.abs(dx) > Math.abs(dy) ? 'vertical' : 'horizontal';
          
          // Calculate ratio based on drag end position relative to container
          // The new area will take up space based on how far we dragged
          let ratio: number;
          if (direction === 'horizontal') {
            // Vertical split line - ratio is horizontal position
            const localX = e.clientX - rect.left;
            ratio = localX / rect.width;
          } else {
            // Horizontal split line - ratio is vertical position  
            const localY = e.clientY - rect.top;
            ratio = localY / rect.height;
          }
          
          // Clamp between 0.2 and 0.8 to prevent too small panels
          ratio = Math.max(0.2, Math.min(0.8, ratio));
          
          onSplit(corner, direction, ratio);
        }
      }

      dragStartRef.current = null;
      setDraggingCorner(null);
      setPreviewDirection(null);
      setPreviewPosition(50);
    },
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {corners.map(({ corner, style, cursor }) => (
        <div
          key={corner}
          data-corner={corner}
          onPointerDown={onPointerDown as any}
          style={{
            position: 'absolute',
            width: CORNER_SIZE,
            height: CORNER_SIZE,
            ...style,
            ...getHitAreaOffset(corner),
            pointerEvents: 'auto',
            cursor,
            opacity: draggingCorner === corner ? 1 : 0,
            transition: 'opacity 0.15s',
            background: draggingCorner === corner ? '#0af' : '#666',
            borderRadius: corner === 'tl' ? '0 0 4px 0' :
                          corner === 'tr' ? '0 0 0 4px' :
                          corner === 'bl' ? '0 4px 0 0' : '4px 0 0 0',
            zIndex: 30,
          }}
          className="corner-handle"
        />
      ))}
      
      {/* Preview line */}
      {previewDirection && draggingCorner && (
        <div
          style={{
            position: 'absolute',
            background: '#0af',
            opacity: 0.5,
            pointerEvents: 'none',
            ...(previewDirection === 'horizontal'
              ? { left: 0, right: 0, top: `${previewPosition}%`, height: 2, transform: 'translateY(-1px)' }
              : { top: 0, bottom: 0, left: `${previewPosition}%`, width: 2, transform: 'translateX(-1px)' }
            ),
          }}
        />
      )}
    </div>
  );
}
