// engine/src/core/schema.ts
// Component Schema 定义 —— 供 ComponentRegistry 和 Editor 共享

export type PropType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'color'
  | 'vec2'
  | 'asset'
  | 'enum'
  | 'string[]'
  | 'number[]'
  | 'object';

export interface PropertySchema {
  type: PropType;
  default: any;
  label: string;
  description?: string;
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    nullable?: boolean;
  };
}

export interface ComponentSchema {
  name: string;
  displayName: string;
  description?: string;
  properties: Record<string, PropertySchema>;
  icon?: string;
  editable: boolean;
  category?: string;
}
