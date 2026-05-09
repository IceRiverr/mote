// ═══════════════════════════════════════════════════════════════
// schema.ts - Component Schema 状态管理
//
// 从 engine 构建产物 component-schemas.json 加载，
// 供 Inspector 自动渲染任意组件的属性面板。
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { ComponentSchema } from '@mote/engine/core/schema';

export type { ComponentSchema, PropertySchema, PropType } from '@mote/engine/core/schema';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 是否已加载 */
export const schemaLoaded = signal(false);

/** 加载错误信息 */
export const schemaError = signal<string | null>(null);

/** 所有组件 schema：name → ComponentSchema */
export const componentSchemas = signal<Record<string, ComponentSchema>>({});

/** 按 category 分组 */
export const schemasByCategory = computed(() => {
  const groups = new Map<string, ComponentSchema[]>();
  for (const schema of Object.values(componentSchemas.value)) {
    const cat = schema.category || 'unknown';
    const list = groups.get(cat) || [];
    list.push(schema);
    groups.set(cat, list);
  }
  return groups;
});

/** 可编辑的组件名列表（供“添加组件”弹窗使用） */
export const editableComponentNames = computed(() => {
  return Object.values(componentSchemas.value)
    .filter(s => s.editable !== false)
    .map(s => s.name)
    .sort();
});

// ═══════════════════════════════════════════════════════════════
// 加载
// ═══════════════════════════════════════════════════════════════

/**
 * 从 /component-schemas.json 加载 schema
 * 在 editor App 启动时调用一次
 */
export async function loadComponentSchemas(): Promise<void> {
  try {
    const res = await fetch('/component-schemas.json');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();

    const map: Record<string, ComponentSchema> = {};
    for (const schema of (data.components || []) as ComponentSchema[]) {
      map[schema.name] = schema;
    }

    componentSchemas.value = map;
    schemaLoaded.value = true;
    schemaError.value = null;

    console.log(`[Schema] Loaded ${Object.keys(map).length} component schemas`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    schemaError.value = msg;
    console.error('[Schema] Failed to load schemas:', msg);
  }
}

/**
 * 获取指定组件的 schema
 */
export function getComponentSchema(name: string): ComponentSchema | undefined {
  return componentSchemas.value[name];
}

/**
 * 检查 editor 是否认识某个组件
 */
export function hasComponentSchema(name: string): boolean {
  return name in componentSchemas.value;
}
