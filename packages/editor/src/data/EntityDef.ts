// ═══════════════════════════════════════════════════════════════
// EntityDef.ts — Entity template and instance types (new unified format)
// Replaces the entity system in TileMap.ts with external entity
// definitions that can be shared across scenes.
// ═══════════════════════════════════════════════════════════════

import type { ColliderShape } from './Collider';

// ── Field types ───────────────────────────────────────────────

/** Field type for entity custom fields */
export type FieldType = 'string' | 'number' | 'bool';

export interface EntityFieldDef {
  id: string;
  label: string;
  type: FieldType;
  default: string | number | boolean;
}

// ── Entity definition (template) ──────────────────────────────

export interface EntityDef {
  id: string;
  name: string;
  /** Reference to sprite: "sheetId:frameId" */
  sprite?: string;
  shape: 'point' | 'rect';
  width: number;
  height: number;
  resizable: boolean;
  color: string;
  icon: string;
  /** Path to TypeScript script */
  script?: string;
  /** null = inherit from Frame, explicit = override */
  collider?: ColliderShape[] | null;
  fields: EntityFieldDef[];
}

// ── Entity instance ───────────────────────────────────────────

export interface EntityInstance {
  id: string;
  /** References EntityDef.id */
  template: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Overridden field values */
  fields: Record<string, string | number | boolean>;
  /** Collider override for this specific instance */
  colliderOverride?: ColliderShape[] | null;
  visible?: boolean;
}

// ── Sprite reference helpers ──────────────────────────────────

/**
 * Parse a sprite reference string "sheetId:frameId" into its components.
 * Returns null if the string is not a valid sprite reference.
 */
export function parseSpriteRef(
  ref: string,
): { sheetId: string; frameId: string } | null {
  if (!ref || typeof ref !== 'string') return null;
  const colonIndex = ref.indexOf(':');
  if (colonIndex <= 0 || colonIndex >= ref.length - 1) return null;
  return {
    sheetId: ref.substring(0, colonIndex),
    frameId: ref.substring(colonIndex + 1),
  };
}

/**
 * Format a sprite reference from sheetId and frameId.
 * Returns "sheetId:frameId".
 */
export function formatSpriteRef(sheetId: string, frameId: string): string {
  return `${sheetId}:${frameId}`;
}

// ── Factories ─────────────────────────────────────────────────

/** Options for createEntityDef (all optional, with sensible defaults) */
interface CreateEntityDefOpts {
  sprite?: string;
  shape?: 'point' | 'rect';
  width?: number;
  height?: number;
  resizable?: boolean;
  color?: string;
  icon?: string;
  script?: string;
  collider?: ColliderShape[] | null;
  fields?: EntityFieldDef[];
}

/**
 * Create an EntityDef with sensible defaults.
 * Only id and name are required; everything else has defaults.
 */
export function createEntityDef(
  id: string,
  name: string,
  opts?: CreateEntityDefOpts,
): EntityDef {
  return {
    id,
    name,
    sprite: opts?.sprite,
    shape: opts?.shape ?? 'point',
    width: opts?.width ?? 16,
    height: opts?.height ?? 16,
    resizable: opts?.resizable ?? false,
    color: opts?.color ?? '#4a90d9',
    icon: opts?.icon ?? '\u25C6',
    script: opts?.script,
    collider: opts?.collider,
    fields: opts?.fields ?? [],
  };
}

/** Options for createEntityInstance (all optional) */
interface CreateEntityInstanceOpts {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  fields?: Record<string, string | number | boolean>;
  colliderOverride?: ColliderShape[] | null;
  visible?: boolean;
}

/**
 * Create an EntityInstance from an EntityDef at position (x, y).
 * Inherits width/height from the def; field values default to empty.
 */
export function createEntityInstance(
  def: EntityDef,
  x: number,
  y: number,
  opts?: CreateEntityInstanceOpts,
): EntityInstance {
  return {
    id: opts?.id ?? `${def.id}_${Date.now().toString(36)}`,
    template: def.id,
    name: opts?.name ?? def.name,
    x,
    y,
    width: opts?.width ?? def.width,
    height: opts?.height ?? def.height,
    fields: opts?.fields ?? {},
    colliderOverride: opts?.colliderOverride,
    visible: opts?.visible ?? true,
  };
}

// ── Field value resolution ────────────────────────────────────

/**
 * Get the effective value of a field for an entity instance.
 * Returns the instance override if present, otherwise the default
 * from the EntityDef field definition.
 * Returns undefined if the field does not exist on the def.
 */
export function getFieldValue(
  instance: EntityInstance,
  def: EntityDef,
  fieldId: string,
): string | number | boolean | undefined {
  // Check instance override first
  if (fieldId in instance.fields) {
    return instance.fields[fieldId];
  }
  // Fall back to def default
  const fieldDef = def.fields.find((f) => f.id === fieldId);
  if (!fieldDef) return undefined;
  return fieldDef.default;
}
