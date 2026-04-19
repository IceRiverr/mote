// ═══════════════════════════════════════════════════════════════
// ContentBrowser.tsx - Content Browser 主组件
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'preact/hooks';
import { FolderTree } from './FolderTree';
import { AssetView } from './AssetView';
import {
  assetTree,
  scanAssets,
  selectedFolderPath,
} from '../../store/contentBrowser';
import { currentProject } from '../../project';

export function ContentBrowser({ areaId }: { areaId: string }) {
  // 项目变化时自动扫描
  useEffect(() => {
    if (currentProject.value) {
      scanAssets();
    }
  }, [currentProject.value?.id]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-panel)',
        color: 'var(--text-primary)',
        fontSize: 13,
        overflow: 'hidden',
      }}
    >
      {/* ── 主体：左树右视图 ── */}
      <div
        style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
      >
        {/* 左侧 Folder Tree */}
        <div
          style={{
            width: 160,
            minWidth: 120,
            maxWidth: 300,
            borderRight: '1px solid var(--border)',
            overflow: 'auto',
            resize: 'horizontal',
          }}
        >
          <FolderTree nodes={assetTree.value} />
        </div>

        {/* 右侧 Asset View */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AssetView areaId={areaId} />
        </div>
      </div>
    </div>
  );
}


