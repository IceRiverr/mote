/**
 * Asset Browser Editor - 资源浏览器
 * 
 * 显示项目中的所有资源文件
 */

import { useState } from "preact/hooks";

interface AssetItem {
  id: string;
  name: string;
  type: "folder" | "image" | "audio" | "script" | "data";
  path: string;
}

// Mock asset data
const mockAssets: AssetItem[] = [
  { id: "f1", name: "tilesets", type: "folder", path: "assets/tilesets" },
  { id: "f2", name: "sprites", type: "folder", path: "assets/sprites" },
  { id: "f3", name: "audio", type: "folder", path: "assets/audio" },
  { id: "f4", name: "scripts", type: "folder", path: "assets/scripts" },
  { id: "i1", name: "grass.png", type: "image", path: "assets/tilesets/grass.png" },
  { id: "i2", name: "dirt.png", type: "image", path: "assets/tilesets/dirt.png" },
  { id: "i3", name: "player.png", type: "image", path: "assets/sprites/player.png" },
  { id: "i4", name: "enemy.png", type: "image", path: "assets/sprites/enemy.png" },
  { id: "a1", name: "jump.wav", type: "audio", path: "assets/audio/jump.wav" },
  { id: "a2", name: "coin.mp3", type: "audio", path: "assets/audio/coin.mp3" },
  { id: "s1", name: "PlayerController.ts", type: "script", path: "assets/scripts/PlayerController.ts" },
  { id: "d1", name: "level1.json", type: "data", path: "assets/data/level1.json" },
];

const typeIcons: Record<string, string> = {
  folder: "📁",
  image: "🖼️",
  audio: "🔊",
  script: "📄",
  data: "📊",
};

export function AssetBrowserEditor() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredAssets = mockAssets.filter((asset) =>
    asset.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "6px", borderBottom: "1px solid var(--border)" }}>
        <input
          type="text"
          placeholder="Search assets..."
          value={filter}
          onChange={(e) => setFilter((e.target as HTMLInputElement).value)}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            class={`tree-item ${selectedId === asset.id ? "selected" : ""}`}
            onClick={() => setSelectedId(asset.id)}
          >
            <span class="tree-item__icon">{typeIcons[asset.type]}</span>
            <span class="tree-item__label">{asset.name}</span>
          </div>
        ))}
      </div>

      <div 
        style={{ 
          padding: "4px 8px", 
          borderTop: "1px solid var(--border)",
          color: "var(--text-secondary)",
          fontSize: "11px"
        }}
      >
        {filteredAssets.length} assets
      </div>
    </div>
  );
}
