import type { ActionDef } from './InputTypes.js';
import type { InputManager } from './InputManager.js';
import { ActionState } from './ActionState.js';

export class ActionMap {
  readonly name: string;
  enabled = false;
  private readonly actions = new Map<string, ActionState>();

  constructor(
    name: string,
    defs: Record<string, ActionDef>,
    mgr: InputManager,
  ) {
    this.name = name;
    for (const [k, def] of Object.entries(defs))
      this.actions.set(k, new ActionState(mgr, def));
  }

  action(name: string): ActionState {
    const a = this.actions.get(name);
    if (!a) throw new Error(`Action "${name}" not found in map "${this.name}"`);
    return a;
  }

  enable():  void { this.enabled = true; }
  disable(): void { this.enabled = false; }
}
