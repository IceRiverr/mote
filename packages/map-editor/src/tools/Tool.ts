// Base class for map editing tools

import type { MapEditor } from '../Editor.js';

export interface Tool {
  readonly name: string;
  readonly icon: string;
  readonly cursor: string;

  onMouseDown(pos: { x: number; y: number }): void;
  onMouseMove(pos: { x: number; y: number }): void;
  onMouseUp(pos: { x: number; y: number }): void;
}

export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly icon: string;
  abstract readonly cursor: string;

  protected editor: MapEditor;
  protected isDragging = false;
  protected lastPos: { x: number; y: number } | null = null;

  constructor(editor: MapEditor) {
    this.editor = editor;
  }

  abstract onMouseDown(pos: { x: number; y: number }): void;
  abstract onMouseMove(pos: { x: number; y: number }): void;
  abstract onMouseUp(pos: { x: number; y: number }): void;
}
