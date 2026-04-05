/**
 * track-data.ts — Load compact .track.json and generate full SceneData.
 *
 * The track file defines road segments (with center offsets), start/finish lines,
 * opponents, pickups, and hazards. This module generates a complete tile map
 * (21 cols x 1500 rows) and an entity layer from that compact description.
 *
 * Tile layout per row (road width = 5 lanes = 15 tiles, shoulder = 1 tile each side,
 * curb = 1 tile each side, rest = grass):
 *
 *   [grass...][shoulder_l][curb_l][road x15][curb_r][shoulder_r][grass...]
 *
 * Road tiles alternate between asphalt and lane_dash to create lane markers.
 * The road center column shifts based on the current segment's centerOffset.
 */

import type { SceneData } from '@mote/engine';

// ── Track config types ──────────────────────────────────────────────────────

export interface TrackSegment {
  from: number;
  to: number;
  centerOffset: number;
  scenery: string;
}

export interface OpponentConfig {
  riderName: string;
  color: string;
  startLane: number;
  startRow: number;
  maxSpeed: number;
  acceleration: number;
  aggressiveness: number;
  skillLevel: number;
}

export interface PickupConfig {
  type: string;          // "weapon" | "nitro" | "health"
  weaponType?: string;   // for weapon pickups
  amount?: number;       // for nitro/health pickups
  lane: number;
  row: number;
}

export interface HazardConfig {
  type: string;          // "oil_slick" | "pothole" | "cone"
  lane: number;
  row: number;
  width?: number;        // in lanes
}

export interface TrackConfig {
  id: string;
  name: string;
  length: number;        // total rows (1500)
  roadWidth: number;     // lanes (5)
  mapWidth: number;      // columns (21)
  defaultRoadCenter: number; // center column (10)
  segments: TrackSegment[];
  startLine: number;     // row number (1450)
  finishLine: number;    // row number (50)
  opponents: OpponentConfig[];
  pickups: PickupConfig[];
  hazards: HazardConfig[];
}

// ── Load track config from JSON ─────────────────────────────────────────────

export async function loadTrack(trackUrl: string): Promise<TrackConfig> {
  const res = await fetch(trackUrl);
  if (!res.ok) {
    throw new Error(`Failed to load track: ${trackUrl} (HTTP ${res.status})`);
  }
  return res.json() as Promise<TrackConfig>;
}

// ── Find which segment a row belongs to ─────────────────────────────────────

/**
 * Get the road center column for a given row based on the track segments.
 * Interpolates smoothly between segments with different centerOffsets.
 */
export function getRoadCenterForRow(
  row: number,
  track: TrackConfig,
): number {
  let currentSegment: TrackSegment | null = null;
  let nextSegment: TrackSegment | null = null;

  for (let i = 0; i < track.segments.length; i++) {
    const seg = track.segments[i];
    if (row >= seg.from && row < seg.to) {
      currentSegment = seg;
      nextSegment = i + 1 < track.segments.length ? track.segments[i + 1] : null;
      break;
    }
  }

  // Fallback: if row is beyond all segments, use the last segment
  if (!currentSegment) {
    currentSegment = track.segments[track.segments.length - 1];
  }

  const baseCenter = track.defaultRoadCenter + currentSegment.centerOffset;

  // Smooth transition near segment boundaries (last 30 rows of each segment)
  if (nextSegment) {
    const transitionZone = 30;
    const distToEnd = currentSegment.to - row;
    if (distToEnd < transitionZone && distToEnd >= 0) {
      const nextCenter = track.defaultRoadCenter + nextSegment.centerOffset;
      const t = 1 - distToEnd / transitionZone;
      // Smooth step interpolation
      const smoothT = t * t * (3 - 2 * t);
      return Math.round(baseCenter + (nextCenter - baseCenter) * smoothT);
    }
  }

  return baseCenter;
}

// ── Generate SceneData from TrackConfig ─────────────────────────────────────

/**
 * Generate a complete SceneData with tile layer and entity layer from
 * the compact TrackConfig. The tile layer is 21 cols x track.length rows
 * using frames from the "road-tiles" sprite sheet.
 */
