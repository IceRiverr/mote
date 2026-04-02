/**
 * Global Menu Bar - 全局菜单栏
 * 
 * 顶部菜单栏：品牌、菜单、操作按钮
 */

import { useLayout } from "../core/layout-state.js";

export function GlobalMenuBar() {
  const layout = useLayout();

  return (
    <div class="global-menu-bar">
      <span class="global-menu-bar__brand">🎮 mote</span>
      
      <div class="global-menu-bar__menus">
        <span class="menu-item">File</span>
        <span class="menu-item">Edit</span>
        <span class="menu-item">View</span>
        <span class="menu-item">Window</span>
        <span class="menu-item">Help</span>
      </div>

      <div class="global-menu-bar__actions">
        <button 
          class="tool-button active" 
          title="Reset Layout"
          onClick={() => layout.reset()}
        >
          Reset Layout
        </button>
        <button class="tool-button active" title="Play">
          ▶ Play
        </button>
      </div>
    </div>
  );
}
