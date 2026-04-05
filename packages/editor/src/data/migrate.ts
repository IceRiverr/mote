// ═══════════════════════════════════════════════════════════════
// migrate.ts — Migration from old Mote formats to new unified types
// Converts:
//   TileSet       -> SpriteSheet
//   SpriteAtlas   -> SpriteSheet
//   TileMap.EntityDef -> EntityDef (new)
//   TileMap       -> Scene
//   BUILTIN_ENTITY_DEFS -> EntityDef[] (new)
// ═══════════════════════════════════════════════════════════════

import type { ColliderShape } from './Collider';
import type { TileSet } from './TileSet';
import type { SpriteAtlas } from './SpriteAtlas';
import type {
  TileMap,
  EntityDef as OldEntityDef,
  EntityInstance as OldEntityInstance,
} from './TileMap';
import { isTileLayer, isEntityLayer, BUILTIN_ENTITY_DEFS } from './TileMap';
import type { SpriteSheet, FrameData } from './SpriteSheet';
import { frameIdFromGridIndex } from './SpriteSheet';
import type {
  EntityDef,
  EntityInstance,
  EntityFieldDef,
} from './EntityDef';
import { formatSpriteRef } from './EntityDef';
import type { Scene, TileLayerData, EntityLayerData, SceneLayer } from './Scene';

// ═══════════════════════════════════════════════════════════════
// TileSet -> SpriteSheet
// ═══════════════════════════════════════════════════════════════

/**
 * Migrate an old TileSet to a new SpriteSheet.
 * - Integer tile IDs become string frame IDs ("frame_0", "frame_1", ...)
 * - Boolean collision data becomes ColliderShape[] ({ type: 'full' })
 * - TileData tags and properties are preserved on frames
 *
 * @param oldTileSet - The legacy TileSet
 * @param tilesetImage - Runtime image URL for the sprite sheet
 */
export function migrateTileSetToSpriteSheet(
  oldTileSet: TileSet,
  tilesetImage: string,
): SpriteSheet {
  const { columns, rows, tileWidth, tileHeight, margin, spacing } = oldTileSet;

  const frames: Record<string, FrameData> = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const localId = row * columns + col;
      const frameId = frameIdFromGridIndex(localId, columns);

      const x = margin + col * (tileWidth + spacing);
      const y = margin + row * (tileHeight + spacing);

      const frame: FrameData = {
        x,
        y,
        w: tileWidth,
        h: tileHeight,
      };

      // Migrate tile data if present
      const tileData = oldTileSet.tileData[localId];
      if (tileData) {
        // Convert boolean collision to ColliderShape[]
        if (tileData.collision) {
          frame.collider = [{ type: 'full' } as ColliderShape];
        }
        // Preserve tags
        if (tileData.tags && tileData.tags.length > 0) {
          frame.tags = [...tileData.tags];
        }
        // Preserve custom properties
        if (tileData.properties && Object.keys(tileData.properties).length > 0) {
          frame.properties = { ...tileData.properties };
        }
        // Note: animation data from TileData is not directly mappable
        // to the new FrameData format; it would need a separate
        // animation system. We store it in properties for reference.
        if (tileData.animation) {
          if (!frame.properties) frame.properties = {};
          frame.properties['_legacyAnimation'] = {
            frames: tileData.animation.frames,
            duration: tileData.animation.duration,
          };
        }
      }

      frames[frameId] = frame;
    }
  }

  return {
    id: oldTileSet.id,
    name: oldTileSet.name,
    image: tilesetImage,
    imageWidth: oldTileSet.imageWidth,
    imageHeight: oldTileSet.imageHeight,
    slicing: {
      mode: 'grid',
      tileWidth,
      tileHeight,
      margin: margin || undefined,
      spacing: spacing || undefined,
    },
    frames,
  };
}

// ═══════════════════════════════════════════════════════════════
// SpriteAtlas -> SpriteSheet
// ═══════════════════════════════════════════════════════════════

/**
 * Migrate an old SpriteAtlas to a new SpriteSheet.
 * - SpriteFrame entries become FrameData entries keyed by frame ID
 * - Source type determines slicing mode:
 *     "tilesheet" -> manual (since we have explicit frames, not grid math)
 *     "packed"    -> packed
 *     "loose"     -> manual
 *
 * @param oldAtlas - The legacy SpriteAtlas
 */