export function generateSceneFromTrack(track: TrackConfig): SceneData {
  const mapCols = track.mapWidth;      // 21
  const mapRows = track.length;        // 1500
  const tileW = 32;
  const tileH = 32;
  const laneWidthTiles = 3;            // each lane is 3 tiles wide
  const roadWidthTiles = track.roadWidth * laneWidthTiles; // 5 * 3 = 15

  // ── Build tile data ─────────────────────────────────────────────────

  const tileData: string[] = new Array(mapCols * mapRows).fill('');

  for (let row = 0; row < mapRows; row++) {
    const roadCenter = getRoadCenterForRow(row, track);

    // Road left edge (inclusive) and right edge (exclusive) in tile columns
    // Center column is roadCenter; road spans roadWidthTiles/2 on each side
    const halfRoad = Math.floor(roadWidthTiles / 2); // 7
    const roadLeft = roadCenter - halfRoad;           // e.g. 3
    const roadRight = roadCenter + halfRoad + 1;      // e.g. 18 (exclusive, so 15 tiles total)

    // Curb: 1 tile outside each road edge
    const curbLeft = roadLeft - 1;
    const curbRight = roadRight; // right curb at roadRight

    // Shoulder: 1 tile outside each curb
    const shoulderLeft = curbLeft - 1;
    const shoulderRight = curbRight + 1;

    for (let col = 0; col < mapCols; col++) {
      const idx = row * mapCols + col;

      if (col === shoulderLeft) {
        tileData[idx] = 'shoulder_l';
      } else if (col === shoulderRight) {
        tileData[idx] = 'shoulder_r';
      } else if (col === curbLeft) {
        tileData[idx] = 'curb_l';
      } else if (col === curbRight) {
        tileData[idx] = 'curb_r';
      } else if (col >= roadLeft && col < roadRight) {
        // Inside the road
        tileData[idx] = getRoadTileForPosition(row, col, roadLeft, roadCenter, track);
      } else {
        // Grass / scenery
        tileData[idx] = 'grass';
      }
    }
  }

  // ── Build tile layer ──────────────────────────────────────────────────

  const tileLayer = {
    id: 'road',
    name: 'Road',
    type: 'tile' as const,
    visible: true,
    opacity: 1,
    spriteSheet: 'road-tiles',
    data: tileData,
    encoding: 'names' as const,
  };

  // ── Build entity instances for opponents, pickups, hazards ────────────

  const entities: Array<{
    id: string;
    template: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fields: Record<string, unknown>;
  }> = [];

  // Opponents
  for (let i = 0; i < track.opponents.length; i++) {
    const opp = track.opponents[i];
    const oppCenterCol = getRoadCenterForRow(opp.startRow, track);
    const worldX = laneToPixelX(opp.startLane, oppCenterCol, laneWidthTiles);
    const worldY = opp.startRow * tileH;

    entities.push({
      id: `opponent_${i}`,
      template: 'opponent-bike',
      name: opp.riderName,
      x: worldX,
      y: worldY,
      width: 32,
      height: 48,
      fields: {
        riderName: opp.riderName,
        color: opp.color,
        lane: opp.startLane,
        targetLane: opp.startLane,
        maxSpeed: opp.maxSpeed,
        acceleration: opp.acceleration,
        aggressiveness: opp.aggressiveness,
        skillLevel: opp.skillLevel,
        distance: 0,
      },
    });
  }

  // Pickups
  for (let i = 0; i < track.pickups.length; i++) {
    const pickup = track.pickups[i];
    const pickupCenter = getRoadCenterForRow(pickup.row, track);
    const worldX = laneToPixelX(pickup.lane, pickupCenter, laneWidthTiles);
    const worldY = pickup.row * tileH;

    let templateId: string;
    const fields: Record<string, unknown> = {};

    switch (pickup.type) {
      case 'weapon':
        templateId = 'weapon-pickup';
        fields.weaponType = pickup.weaponType ?? 'chain';
        break;
      case 'nitro':
        templateId = 'nitro-pickup';
        fields.nitroAmount = pickup.amount ?? 50;
        break;
      case 'health':
        templateId = 'health-pickup';
        fields.healAmount = pickup.amount ?? 30;
        break;
      default:
        templateId = 'weapon-pickup';
    }

    entities.push({
      id: `pickup_${i}`,
      template: templateId,
      name: `${pickup.type}_pickup_${i}`,
      x: worldX,
      y: worldY,
      width: 32,
      height: 32,
      fields,
    });
  }

  // Hazards
  for (let i = 0; i < track.hazards.length; i++) {
    const hazard = track.hazards[i];
    const hazardCenter = getRoadCenterForRow(hazard.row, track);
    const worldX = laneToPixelX(hazard.lane, hazardCenter, laneWidthTiles);
    const worldY = hazard.row * tileH;
    const widthLanes = hazard.width ?? 1;

    entities.push({
      id: `hazard_${i}`,
      template: 'road-hazard',
      name: `${hazard.type}_${i}`,
      x: worldX,
      y: worldY,
      width: widthLanes * laneWidthTiles * tileW,
      height: 32,
      fields: {
        hazardType: hazard.type,
      },
    });
  }

  const entityLayer = {
    id: 'entities',
    name: 'Entities',
    type: 'entity' as const,
    visible: true,
    opacity: 1,
    entities,
  };

  // ── Assemble SceneData ────────────────────────────────────────────────

  return {
    id: track.id,
    name: track.name,
    width: mapCols,
    height: mapRows,
    tileWidth: tileW,
    tileHeight: tileH,
    spriteSheets: ['road-tiles'],
    layers: [tileLayer, entityLayer],
  };
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Determine the road tile frame ID for a given position within the road.
 * Handles lane markers, start/finish lines, and directional arrows.
 */
function getRoadTileForPosition(
  row: number,
  col: number,
  roadLeft: number,
  roadCenter: number,
  track: TrackConfig,
): string {
  // Start line
  if (row === track.startLine) {
    return 'start_line';
  }

  // Finish line
  if (row === track.finishLine) {
    return 'finish_line';
  }

  // Directional arrows every 50 rows (visual variety)
  if (row % 50 === 0 && col === roadCenter) {
    return 'road_arrow';
  }

  // Lane divider logic:
  // Each lane is 3 tiles wide. Lane boundaries fall at every 3rd tile from roadLeft.
  // The lane divider is a dashed line at the boundary between lanes.
  const colInRoad = col - roadLeft; // 0-based position within the road

  // Lane dividers at tile positions 3, 6, 9, 12 (every laneWidthTiles=3 cols)
  if (colInRoad > 0 && colInRoad % 3 === 0) {
    // Dashed lane marker: show dash every other 2 rows
    if (row % 4 < 2) {
      return 'lane_dash';
    }
    return 'asphalt';
  }

  // Center line (solid) — if the road has an odd number of tiles, the center column
  // can have a solid line. We use the road center column.
  if (col === roadCenter && row % 4 < 2) {
    return 'lane_solid';
  }

  return 'asphalt';
}

/**
 * Convert a lane number (0-4) to a world X pixel position.
 * Each lane is 3 tiles (96px) wide. Lane 0 is the leftmost lane.
 *
 * @param lane - Lane index (0-4)
 * @param roadCenterCol - The road center tile column for this row
 * @param laneWidthTiles - Width of each lane in tiles (3)
 * @returns World X in pixels (left edge of the entity in that lane)
 */
function laneToPixelX(
  lane: number,
  roadCenterCol: number,
  laneWidthTiles: number,
): number {
  const tileSize = 32;
  const totalLanes = 5;
  const roadWidthTiles = totalLanes * laneWidthTiles; // 15
  const halfRoad = Math.floor(roadWidthTiles / 2);    // 7
  const roadLeftCol = roadCenterCol - halfRoad;

  // Lane N starts at roadLeftCol + lane * laneWidthTiles tiles
  // Center the entity within the lane (offset by ~1 tile for a 32px entity in a 96px lane)
  const laneStartCol = roadLeftCol + lane * laneWidthTiles;
  const laneCenterCol = laneStartCol + Math.floor(laneWidthTiles / 2);

  return laneCenterCol * tileSize;
}
