import { ActionState } from './ActionState.js';
export class ActionMap {
    name;
    enabled = false;
    actions = new Map();
    constructor(name, defs, mgr) {
        this.name = name;
        for (const [k, def] of Object.entries(defs))
            this.actions.set(k, new ActionState(mgr, def));
    }
    action(name) {
        const a = this.actions.get(name);
        if (!a)
            throw new Error(`Action "${name}" not found in map "${this.name}"`);
        return a;
    }
    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
}
//# sourceMappingURL=ActionMap.js.map