export function migrateSpriteAtlasToSpriteSheet(
  oldAtlas: SpriteAtlas,
): SpriteSheet {
  // Determine slicing mode from source type
  let slicing: SpriteSheet['slicing'];
  switch (oldAtlas.sourceType) {
    case 'packed':
      slicing = { mode: 'packed' };
      break;
    case 'tilesheet':
    case 'loose':
    default:
      slicing = { mode: 'manual' };
      break;
  }

  const frames: Record<string, FrameData> = {};
  for (const sf of oldAtlas.frames) {
    const frame: FrameData = {
      x: sf.x,
      y: sf.y,
      w: sf.width,
      h: sf.height,
    };
    if (sf.trimmed !== undefined) frame.trimmed = sf.trimmed;
    if (sf.sourceWidth !== undefined) frame.sourceWidth = sf.sourceWidth;
    if (sf.sourceHeight !== undefined) frame.sourceHeight = sf.sourceHeight;
    if (sf.offsetX !== undefined) frame.offsetX = sf.offsetX;
    if (sf.offsetY !== undefined) frame.offsetY = sf.offsetY;
    if (sf.rotated !== undefined) frame.rotated = sf.rotated;
    if (sf.tags && sf.tags.length > 0) frame.tags = [...sf.tags];

    frames[sf.id] = frame;
  }

  return {
    id: oldAtlas.id,
    name: oldAtlas.name,
    image: oldAtlas.imageUrl,
    imageWidth: oldAtlas.imageWidth,
    imageHeight: oldAtlas.imageHeight,
    slicing,
    frames,
  };
}

// ═══════════════════════════════════════════════════════════════
// Old EntityDef -> New EntityDef
// ═══════════════════════════════════════════════════════════════

/**
 * Migrate an old TileMap.EntityDef to the new EntityDef format.
 * Key changes:
 * - defaultWidth/defaultHeight -> width/height
 * - spriteAtlasId/spriteFrameId -> sprite ("sheetId:frameId")
 * - defId -> template (in instances)
 * - fieldValues -> fields (in instances)
 */
export function migrateOldEntityDef(oldDef: OldEntityDef): EntityDef {
  const newDef: EntityDef = {
    id: oldDef.id,
    name: oldDef.name,
    shape: oldDef.shape,
    width: oldDef.defaultWidth,
    height: oldDef.defaultHeight,
    resizable: oldDef.resizable,
    color: oldDef.color,
    icon: oldDef.icon,
    fields: oldDef.fields.map((f): EntityFieldDef => ({
      id: f.id,
      label: f.label,
      type: f.type,
      default: f.default,
    })),
  };

  // Convert sprite references
  if (oldDef.spriteAtlasId && oldDef.spriteFrameId) {
    newDef.sprite = formatSpriteRef(oldDef.spriteAtlasId, oldDef.spriteFrameId);
  }

  return newDef;
}

// ═══════════════════════════════════════════════════════════════
// Old EntityInstance -> New EntityInstance
// ═══════════════════════════════════════════════════════════════

/**
 * Migrate an old TileMap.EntityInstance to the new EntityInstance format.
 */
function migrateOldEntityInstance(oldInst: OldEntityInstance): EntityInstance {
  const newInst: EntityInstance = {
    id: oldInst.id,
    template: oldInst.defId,
    name: oldInst.name,
    x: oldInst.x,
    y: oldInst.y,
    width: oldInst.width,
    height: oldInst.height,
    fields: { ...oldInst.fieldValues },
    visible: oldInst.visible,
  };
  return newInst;
}

// ═══════════════════════════════════════════════════════════════
// TileMap -> Scene
// ═══════════════════════════════════════════════════════════════

/**
 * Migrate an old TileMap to a new Scene.
 * Key changes:
 * - GID integers in tile data -> frame ID strings ("frame_N")
 * - TileSetRef[] -> spriteSheets[] (IDs)
 * - Layers get spriteSheet reference and encoding mode
 * - Entity instances get migrated format
 *
 * @param oldMap - The legacy TileMap
 * @param tilesets - Array of TileSets referenced by the map (needed for GID resolution)
 */
