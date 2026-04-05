// ═══════════════════════════════════════════════════════════════
// entityDefs.ts — EntityDef store
// Manages entity definitions (templates) and built-in defaults
// ═══════════════════════════════════════════════════════════════

import { signal } from '@preact/signals';
import type { EntityDef } from '../data/EntityDef';

/** All loaded entity definitions */
export const entityDefs = signal<EntityDef[]>([]);

/** Get EntityDef by id */
export function getEntityDef(id: string): EntityDef | undefined {
  return entityDefs.value.find(d => d.id === id);
}

export function addEntityDef(def: EntityDef): void {
  entityDefs.value = [...entityDefs.value, def];
}

export function removeEntityDef(id: string): void {
  entityDefs.value = entityDefs.value.filter(d => d.id !== id);
}

export function updateEntityDef(id: string, updater: (def: EntityDef) => EntityDef): void {
  entityDefs.value = entityDefs.value.map(d => d.id === id ? updater(d) : d);
}

// ── Built-in defaults (migrated from old BUILTIN_ENTITY_DEFS) ─

export function loadBuiltinEntityDefs(): void {
  const builtins: EntityDef[] = [
    {
      id: 'player_spawn',
      name: 'Player Spawn',
      shape: 'point',
      color: '#4a90d9',
      icon: '\u25C6',
      width: 16,
      height: 16,
      resizable: false,
      fields: [{ id: 'direction', label: 'Direction', type: 'string', default: 'down' }],
    },
    {
      id: 'trigger_zone',
      name: 'Trigger Zone',
      shape: 'rect',
      color: '#e06060',
      icon: '!',
      width: 48,
      height: 48,
      resizable: true,
      fields: [
        { id: 'event', label: 'Event', type: 'string', default: '' },
        { id: 'once', label: 'Once', type: 'bool', default: true },
      ],
    },
    {
      id: 'waypoint',
      name: 'Waypoint',
      shape: 'point',
      color: '#60b060',
      icon: '\u25CB',
      width: 16,
      height: 16,
      resizable: false,
      fields: [{ id: 'order', label: 'Order', type: 'number', default: 0 }],
    },
    {
      id: 'enemy_skeleton',
      name: 'Skeleton',
      shape: 'point',
      color: '#c0392b',
      icon: '\uD83D\uDC80',
      width: 16,
      height: 16,
      resizable: false,
      fields: [{ id: 'health', label: 'Health', type: 'number', default: 30 }],
    },
    {
      id: 'pickup_potion_red',
      name: 'Red Potion',
      shape: 'point',
      color: '#e74c3c',
      icon: '\u2764\uFE0F',
      width: 16,
      height: 16,
      resizable: false,
      fields: [{ id: 'amount', label: 'Heal Amount', type: 'number', default: 20 }],
    },
    {
      id: 'pickup_potion_blue',
      name: 'Blue Potion',
      shape: 'point',
      color: '#3498db',
      icon: '\uD83D\uDCA7',
      width: 16,
      height: 16,
      resizable: false,
      fields: [{ id: 'amount', label: 'Mana Amount', type: 'number', default: 15 }],
    },
    {
      id: 'weapon_axe',
      name: 'Axe',
      shape: 'point',
      color: '#f39c12',
      icon: '\uD83E\uDE93',
      width: 16,
      height: 16,
      resizable: false,
      fields: [],
    },
  ];
  entityDefs.value = builtins;
}
