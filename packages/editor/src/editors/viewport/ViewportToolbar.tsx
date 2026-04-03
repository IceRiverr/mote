import { activeTool, ToolType } from '../../store/selection';
import { exportStandalone } from '../../data/export';
import { currentMap, tilesets } from '../../store/project';

const tools: { id: ToolType; label: string; icon: string }[] = [
  { id: 'brush', label: 'Brush', icon: '🖌' },
  { id: 'eraser', label: 'Eraser', icon: '🧹' },
  { id: 'fill', label: 'Fill', icon: '🪣' },
  { id: 'eyedropper', label: 'Eyedropper', icon: '💉' },
];

export function ViewportToolbar() {
  const handleExport = () => {
    exportStandalone(currentMap.value, tilesets.value);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 6px',
      borderBottom: '1px solid #1a1a1a',
      background: '#2a2a2a',
      flexShrink: 0,
    }}>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => { activeTool.value = t.id; }}
          title={t.label}
          style={{
            background: activeTool.value === t.id ? '#4a6fa5' : '#333',
            color: '#fff',
            border: activeTool.value === t.id ? '1px solid #6a9fd5' : '1px solid #444',
            borderRadius: 3,
            padding: '2px 6px',
            fontSize: 13,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          {t.icon}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button
        onClick={handleExport}
        style={{
          background: '#3a7d4a',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          padding: '2px 10px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Export JSON
      </button>
    </div>
  );
}
