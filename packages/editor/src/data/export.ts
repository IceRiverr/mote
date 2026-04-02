import type { TileMap } from "./TileMap";
import type { TileSet } from "./TileSet";

export interface ExportData {
  version: "1.0";
  type: "tilemap";
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: ExportTileSet[];
  layers: ExportLayer[];
}

interface ExportTileSet {
  name: string;
  image: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  firstGid: number;
  tileCount: number;
  margin: number;
  spacing: number;
}

interface ExportLayer {
  name: string;
  type: "tilelayer";
  visible: boolean;
  opacity: number;
  data: number[];
}

export function exportTileMap(
  map: TileMap,
  tilesets: Map<string, TileSet>
): ExportData {
  return {
    version: "1.0",
    type: "tilemap",
    name: map.name,
    width: map.width,
    height: map.height,
    tileWidth: map.tileWidth,
    tileHeight: map.tileHeight,
    tilesets: map.tilesets.map((ref) => {
      const ts = tilesets.get(ref.tilesetId)!;
      return {
        name: ts.name,
        image: ts.name + ".png",
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        columns: ts.columns,
        rows: ts.rows,
        firstGid: ref.firstGid,
        tileCount: ts.tileCount,
        margin: ts.margin,
        spacing: ts.spacing,
      };
    }),
    layers: map.layers.map((layer) => ({
      name: layer.name,
      type: "tilelayer",
      visible: layer.visible,
      opacity: layer.opacity,
      data: Array.from(layer.data),
    })),
  };
}

export function downloadJson(data: ExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.name}.weichen.json`;
  a.click();
  URL.revokeObjectURL(url);
}
