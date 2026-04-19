import { ComponentType } from 'preact';

export interface EditorDef {
  id: string;
  name: string;
  icon: string;
  component: ComponentType<{ areaId: string }>;
  /** 可选的区域 Header 右侧工具栏 */
  header?: ComponentType<{ areaId: string }>;
}

const editors = new Map<string, EditorDef>();

export function registerEditor(def: EditorDef) {
  editors.set(def.id, def);
}

export function getEditor(id: string): EditorDef | undefined {
  return editors.get(id);
}

export function getAllEditors(): EditorDef[] {
  return Array.from(editors.values());
}
