import type { ComponentType } from "preact";

interface EditorDef {
  id: string;
  name: string;
  icon: string;
  component: ComponentType<{ areaId: string }>;
}

const registry = new Map<string, EditorDef>();

export function registerEditor(def: EditorDef) {
  registry.set(def.id, def);
}

export function getEditor(id: string): EditorDef | undefined {
  return registry.get(id);
}

export function getAllEditors(): EditorDef[] {
  return Array.from(registry.values());
}