export function migrateTileMapToScene(
  oldMap: TileMap,
  tilesets: TileSet[],
): Scene {
  // Build a lookup from tileset ID to TileSet for GID resolution
  const tilesetMap = new Map<string, TileSet>();
  for (const ts of tilesets) {
    tilesetMap.set(ts.id, ts);
  }

  // Build GID -> { tilesetId, localId } resolver
  // Sort tilesetRefs by firstGid descending for resolution
  const sortedRefs = [...oldMap.tilesets].sort((a, b) => b.firstGid - a.firstGid);

  function resolveGid(gid: number): { tilesetId: string; frameId: string } | null {
    if (gid <= 0) return null;
    for (const ref of sortedRefs) {
      if (gid >= ref.firstGid) {
        const localId = gid - ref.firstGid;
        const ts = tilesetMap.get(ref.tilesetId);
        if (ts) {
          return {
            tilesetId: ref.tilesetId,
            frameId: frameIdFromGridIndex(localId, ts.columns),
          };
        }
      }
    }
    return null;
  }

  // Collect all referenced spriteSheet IDs
  const spriteSheetIds = oldMap.tilesets.map((ref) => ref.tilesetId);

  // Determine the "primary" spriteSheet for tile layers
  // (old format didn't have per-layer spriteSheet, so we use the first one)
  const primarySpriteSheet = spriteSheetIds.length > 0 ? spriteSheetIds[0] : '';

  // Migrate layers
  const layers: SceneLayer[] = oldMap.layers.map((oldLayer) => {
    if (isTileLayer(oldLayer)) {
      // Convert GID data to frame ID strings
      const data: string[] = oldLayer.data.map((gid) => {
        if (gid <= 0) return '';
        const resolved = resolveGid(gid);
        if (!resolved) return '';
        return resolved.frameId;
      });

      const tileLayer: TileLayerData = {
        type: 'tile',
        id: oldLayer.id,
        name: oldLayer.name,
        visible: oldLayer.visible,
        opacity: oldLayer.opacity,
        locked: oldLayer.locked,
        color: oldLayer.color,
        spriteSheet: primarySpriteSheet,
        encoding: 'names',
        data,
      };
      return tileLayer;
    } else if (isEntityLayer(oldLayer)) {
      const entityLayer: EntityLayerData = {
        type: 'entity',
        id: oldLayer.id,
        name: oldLayer.name,
        visible: oldLayer.visible,
        opacity: oldLayer.opacity,
        locked: oldLayer.locked,
        color: oldLayer.color,
        entities: oldLayer.entities.map(migrateOldEntityInstance),
      };
      return entityLayer;
    }
    // Fallback (should not happen with well-formed data)
    return {
      type: 'entity' as const,
      id: (oldLayer as any).id,
      name: (oldLayer as any).name,
      visible: (oldLayer as any).visible,
      opacity: (oldLayer as any).opacity,
      locked: (oldLayer as any).locked,
      entities: [],
    } as EntityLayerData;
  });

  return {
    id: oldMap.id,
    name: oldMap.name,
    width: oldMap.width,
    height: oldMap.height,
    tileWidth: oldMap.tileWidth,
    tileHeight: oldMap.tileHeight,
    spriteSheets: spriteSheetIds,
    layers,
  };
}

// ═══════════════════════════════════════════════════════════════
// BUILTIN_ENTITY_DEFS migration
// ═══════════════════════════════════════════════════════════════

/**
 * Convert all BUILTIN_ENTITY_DEFS from TileMap.ts to the new EntityDef format.
 * Returns an array of new-format EntityDef objects.
 */
export function migrateBuiltinEntityDefs(): EntityDef[] {
  return BUILTIN_ENTITY_DEFS.map((oldDef): EntityDef => ({
    id: oldDef.id,
    name: oldDef.name,
    shape: oldDef.shape,
    width: oldDef.defaultWidth,
    height: oldDef.defaultHeight,
    resizable: oldDef.resizable,
    color: oldDef.color,
    icon: oldDef.icon,
    sprite: oldDef.spriteAtlasId && oldDef.spriteFrameId
      ? formatSpriteRef(oldDef.spriteAtlasId, oldDef.spriteFrameId)
      : undefined,
    fields: oldDef.fields.map((f): EntityFieldDef => ({
      id: f.id,
      label: f.label,
      type: f.type,
      default: f.default,
    })),
  }));
}
