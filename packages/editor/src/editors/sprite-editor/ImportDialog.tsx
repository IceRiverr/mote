// ═══════════════════════════════════════════════════════════════
// ImportDialog.tsx — Blender-style centered modal import dialog
// Left side: file + mode + params | Right side: preview with grid overlay
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'preact/hooks';
import {
  importGridSpriteSheet,
  importPackedSpriteSheet,
  importXmlSpriteSheet,
  importLooseSpriteSheet,
  importMoteSpriteSheet,
} from '../../data/sprite-sheet-import';
import { isFileSystemAccessSupported } from '../../data/fs-access';
import { addSpriteSheet } from '../../store/spriteSheet';
import { createGridSpriteSheet } from '../../data/SpriteSheet';

type ImportMode = 'tilesheet' | 'packed' | 'xml' | 'loose' | 'mote';

interface Props {
  onClose: () => void;
}

interface PreviewInfo {
  imageUrl: string;
  width: number;
  height: number;
}

const MODE_LABELS: Record<ImportMode, { name: string; desc: string; icon: string }> = {
  tilesheet: { name: '网格 (Grid)', desc: '等距网格切片，适合瓦片图', icon: '▦' },
  packed: { name: 'JSON (Packed)', desc: 'TexturePacker 格式', icon: '{ }' },
  xml: { name: 'XML', desc: 'Sparrow/Starling 格式', icon: '</>' },
  loose: { name: '散图 (Loose)', desc: '多张图片合并成图集', icon: '📁' },
  mote: { name: 'Mote', desc: 'Mote 精灵格式 (支持碰撞体和标签)', icon: '◈' },
};

// ═══════════════════════════════════════════════════════════════
// Grid Preview Canvas — Draw slice grid overlay on image
// ═══════════════════════════════════════════════════════════════

function GridPreviewCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  tileW,
  tileH,
  margin,
  spacing,
}: {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  tileW: number;
  tileH: number;
  margin: number;
  spacing: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw preview
  useEffect(() => {
    if (!canvasRef.current || !image) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Calculate scaled dimensions to fit canvas
    const maxPreviewW = 400;
    const maxPreviewH = 300;
    const scale = Math.min(maxPreviewW / imageWidth, maxPreviewH / imageHeight, 1);
    const displayW = imageWidth * scale;
    const displayH = imageHeight * scale;
    
    canvas.width = displayW;
    canvas.height = displayH;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    
    // Clear
    ctx.clearRect(0, 0, displayW, displayH);
    
    // Draw image
    ctx.drawImage(image, 0, 0, displayW, displayH);
    
    // Calculate grid
    const cols = Math.floor((imageWidth - margin * 2 + spacing) / (tileW + spacing));
    const rows = Math.floor((imageHeight - margin * 2 + spacing) / (tileH + spacing));
    
    // Draw grid overlay
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    
    const cellW = tileW * scale;
    const cellH = tileH * scale;
    const marginPx = margin * scale;
    const spacingPx = spacing * scale;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = marginPx + col * (cellW + spacingPx);
        const y = marginPx + row * (cellH + spacingPx);
        ctx.strokeRect(x, y, cellW, cellH);
      }
    }
    
    ctx.setLineDash([]);
    
    // Draw frame count
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(4, 4, 80, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${cols * rows} 帧`, 8, 18);
  }, [image, imageWidth, imageHeight, tileW, tileH, margin, spacing]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        imageRendering: 'pixelated',
        border: '1px solid var(--border)',
        background: '#2a2a2a',
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Import Dialog Component
// ═══════════════════════════════════════════════════════════════

export function ImportDialog({ onClose }: Props) {
  const [mode, setMode] = useState<ImportMode>('tilesheet');
  const [preview, setPreview] = useState<PreviewInfo | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // For Mote format: auto-matched image file
  const [moteJsonData, setMoteJsonData] = useState<{ image: string } | null>(null);
  const [autoMatchedImage, setAutoMatchedImage] = useState<File | null>(null);
  const [needsManualImage, setNeedsManualImage] = useState(false);
  
  // Grid params
  const [tileW, setTileW] = useState(16);
  const [tileH, setTileH] = useState(16);
  const [margin, setMargin] = useState(0);
  const [spacing, setSpacing] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Read file as JSON
  const readFileAsJson = (file: File): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result as string)); }
        catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Handle file selection
  const handleFileSelect = async (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files || []);
    if (files.length === 0) return;
    
    setSelectedFiles(files);
    setError(null);
    setMoteJsonData(null);
    setAutoMatchedImage(null);
    setNeedsManualImage(false);
    
    // Find JSON file and image files
    const jsonFile = files.find(f => f.name.endsWith('.json'));
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
    
    // If Mote JSON found, try to auto-match image
    if (jsonFile && jsonFile.name.includes('.mote-sprite')) {
      try {
        const json = await readFileAsJson(jsonFile) as { image?: string };
        if (json.image) {
          setMoteJsonData({ image: json.image });
          
          // Try to find matching image file
          // json.image could be "foo.png" or "path/to/foo.png"
          const imageName = json.image.split('/').pop() || json.image;
          const matchedImage = imageFiles.find(f => 
            f.name.toLowerCase() === imageName.toLowerCase()
          );
          
          if (matchedImage) {
            setAutoMatchedImage(matchedImage);
            // Create preview
            const url = URL.createObjectURL(matchedImage);
            const img = new Image();
            img.onload = () => {
              setPreview({
                imageUrl: url,
                width: img.width,
                height: img.height,
              });
            };
            img.src = url;
          } else {
            setNeedsManualImage(true);
            setPreview(null);
          }
          return; // Skip default preview logic
        }
      } catch (e) {
        // Ignore parse error, continue with normal flow
      }
    }
    
    // Default: create preview for first image file
    if (imageFiles.length > 0) {
      const imageFile = imageFiles[0];
      const url = URL.createObjectURL(imageFile);
      const img = new Image();
      img.onload = () => {
        setPreview({
          imageUrl: url,
          width: img.width,
          height: img.height,
        });
      };
      img.src = url;
    } else {
      setPreview(null);
    }
  };

  // Handle manual image selection for Mote format
  const handleManualImageSelect = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    setAutoMatchedImage(file);
    setNeedsManualImage(false);
    
    // Create preview
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setPreview({
        imageUrl: url,
        width: img.width,
        height: img.height,
      });
    };
    img.src = url;
  };

  // Detect mode from files (smart detection)
  useEffect(() => {
    if (selectedFiles.length === 0) return;
    
    const jsonFile = selectedFiles.find(f => f.name.endsWith('.json'));
    const hasXml = selectedFiles.some(f => /\.(xml|txt)$/i.test(f.name));
    const hasImage = selectedFiles.some(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
    const isMoteJson = jsonFile && jsonFile.name.includes('.mote-sprite');
    
    // Check for Mote format: can be just JSON (auto-match) or JSON+Image
    if (isMoteJson) {
      setMode('mote');
    } else if (jsonFile && hasImage) {
      setMode('packed');
    } else if (hasXml && hasImage) {
      setMode('xml');
    } else if (selectedFiles.length >= 2 && selectedFiles.every(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name))) {
      setMode('loose');
    } else {
      setMode('tilesheet');
    }
  }, [selectedFiles]);

  // Calculate frame count
  const frameCount = preview && mode === 'tilesheet'
    ? Math.floor((preview.width - margin * 2 + spacing) / (tileW + spacing)) *
      Math.floor((preview.height - margin * 2 + spacing) / (tileH + spacing))
    : null;

  // Handle import using legacy file input
  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      setError('请选择文件');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      if (mode === 'tilesheet') {
        const imgFile = selectedFiles.find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!imgFile) throw new Error('未找到图片文件');
        const { sheet, img } = await importGridSpriteSheet(imgFile, tileW, tileH, margin, spacing, undefined, imgFile.name);
        addSpriteSheet(sheet, img);
      } else if (mode === 'mote') {
        const jsonFile = selectedFiles.find(f => f.name.endsWith('.json'));
        // Use auto-matched image or manually selected image
        const imgFile = autoMatchedImage || selectedFiles.find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile) throw new Error('需要 Mote JSON 文件');
        if (!imgFile) throw new Error('需要图片文件，请选择 ' + (moteJsonData?.image || '对应的 PNG 文件'));
        const { sheet, img } = await importMoteSpriteSheet(jsonFile, imgFile, undefined, imgFile.name);
        addSpriteSheet(sheet, img);
      } else if (mode === 'packed') {
        const jsonFile = selectedFiles.find(f => f.name.endsWith('.json'));
        const imgFile = selectedFiles.find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile || !imgFile) throw new Error('需要 JSON + 图片文件');
        const { sheet, img } = await importPackedSpriteSheet(jsonFile, imgFile, undefined, imgFile.name);
        addSpriteSheet(sheet, img);
      } else if (mode === 'xml') {
        const xmlFile = selectedFiles.find(f => /\.(xml|txt)$/i.test(f.name));
        const imgFile = selectedFiles.find(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!xmlFile || !imgFile) throw new Error('需要 XML + 图片文件');
        const { sheet, img } = await importXmlSpriteSheet(xmlFile, imgFile, undefined, imgFile.name);
        addSpriteSheet(sheet, img);
      } else {
        const imgFiles = selectedFiles.filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (imgFiles.length < 2) throw new Error('至少需要 2 张图片');
        const { sheet, img } = await importLooseSpriteSheet(imgFiles, undefined, 1, 'atlas.png');
        addSpriteSheet(sheet, img);
      }
      
      onClose();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // Handle import using File System Access API - file picker for Mote format
  const handleImportWithPicker = async () => {
    if (!isFileSystemAccessSupported()) {
      setError('您的浏览器不支持文件系统访问 API');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Pick the JSON file
      const [jsonHandle] = await window.showOpenFilePicker({
        types: [
          { description: 'Mote Sprite JSON', accept: { 'application/json': ['.json'] } },
        ],
        multiple: false,
      });
      
      const jsonFile = await jsonHandle.getFile();
      const jsonRaw = JSON.parse(await jsonFile.text()) as {
        type?: string;
        version?: string;
        id: string;
        name: string;
        image: string;
        slicing?: unknown;
        frames: unknown[];
      };
      
      // Validate file type
      if (jsonRaw.type && jsonRaw.type !== 'mote-sprite') {
        throw new Error(`不支持的文件类型: ${jsonRaw.type}，需要 mote-sprite`);
      }
      
      // Warn about version mismatch (but still try to load)
      if (jsonRaw.version && jsonRaw.version !== '1.0.0') {
        console.warn(`文件版本 ${jsonRaw.version} 可能与当前编辑器不兼容`);
      }
      
      const jsonData = jsonRaw;
      
      // Extract image filename from JSON
      const imageName = jsonData.image.split('/').pop() || jsonData.image;
      
      // Step 2: Pick the image file (show expected filename to user)
      setLoading(false);
      setError(`请选择对应的图片文件: ${imageName}`);
      
      const [imageHandle] = await window.showOpenFilePicker({
        types: [
          { description: `Image Files (looking for: ${imageName})`, accept: { 
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/webp': ['.webp'],
            'image/gif': ['.gif'],
          }},
        ],
        multiple: false,
      });
      
      setLoading(true);
      setError(null);
      
      const imageFile = await imageHandle.getFile();
      const url = URL.createObjectURL(imageFile);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      
      const { spriteSheetFromJson } = await import('../../data/io-v2');
      const sheet = spriteSheetFromJson({
        type: 'mote-sprite',
        version: '1.0.0',
        id: jsonData.id,
        name: jsonData.name,
        image: imageFile.name,
        slicing: (jsonData.slicing as any) || { mode: 'packed' },
        frames: jsonData.frames as any,
      }, url);
      
      addSpriteSheet(sheet, img);
      onClose();
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click outside to close
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-sidebar)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          width: 720,
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-bright)' }}>
            导入精灵图
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 18,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left side: File + Mode + Params */}
          <div
            style={{
              width: 280,
              minWidth: 280,
              padding: 16,
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
            }}
          >
            {/* File Selection */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                文件
              </div>
              
              {/* File picker button for Mote format */}
              {isFileSystemAccessSupported() && (
                <button
                  onClick={handleImportWithPicker}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    marginBottom: 12,
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? '导入中...' : '📂 打开文件选择器...'}
                </button>
              )}
              
              {isFileSystemAccessSupported() && (
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
                  先选 .mote-sprite.json，再选对应图片
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.gif,.json,.xml,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-input)',
                  border: '1px dashed var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                }}
              >
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} 个文件已选择`
                  : '+ 选择文件...'}
              </button>
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-secondary)' }}>
                  {selectedFiles.map(f => (
                    <div key={f.name} style={{ marginBottom: 2 }}>• {f.name}</div>
                  ))}
                </div>
              )}
              
              {/* Mote format: auto-match status */}
              {mode === 'mote' && moteJsonData && (
                <div style={{ marginTop: 12, padding: '8px', background: 'var(--bg-input)', borderRadius: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    JSON 中指定的图片:
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-bright)', fontFamily: 'monospace' }}>
                    {moteJsonData.image}
                  </div>
                  
                  {autoMatchedImage ? (
                    <div style={{ marginTop: 8, fontSize: 10, color: '#60c060', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>✓</span>
                      <span>已自动匹配: {autoMatchedImage.name}</span>
                    </div>
                  ) : needsManualImage ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: '#e06060', marginBottom: 6 }}>
                        ⚠ 未找到同名图片文件
                      </div>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,.gif"
                        onChange={handleManualImageSelect}
                        style={{ display: 'none' }}
                      />
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--accent)',
                          border: 'none',
                          borderRadius: 3,
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: 10,
                        }}
                      >
                        + 选择图片文件
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Mode Selection (only show when files selected) */}
            {selectedFiles.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  导入方式
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(Object.keys(MODE_LABELS) as ImportMode[]).map((m) => (
                    <label
                      key={m}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '8px',
                        background: mode === m ? 'rgba(74, 144, 217, 0.15)' : 'transparent',
                        border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        checked={mode === m}
                        onChange={() => setMode(m)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-bright)', fontWeight: mode === m ? 'bold' : 'normal' }}>
                          {MODE_LABELS[m].icon} {MODE_LABELS[m].name}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {MODE_LABELS[m].desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Grid Params (only for tilesheet mode) */}
            {selectedFiles.length > 0 && mode === 'tilesheet' && preview && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  网格参数
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>瓦片宽度</label>
                    <input
                      type="number"
                      value={tileW}
                      onChange={(e) => setTileW(parseInt((e.target as HTMLInputElement).value) || 1)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-bright)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>瓦片高度</label>
                    <input
                      type="number"
                      value={tileH}
                      onChange={(e) => setTileH(parseInt((e.target as HTMLInputElement).value) || 1)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-bright)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>边距</label>
                    <input
                      type="number"
                      value={margin}
                      onChange={(e) => setMargin(parseInt((e.target as HTMLInputElement).value) || 0)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-bright)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>间距</label>
                    <input
                      type="number"
                      value={spacing}
                      onChange={(e) => setSpacing(parseInt((e.target as HTMLInputElement).value) || 0)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 3,
                        color: 'var(--text-bright)',
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
                {frameCount !== null && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)' }}>
                    预计生成: {frameCount} 帧
                  </div>
                )}
              </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Error */}
            {error && (
              <div style={{ padding: 8, background: 'rgba(220, 60, 60, 0.15)', borderRadius: 4, fontSize: 11, color: '#e06060' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={loading || selectedFiles.length === 0}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  cursor: loading || selectedFiles.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  fontWeight: 'bold',
                  opacity: loading || selectedFiles.length === 0 ? 0.6 : 1,
                }}
              >
                {loading ? '导入中...' : '导入'}
              </button>
            </div>
          </div>

          {/* Right side: Preview */}
          <div
            style={{
              flex: 1,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-canvas)',
            }}
          >
            {!preview ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🖼️</div>
                <div style={{ fontSize: 13 }}>选择图片后在此预览</div>
                <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6 }}>
                  支持 PNG, JPG, WEBP, GIF 格式
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {preview.width} × {preview.height} px
                </div>
                {mode === 'tilesheet' ? (
                  <GridPreviewCanvas
                    imageUrl={preview.imageUrl}
                    imageWidth={preview.width}
                    imageHeight={preview.height}
                    tileW={tileW}
                    tileH={tileH}
                    margin={margin}
                    spacing={spacing}
                  />
                ) : (
                  <img
                    src={preview.imageUrl}
                    alt="Preview"
                    style={{
                      maxWidth: 400,
                      maxHeight: 300,
                      objectFit: 'contain',
                      border: '1px solid var(--border)',
                      imageRendering: 'pixelated',
                    }}
                  />
                )}
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {mode === 'tilesheet' ? '红色网格显示切片边界' : MODE_LABELS[mode].desc}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
