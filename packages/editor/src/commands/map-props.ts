import type { Command } from "../store/history";
import type { TileMap } from "../data/TileMap";
import { isTileLayer } from "../data/TileMap";
import { currentMap, bumpMapVersion } from "../store/project";

export class SetMapNameCommand implements Command {
  readonly label = "修改地图名称";
  private oldName: string;
  private newName: string;

  constructor(newName: string) {
    this.oldName = currentMap.value.name;
    this.newName = newName;
  }

  execute(): void {
    currentMap.value = { ...currentMap.value, name: this.newName };
    bumpMapVersion();
  }

  undo(): void {
    currentMap.value = { ...currentMap.value, name: this.oldName };
    bumpMapVersion();
  }
}

export class ResizeMapCommand implements Command {
  readonly label = "调整地图尺寸";
  private oldWidth: number;
  private oldHeight: number;
  private newWidth: number;
  private newHeight: number;
  private oldLayerData: Map<string, number[]>;

  constructor(newWidth: number, newHeight: number) {
    const map = currentMap.value;
    this.oldWidth = map.width;
    this.oldHeight = map.height;
    this.newWidth = newWidth;
    this.newHeight = newHeight;

    this.oldLayerData = new Map();
    for (const layer of map.layers) {
      if (isTileLayer(layer)) {
        this.oldLayerData.set(layer.id, [...layer.data]);
      }
    }
  }

  execute(): void {
    this.resize(this.newWidth, this.newHeight, this.oldWidth, this.oldHeight);
  }

  undo(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      width: this.oldWidth,
      height: this.oldHeight,
      layers: map.layers.map((l) => {
        if (isTileLayer(l)) {
          const data = this.oldLayerData.get(l.id);
          return data ? { ...l, data: [...data] } : l;
        }
        return l;
      }),
    };
    bumpMapVersion();
  }

  private resize(
    newW: number,
    newH: number,
    oldW: number,
    _oldH: number
  ): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      width: newW,
      height: newH,
      layers: map.layers.map((l) => {
        if (!isTileLayer(l)) return l;
        const srcW = l.data.length > 0 ? oldW : newW;
        const srcH = Math.floor(l.data.length / (srcW || 1));
        const newData = new Array(newW * newH).fill(0);
        const copyW = Math.min(srcW, newW);
        const copyH = Math.min(srcH, newH);
        for (let y = 0; y < copyH; y++) {
          for (let x = 0; x < copyW; x++) {
            newData[y * newW + x] = l.data[y * srcW + x] ?? 0;
          }
        }
        return { ...l, data: newData };
      }),
    };
    bumpMapVersion();
  }
}
