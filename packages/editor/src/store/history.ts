// ═══════════════════════════════════════════════════════════════
// commands/index.ts — Command system placeholder
// Old command system disabled during architecture migration
// ═══════════════════════════════════════════════════════════════

import { signal } from "@preact/signals";

// Minimal compatibility for existing imports
export const canUndo = signal(false);
export const canRedo = signal(false);
export const undoLabel = signal("");
export const redoLabel = signal("");

export function undo(): void {
  console.warn("Undo not yet implemented in new architecture");
}

export function redo(): void {
  console.warn("Redo not yet implemented in new architecture");
}

export function executeCommand(cmd: any): void {
  console.warn("Command system not yet implemented");
}
