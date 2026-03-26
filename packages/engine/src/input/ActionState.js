export class ActionState {
    mgr;
    def;
    constructor(mgr, def) {
        this.mgr = mgr;
        this.def = def;
    }
    // ── Button ────────────────────────────────────────────────────────────────
    get down() {
        if (!this.def.bindings)
            return false;
        for (const key of this.def.bindings)
            if (this.mgr.rawDown(key))
                return true;
        return false;
    }
    get pressed() {
        if (!this.def.bindings)
            return false;
        for (const key of this.def.bindings)
            if (this.mgr.rawPressed(key))
                return true;
        return false;
    }
    get released() {
        if (!this.def.bindings)
            return false;
        for (const key of this.def.bindings)
            if (this.mgr.rawReleased(key))
                return true;
        return false;
    }
    // ── Axis2D ────────────────────────────────────────────────────────────────
    vec2() {
        // 1. 手柄摇杆优先（有输入时直接返回）
        if (this.def.gamepadStick) {
            const s = this.mgr.rawStick(this.def.gamepadStick);
            if (s.x !== 0 || s.y !== 0)
                return s;
        }
        // 2. 键盘 composite
        if (!this.def.composites)
            return { x: 0, y: 0 };
        let x = 0, y = 0;
        for (const c of this.def.composites) {
            if (this.mgr.rawDown(c.right))
                x = 1;
            if (this.mgr.rawDown(c.left))
                x = -1;
            if (this.mgr.rawDown(c.down))
                y = 1;
            if (this.mgr.rawDown(c.up))
                y = -1;
        }
        // 对角线归一化（和 Unity Composite 一致）
        if (x !== 0 && y !== 0) {
            const inv = 1 / Math.SQRT2;
            return { x: x * inv, y: y * inv };
        }
        return { x, y };
    }
    // ── Axis1D ────────────────────────────────────────────────────────────────
    axis() {
        if (!this.def.bindings || this.def.bindings.length < 2)
            return 0;
        const pos = this.mgr.rawDown(this.def.bindings[1]) ? 1 : 0;
        const neg = this.mgr.rawDown(this.def.bindings[0]) ? 1 : 0;
        return pos - neg;
    }
}
//# sourceMappingURL=ActionState.js.map