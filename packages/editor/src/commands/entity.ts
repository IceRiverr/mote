import type { Command } from "../store/history";
import type { EntityInstance } from "../data/TileMap";
import { isEntityLayer } from "../data/TileMap";
import { currentMap, bumpMapVersion } from "../store/project";

// ---------------------------------------------------------------------------
// AddEntityCommand
// ---------------------------------------------------------------------------
export class AddEntityCommand implements Command {
  readonly label = "\u653e\u7f6e\u5b9e\u4f53";

  constructor(
    private layerId: string,
    private entity: EntityInstance,
  ) {}

  execute(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: [...l.entities, this.entity] };
      }),
    };
    bumpMapVersion();
  }

  undo(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: l.entities.filter((e) => e.id !== this.entity.id) };
      }),
    };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// RemoveEntityCommand
// ---------------------------------------------------------------------------
export class RemoveEntityCommand implements Command {
  readonly label = "\u5220\u9664\u5b9e\u4f53";
  private entity: EntityInstance | null = null;
  private layerId: string;

  constructor(layerId: string, entityId: string) {
    this.layerId = layerId;
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === layerId);
    if (layer && isEntityLayer(layer)) {
      this.entity = layer.entities.find((e) => e.id === entityId) ?? null;
    }
  }

  execute(): void {
    if (!this.entity) return;
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: l.entities.filter((e) => e.id !== this.entity!.id) };
      }),
    };
    bumpMapVersion();
  }

  undo(): void {
    if (!this.entity) return;
    const map = currentMap.value;
    const entity = this.entity;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: [...l.entities, entity] };
      }),
    };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// MoveEntityCommand
// ---------------------------------------------------------------------------
export class MoveEntityCommand implements Command {
  readonly label = "\u79fb\u52a8\u5b9e\u4f53";

  constructor(
    private layerId: string,
    private entityId: string,
    private oldX: number,
    private oldY: number,
    private newX: number,
    private newY: number,
  ) {}

  execute(): void {
    this.apply(this.newX, this.newY);
  }

  undo(): void {
    this.apply(this.oldX, this.oldY);
  }

  private apply(x: number, y: number): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return {
          ...l,
          entities: l.entities.map((e) =>
            e.id === this.entityId ? { ...e, x, y } : e
          ),
        };
      }),
    };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// SetEntityPropertyCommand
// ---------------------------------------------------------------------------
export class SetEntityPropertyCommand<K extends keyof EntityInstance> implements Command {
  readonly label: string;
  private layerId: string;
  private entityId: string;
  private key: K;
  private oldValue: EntityInstance[K];
  private newValue: EntityInstance[K];

  constructor(
    layerId: string,
    entityId: string,
    key: K,
    newValue: EntityInstance[K],
    label?: string,
  ) {
    this.layerId = layerId;
    this.entityId = entityId;
    this.key = key;
    this.newValue = newValue;
    this.label = label ?? `\u4fee\u6539\u5b9e\u4f53 ${String(key)}`;

    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === layerId);
    if (layer && isEntityLayer(layer)) {
      const entity = layer.entities.find((e) => e.id === entityId);
      this.oldValue = entity ? entity[key] : newValue;
    } else {
      this.oldValue = newValue;
    }
  }

  execute(): void {
    this.apply(this.newValue);
  }

  undo(): void {
    this.apply(this.oldValue);
  }

  private apply(value: EntityInstance[K]): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return {
          ...l,
          entities: l.entities.map((e) =>
            e.id === this.entityId ? { ...e, [this.key]: value } : e
          ),
        };
      }),
    };
    bumpMapVersion();
  }
}
