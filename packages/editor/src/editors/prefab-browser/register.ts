// ═══════════════════════════════════════════════════════════════
// register.ts - 注册 Prefab Browser 到编辑器系统
// ═══════════════════════════════════════════════════════════════

import { registerEditor } from "../registry";
import { PrefabBrowser } from "./PrefabBrowser";

registerEditor({
  id: "prefab-browser",
  name: "Prefab 浏览器",
  icon: "📦",
  component: PrefabBrowser,
});

