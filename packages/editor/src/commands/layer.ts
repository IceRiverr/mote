import type { Command } from "../store/history";
import type { MapLayer } from "../data/TileMap";
import { isTileLayer } from "../data/TileMap";
import { currentMap, activeLayerId, bumpMapVersion } from "../store/project";

// ---------------------------------------------------------------------------
// AddLayerCommand
// ---------------------------------------------------------------------------
export class AddLayerCommand implements Command {
  readonly label = "添加图层";
  private layer: MapLayer;
  private prevActiveId: string;

  constructor(layer: MapLayer) {
    this.layer = layer;
    this.prevActiveId = activeLayerId.value;
  }

  execute(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: [...map.layers, this.layer],
    };
    activeLayerId.value = this.layer.id;
    bumpMapVersion();
  }

  undo(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.filter((l) => l.id !== this.layer.id),
    };
    activeLayerId.value = this.prevActiveId;
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// RemoveLayerCommand
// ---------------------------------------------------------------------------
export class RemoveLayerCommand implements Command {
  readonly label = "删除图层";
  private layer: MapLayer;
  private index: number;
  private prevActiveId: string;

  constructor(layerId: string) {
    const map = currentMap.value;
    const idx = map.layers.findIndex((l) => l.id === layerId);
    const src = map.layers[idx];
    if (isTileLayer(src)) {
      this.layer = { ...src, data: [...src.data] };
    } else {
      this.layer = { ...src, entities: [...src.entities] };
    }
    this.index = idx;
    this.prevActiveId = activeLayerId.value;
  }

  execute(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.filter((l) => l.id !== this.layer.id),
    };
    if (activeLayerId.value === this.layer.id) {
      activeLayerId.value = currentMap.value.layers[0]?.id ?? "";
    }
    bumpMapVersion();
  }

  undo(): void {
    const map = currentMap.value;
    const newLayers = [...map.layers];
    newLayers.splice(this.index, 0, this.layer);
    currentMap.value = { ...map, layers: newLayers };
    activeLayerId.value = this.prevActiveId;
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// MoveLayerCommand
// ---------------------------------------------------------------------------
export class MoveLayerCommand implements Command {
  readonly label: string;
  private layerId: string;
  private dir: -1 | 1;

  constructor(layerId: string, dir: -1 | 1) {
    this.layerId = layerId;
    this.dir = dir;
    this.label = dir === -1 ? "上移图层" : "下移图层";
  }

  execute(): void {
    this.swap(this.dir);
  }

  undo(): void {
    this.swap(-this.dir as -1 | 1);
  }

  private swap(dir: -1 | 1): void {
    const map = currentMap.value;
    const idx = map.layers.findIndex((l) => l.id === this.layerId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= map.layers.length) return;
    const newLayers = [...map.layers];
    [newLayers[idx], newLayers[newIdx]] = [newLayers[newIdx], newLayers[idx]];
    currentMap.value = { ...map, layers: newLayers };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// SetLayerPropertyCommand
// ---------------------------------------------------------------------------
type LayerBaseKey = "name" | "visible" | "opacity" | "locked" | "color";

export class SetLayerPropertyCommand<K extends LayerBaseKey> implements Command {
  readonly label: string;
  private layerId: string;
  private key: K;
  private oldValue: MapLayer[K];
  private newValue: MapLayer[K];

  constructor(layerId: string, key: K, newValue: MapLayer[K], label?: string) {
    this.layerId = layerId;
    this.key = key;
    this.newValue = newValue;
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === layerId)!;
    this.oldValue = layer[key] as MapLayer[K];
    this.label = label ?? `修改图层 ${String(key)}`;
  }

  execute(): void {
    this.apply(this.newValue);
  }

  undo(): void {
    this.apply(this.oldValue);
  }

  private apply(value: MapLayer[K]): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === this.layerId ? { ...l, [this.key]: value } : l
      ),
    };
    bumpMapVersion();
  }
}
