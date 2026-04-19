import { Rect, Corner } from '../layout/types';
import { getEditor, getAllEditors } from '../editors/registry';
import { setEditorType, splitAreaFromCorner, mergeArea, findParent } from '../layout/tree';
import { layoutTree } from '../store/layout';
import { CornerHandles } from './CornerHandles';

interface Props {
  areaId: string;
  editorType: string;
  rect: Rect;
}

export function AreaView({ areaId, editorType, rect }: Props) {
  const editor = getEditor(editorType);
  const allEditors = getAllEditors();

  const handleSwitch = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    layoutTree.value = setEditorType(layoutTree.value, areaId, val);
  };

  const handleSplit = (corner: Corner, direction: 'horizontal' | 'vertical', ratio: number) => {
    layoutTree.value = splitAreaFromCorner(layoutTree.value, areaId, corner, direction, ratio);
  };

  const handleMerge = () => {
    layoutTree.value = mergeArea(layoutTree.value, areaId);
  };

  // Check if this area can be merged (has adjacent area in the layout)
  const canMerge = (() => {
    const parentInfo = findParent(layoutTree.value, areaId);
    if (!parentInfo) return false;

    const { index } = parentInfo;
    const siblingIndex = index === 0 ? 1 : 0;
    const sibling = parentInfo.node.children[siblingIndex];

    // Can merge if sibling is an area or a split containing areas
    return sibling.type === 'area' || sibling.type === 'split';
  })();

  const Comp = editor?.component;

  return (
    <div
      className="area-view"
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        display: 'flex',
        flexDirection: 'column',
        background: '#252525',
        borderRight: '1px solid #111',
        borderBottom: '1px solid #111',
        overflow: 'hidden',
      }}
    >
      {/* Area Header — Blender 风格：左侧 Editor Type，右侧编辑器工具 */}
      <div style={{
        height: 28,
        background: '#2d2d2d',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        gap: 6,
        flexShrink: 0,
      }}>
        {/* 左侧：Editor Type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{editor?.icon ?? '◻'}</span>
          <select
            value={editorType}
            onChange={handleSwitch}
            style={{
              background: '#333',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: 3,
              fontSize: 11,
              padding: '1px 4px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {allEditors.map((ed) => (
              <option key={ed.id} value={ed.id}>{ed.name}</option>
            ))}
          </select>
        </div>

        {/* 右侧：编辑器专属 Header 工具 */}
        {editor?.header && <editor.header areaId={areaId} />}
      </div>

      {/* Editor Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {Comp ? <Comp areaId={areaId} /> : <div style={{ padding: 12, color: '#666' }}>Unknown editor: {editorType}</div>}
      </div>

      {/* Corner Split Handles */}
      <CornerHandles areaId={areaId} onSplit={handleSplit} onMerge={handleMerge} canMerge={canMerge} />
    </div>
  );
}
