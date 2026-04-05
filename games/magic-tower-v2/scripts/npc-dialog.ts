import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class NpcDialogScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const npcType = this.entity.getField<string>('npcType') || 'oldman';
    const dialog = this.entity.getField<string>('dialog') || '...';
    const npcNames: Record<string, string> = {
      oldman: '老人',
      merchant: '商人',
      thief: '盗贼',
      princess: '公主',
    };
    this.engine.showDialog(npcNames[npcType] || npcType, dialog);
  }
}
