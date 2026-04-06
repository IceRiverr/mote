/**
 * ui-manager.ts — HTML overlay UI manager for Siege War.
 *
 * Creates and manages DOM-based UI panels layered on top of the game canvas:
 *   - Resource bar (top)
 *   - Troop roster (left sidebar)
 *   - Wall status bar (right sidebar)
 *   - Command panel (bottom, context-sensitive, 3 expansion states)
 *   - Alerts, event log, deployment overlay
 *
 * All styles are inline (no external stylesheet). Dark military theme with
 * gold (#c4a35a) accents on a #1a1a2e / #2d2d4e background.
 */

// ── Public types ────────────────────────────────────────────────────────────

export interface UnitRosterEntry {
  id: string;
  name: string;
  type: string;
  strength: number;
  maxStrength: number;
  morale: number;
  state: string;
  position: string;    // wall segment ID or "reserve"
  isSelected: boolean;
}

export interface WallSegmentStatus {
  id: string;
  segmentType: string;
  hp: number;
  maxHp: number;
  onFire: boolean;
  ladderCount: number;
  garrisonCount: number;
  breached: boolean;
}

export interface DeploymentUnit {
  templateId: string;
  name: string;
  cost: number;
  count: number;
  type: string;
}

type UnitClickCallback = (unitId: string) => void;
type SegmentClickCallback = (segmentId: string) => void;
type CommandClickCallback = (commandType: string, params?: Record<string, unknown>) => void;
type DeployConfirmCallback = (assignments: Map<string, string[]>) => void;

// ── CSS constants ───────────────────────────────────────────────────────────

const BG_DARK = '#1a1a2e';
const BG_MID = '#2d2d4e';
const BG_PANEL = 'rgba(26, 26, 46, 0.92)';
const GOLD = '#c4a35a';
const TEXT_LIGHT = '#e0e0e0';
const TEXT_DIM = '#8888aa';
const GREEN = '#4CAF50';
const ORANGE = '#FF9800';
const RED = '#F44336';
const BLUE = '#4FC3F7';
const BORDER = 'rgba(196, 163, 90, 0.3)';

const FONT_MAIN = '12px monospace';
const FONT_SMALL = '10px monospace';
const FONT_TITLE = 'bold 14px monospace';

// ── UIManager ───────────────────────────────────────────────────────────────

export class UIManager {
  private overlay: HTMLElement;

  // Panel containers
  private resourceBar: HTMLElement | null = null;
  private troopRoster: HTMLElement | null = null;
  private wallStatusBar: HTMLElement | null = null;
  private commandPanel: HTMLElement | null = null;
  private alertContainer: HTMLElement | null = null;
  private eventLogContainer: HTMLElement | null = null;
  private deploymentOverlay: HTMLElement | null = null;

  // Expansion state: 0=collapsed, 1=half, 2=full
  private expansionState: 0 | 1 | 2 = 1;

  // Callbacks
  private _onUnitClick: UnitClickCallback | null = null;
  private _onSegmentClick: SegmentClickCallback | null = null;
  private _onCommandClick: CommandClickCallback | null = null;
  private _onDeployConfirm: DeployConfirmCallback | null = null;

  // Internal state tracking
  private eventLogEntries: Array<{ message: string; type: string; time: number }> = [];
  private activeAlerts: HTMLElement[] = [];

  constructor(overlay: HTMLElement) {
    this.overlay = overlay;
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; overflow: hidden; font-family: monospace;
    `;
    this.createResourceBar();
    this.createTroopRoster();
    this.createWallStatusBar();
    this.createCommandPanel();
    this.createAlertContainer();
    this.createEventLogContainer();
  }

  // ── Element creation helper ─────────────────────────────────────────────

  private el(tag: string, styles: string, parent: HTMLElement): HTMLElement {
    const elem = document.createElement(tag);
    elem.style.cssText = styles;
    parent.appendChild(elem);
    return elem;
  }

  // ── Resource bar (top) ──────────────────────────────────────────────────

  private createResourceBar(): void {
    this.resourceBar = this.el('div', `
      position: absolute; top: 0; left: 0; right: 0; height: 36px;
      background: ${BG_PANEL}; border-bottom: 1px solid ${BORDER};
      display: flex; align-items: center; padding: 0 12px; gap: 16px;
      pointer-events: auto; z-index: 10;
    `, this.overlay);

    // Resource slots (gold, wood, stone, oil)
    for (const res of ['gold', 'wood', 'stone', 'oil']) {
      const slot = this.el('div', `
        display: flex; align-items: center; gap: 4px;
        color: ${TEXT_LIGHT}; font: ${FONT_MAIN};
      `, this.resourceBar);
      slot.dataset.resource = res;

      const icon = this.el('span', `
        display: inline-block; width: 10px; height: 10px; border-radius: 2px;
        background: ${res === 'gold' ? GOLD : res === 'wood' ? '#8B6914' : res === 'stone' ? '#9E9E9E' : '#6d4c00'};
      `, slot);
      icon.className = 'res-icon';

      const label = this.el('span', `color: ${TEXT_DIM}; font: ${FONT_SMALL};`, slot);
      label.textContent = res.charAt(0).toUpperCase() + res.slice(1) + ':';

      const value = this.el('span', `color: ${TEXT_LIGHT}; font: ${FONT_MAIN}; min-width: 36px;`, slot);
      value.textContent = '0';
      value.dataset.role = 'value';
    }

    // Spacer
    this.el('div', 'flex: 1;', this.resourceBar);

    // Morale bar
    const moraleGroup = this.el('div', `
      display: flex; align-items: center; gap: 6px;
    `, this.resourceBar);
    const moraleLabel = this.el('span', `color: ${GOLD}; font: ${FONT_SMALL};`, moraleGroup);
    moraleLabel.textContent = 'Morale:';
    const moraleBarBg = this.el('div', `
      width: 80px; height: 14px; background: rgba(0,0,0,0.4);
      border: 1px solid ${BORDER}; border-radius: 2px; overflow: hidden;
    `, moraleGroup);
    const moraleFill = this.el('div', `
      width: 100%; height: 100%; background: ${GREEN}; transition: width 0.3s;
    `, moraleBarBg);
    moraleFill.dataset.role = 'morale-fill';

    // Round info
    const roundInfo = this.el('div', `
      color: ${GOLD}; font: ${FONT_MAIN}; margin-left: 12px;
    `, this.resourceBar);
    roundInfo.dataset.role = 'round-info';
    roundInfo.textContent = 'R1/3';

    // Pause / speed buttons
    const btnGroup = this.el('div', `display: flex; gap: 4px; margin-left: 8px;`, this.resourceBar);

    const pauseBtn = this.el('button', `
      background: ${BG_MID}; color: ${TEXT_LIGHT}; border: 1px solid ${BORDER};
      padding: 2px 8px; cursor: pointer; font: ${FONT_SMALL}; border-radius: 2px;
      pointer-events: auto;
    `, btnGroup);
    pauseBtn.textContent = '||';
    pauseBtn.title = 'Pause (Space)';
    pauseBtn.dataset.role = 'pause-btn';

    const speedDownBtn = this.el('button', `
      background: ${BG_MID}; color: ${TEXT_LIGHT}; border: 1px solid ${BORDER};
      padding: 2px 6px; cursor: pointer; font: ${FONT_SMALL}; border-radius: 2px;
      pointer-events: auto;
    `, btnGroup);
    speedDownBtn.textContent = '<';
    speedDownBtn.title = 'Slow down (,)';
    speedDownBtn.dataset.role = 'speed-down';

    const speedLabel = this.el('span', `
      color: ${TEXT_LIGHT}; font: ${FONT_SMALL}; min-width: 28px; text-align: center;
      line-height: 24px;
    `, btnGroup);
    speedLabel.dataset.role = 'speed-label';
    speedLabel.textContent = 'x1';

    const speedUpBtn = this.el('button', `
      background: ${BG_MID}; color: ${TEXT_LIGHT}; border: 1px solid ${BORDER};
      padding: 2px 6px; cursor: pointer; font: ${FONT_SMALL}; border-radius: 2px;
      pointer-events: auto;
    `, btnGroup);
    speedUpBtn.textContent = '>';
    speedUpBtn.title = 'Speed up (.)';
    speedUpBtn.dataset.role = 'speed-up';
  }

  // ── Troop roster (left sidebar) ─────────────────────────────────────────

  private createTroopRoster(): void {
    this.troopRoster = this.el('div', `
      position: absolute; top: 40px; left: 0; width: 180px; bottom: 120px;
      background: ${BG_PANEL}; border-right: 1px solid ${BORDER};
      overflow-y: auto; pointer-events: auto; z-index: 5;
      scrollbar-width: thin; scrollbar-color: ${BG_MID} ${BG_DARK};
    `, this.overlay);

    const header = this.el('div', `
      padding: 6px 8px; color: ${GOLD}; font: ${FONT_TITLE};
      border-bottom: 1px solid ${BORDER}; position: sticky; top: 0;
      background: ${BG_DARK};
    `, this.troopRoster);
    header.textContent = 'Units';

    // Unit list container
    const list = this.el('div', '', this.troopRoster);
    list.dataset.role = 'unit-list';
  }

  // ── Wall status bar (right sidebar) ─────────────────────────────────────

  private createWallStatusBar(): void {
    this.wallStatusBar = this.el('div', `
      position: absolute; top: 40px; right: 0; width: 160px; bottom: 120px;
      background: ${BG_PANEL}; border-left: 1px solid ${BORDER};
      overflow-y: auto; pointer-events: auto; z-index: 5;
      scrollbar-width: thin; scrollbar-color: ${BG_MID} ${BG_DARK};
    `, this.overlay);

    const header = this.el('div', `
      padding: 6px 8px; color: ${GOLD}; font: ${FONT_TITLE};
      border-bottom: 1px solid ${BORDER}; position: sticky; top: 0;
      background: ${BG_DARK};
    `, this.wallStatusBar);
    header.textContent = 'Wall';

    const list = this.el('div', '', this.wallStatusBar);
    list.dataset.role = 'wall-list';
  }

  // ── Command panel (bottom) ──────────────────────────────────────────────

  private createCommandPanel(): void {
    this.commandPanel = this.el('div', `
      position: absolute; bottom: 0; left: 180px; right: 160px; height: 110px;
      background: ${BG_PANEL}; border-top: 1px solid ${BORDER};
      pointer-events: auto; z-index: 10; transition: height 0.2s;
      display: flex; flex-direction: column;
    `, this.overlay);

    // Expansion handle
    const handle = this.el('div', `
      height: 16px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: ${TEXT_DIM}; font: ${FONT_SMALL};
      border-bottom: 1px solid ${BORDER};
    `, this.commandPanel);
    handle.textContent = '--- Commands ---';
    handle.addEventListener('click', () => {
      const next = ((this.expansionState + 1) % 3) as 0 | 1 | 2;
      this.setExpansionState(next);
    });

    // Command content area
    const content = this.el('div', `
      flex: 1; overflow-y: auto; padding: 4px 8px;
      display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start;
    `, this.commandPanel);
    content.dataset.role = 'command-content';
  }

  // ── Alert container ─────────────────────────────────────────────────────

  private createAlertContainer(): void {
    this.alertContainer = this.el('div', `
      position: absolute; top: 50px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; gap: 6px; align-items: center;
      pointer-events: none; z-index: 20;
    `, this.overlay);
  }

  // ── Event log container ─────────────────────────────────────────────────

  private createEventLogContainer(): void {
    this.eventLogContainer = this.el('div', `
      position: absolute; bottom: 115px; left: 185px; width: 350px;
      pointer-events: none; z-index: 4;
    `, this.overlay);
  }

  // ── Update: resource bar ────────────────────────────────────────────────

  updateResourceBar(
    resources: { gold: number; wood: number; stone: number; oil: number },
    morale: number,
    round: number,
    maxRounds: number,
  ): void {
    if (!this.resourceBar) return;

    const resMap: Record<string, number> = {
      gold: resources.gold,
      wood: resources.wood,
      stone: resources.stone,
      oil: resources.oil,
    };

    for (const slot of Array.from(this.resourceBar.querySelectorAll('[data-resource]'))) {
      const el = slot as HTMLElement;
      const key = el.dataset.resource!;
      const valueEl = el.querySelector('[data-role="value"]') as HTMLElement;
      if (valueEl && key in resMap) {
        valueEl.textContent = String(resMap[key]);
      }
    }

    // Morale fill
    const moraleFill = this.resourceBar.querySelector('[data-role="morale-fill"]') as HTMLElement;
    if (moraleFill) {
      moraleFill.style.width = `${Math.max(0, Math.min(100, morale))}%`;
      moraleFill.style.background = morale > 60 ? GREEN : morale > 30 ? ORANGE : RED;
    }

    // Round info
    const roundEl = this.resourceBar.querySelector('[data-role="round-info"]') as HTMLElement;
    if (roundEl) {
      roundEl.textContent = `R${round}/${maxRounds}`;
    }
  }

  // ── Update: troop roster ────────────────────────────────────────────────

  updateTroopRoster(units: UnitRosterEntry[]): void {
    if (!this.troopRoster) return;
    const list = this.troopRoster.querySelector('[data-role="unit-list"]') as HTMLElement;
    if (!list) return;

    list.innerHTML = '';

    for (const unit of units) {
      const ratio = unit.maxStrength > 0 ? unit.strength / unit.maxStrength : 0;
      const borderColor = unit.isSelected ? GOLD : 'transparent';

      const item = this.el('div', `
        padding: 4px 8px; border-left: 3px solid ${borderColor};
        cursor: pointer; transition: background 0.15s;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      `, list);
      item.addEventListener('mouseenter', () => { item.style.background = BG_MID; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', () => { this._onUnitClick?.(unit.id); });

      // Name + type
      const nameRow = this.el('div', `
        display: flex; justify-content: space-between; align-items: center;
      `, item);
      const name = this.el('span', `color: ${TEXT_LIGHT}; font: ${FONT_SMALL};`, nameRow);
      name.textContent = unit.name;
      const typeTag = this.el('span', `
        color: ${TEXT_DIM}; font: 9px monospace; background: ${BG_DARK};
        padding: 0 3px; border-radius: 2px;
      `, nameRow);
      typeTag.textContent = unit.type;

      // Strength bar
      const barBg = this.el('div', `
        width: 100%; height: 6px; background: rgba(0,0,0,0.3);
        margin-top: 2px; border-radius: 1px; overflow: hidden;
      `, item);
      const barFill = this.el('div', `
        width: ${ratio * 100}%; height: 100%;
        background: ${ratio > 0.6 ? GREEN : ratio > 0.3 ? ORANGE : RED};
      `, barBg);
      barFill.className = 'strength-fill';

      // Status line
      const statusLine = this.el('div', `
        color: ${TEXT_DIM}; font: 9px monospace; margin-top: 1px;
        display: flex; justify-content: space-between;
      `, item);
      const stateSpan = this.el('span', '', statusLine);
      stateSpan.textContent = unit.state;
      const posSpan = this.el('span', '', statusLine);
      posSpan.textContent = unit.position;
    }
  }

  // ── Update: wall status ─────────────────────────────────────────────────

  updateWallStatus(segments: WallSegmentStatus[]): void {
    if (!this.wallStatusBar) return;
    const list = this.wallStatusBar.querySelector('[data-role="wall-list"]') as HTMLElement;
    if (!list) return;

    list.innerHTML = '';

    for (const seg of segments) {
      const ratio = seg.maxHp > 0 ? seg.hp / seg.maxHp : 0;
      const hpColor = ratio > 0.6 ? GREEN : ratio > 0.3 ? ORANGE : RED;

      const item = this.el('div', `
        padding: 4px 8px; cursor: pointer; transition: background 0.15s;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      `, list);
      item.addEventListener('mouseenter', () => { item.style.background = BG_MID; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
      item.addEventListener('click', () => { this._onSegmentClick?.(seg.id); });

      // Header row
      const header = this.el('div', `
        display: flex; justify-content: space-between; align-items: center;
      `, item);
      const idLabel = this.el('span', `color: ${GOLD}; font: ${FONT_SMALL};`, header);
      idLabel.textContent = seg.id;
      const typeLabel = this.el('span', `color: ${TEXT_DIM}; font: 9px monospace;`, header);
      typeLabel.textContent = seg.segmentType;

      // HP bar
      const barBg = this.el('div', `
        width: 100%; height: 8px; background: rgba(0,0,0,0.3);
        margin-top: 2px; border-radius: 1px; overflow: hidden;
      `, item);
      this.el('div', `
        width: ${ratio * 100}%; height: 100%; background: ${hpColor};
      `, barBg);

      // HP text + indicators
      const infoRow = this.el('div', `
        color: ${TEXT_DIM}; font: 9px monospace; margin-top: 1px;
        display: flex; justify-content: space-between;
      `, item);
      const hpText = this.el('span', `color: ${hpColor};`, infoRow);
      hpText.textContent = `${Math.round(seg.hp)}/${seg.maxHp}`;

      const indicators = this.el('span', '', infoRow);
      const parts: string[] = [];
      if (seg.onFire) parts.push(`<span style="color:${RED}">FIRE</span>`);
      if (seg.ladderCount > 0) parts.push(`<span style="color:${ORANGE}">L:${seg.ladderCount}</span>`);
      if (seg.breached) parts.push(`<span style="color:${RED}">BREACH</span>`);
      if (seg.garrisonCount > 0) parts.push(`<span style="color:${BLUE}">G:${seg.garrisonCount}</span>`);
      indicators.innerHTML = parts.join(' ');
    }
  }

  // ── Update: command panel ───────────────────────────────────────────────

  updateCommandPanel(
    selectedEntity: { id: string; type: string; name: string } | null,
    selectedSegment: { id: string; segmentType: string } | null,
    side: 'attacker' | 'defender',
  ): void {
    if (!this.commandPanel) return;
    const content = this.commandPanel.querySelector('[data-role="command-content"]') as HTMLElement;
    if (!content) return;

    content.innerHTML = '';

    if (!selectedEntity && !selectedSegment) {
      // Global commands only
      const label = this.el('div', `color: ${TEXT_DIM}; font: ${FONT_SMALL}; width: 100%;`, content);
      label.textContent = 'Select a unit or wall segment to issue commands.';

      this.addCommandButton(content, 'SoundGong', 'Gong (G)', 'Recall all units');
      this.addCommandButton(content, 'BeatDrum', 'Drum (D)', 'Boost morale');
      return;
    }

    if (selectedSegment) {
      const label = this.el('div', `
        color: ${GOLD}; font: ${FONT_TITLE}; width: 100%; margin-bottom: 4px;
      `, content);
      label.textContent = `Wall: ${selectedSegment.id} (${selectedSegment.segmentType})`;

      if (side === 'defender') {
        this.addCommandButton(content, 'FocusedFire', 'Focused Fire', 'Concentrate fire on this segment');
        this.addCommandButton(content, 'Pour', 'Pour Oil', 'Pour boiling oil from this segment');
        this.addCommandButton(content, 'PushLadder', 'Push Ladder', 'Push siege ladders off');
        this.addCommandButton(content, 'Repair', 'Repair', 'Send craftsmen to repair');
        this.addCommandButton(content, 'Reinforce', 'Reinforce', 'Send reinforcements');
        this.addCommandButton(content, 'ScatterCaltrops', 'Caltrops', 'Scatter caltrops below');
      } else {
        this.addCommandButton(content, 'SetLadder', 'Set Ladder', 'Place siege ladder');
        this.addCommandButton(content, 'RamGate', 'Ram Gate', 'Battering ram attack');
        this.addCommandButton(content, 'Bombard', 'Bombard', 'Focus siege engine fire');
        this.addCommandButton(content, 'DigTunnel', 'Dig Tunnel', 'Start tunnel towards this segment');
      }
    }

    if (selectedEntity) {
      const label = this.el('div', `
        color: ${GOLD}; font: ${FONT_TITLE}; width: 100%; margin-bottom: 4px;
      `, content);
      label.textContent = `${selectedEntity.name} [${selectedEntity.type}]`;

      if (side === 'defender') {
        this.addCommandButton(content, 'Deploy', 'Deploy', 'Move unit to position');
        this.addCommandButton(content, 'FreeFire', 'Free Fire', 'Fire at will');
        this.addCommandButton(content, 'FocusedFire', 'Focus Fire', 'Concentrate on target');
        this.addCommandButton(content, 'Sortie', 'Sortie', 'Launch sortie outside walls');
        this.addCommandButton(content, 'CounterTunnel', 'Counter-Tunnel', 'Dig counter-tunnel');
      } else {
        this.addCommandButton(content, 'Advance', 'Advance', 'Move forward');
        this.addCommandButton(content, 'Charge', 'Charge', 'All-out assault');
        this.addCommandButton(content, 'Volley', 'Volley', 'Concentrated arrow volley');
        this.addCommandButton(content, 'Feint', 'Feint', 'Feint attack');
        this.addCommandButton(content, 'Retreat', 'Retreat', 'Fall back');
      }
    }

    // Always available
    this.addCommandButton(content, 'SoundGong', 'Gong (G)', 'Recall');
    this.addCommandButton(content, 'BeatDrum', 'Drum (D)', 'Rally');
  }

  private addCommandButton(
    parent: HTMLElement,
    commandType: string,
    label: string,
    tooltip: string,
  ): void {
    const btn = this.el('button', `
      background: ${BG_MID}; color: ${TEXT_LIGHT}; border: 1px solid ${BORDER};
      padding: 4px 10px; cursor: pointer; font: ${FONT_SMALL};
      border-radius: 3px; transition: background 0.15s, border-color 0.15s;
      pointer-events: auto; white-space: nowrap;
    `, parent);
    btn.textContent = label;
    btn.title = tooltip;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = BG_DARK;
      btn.style.borderColor = GOLD;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = BG_MID;
      btn.style.borderColor = BORDER;
    });
    btn.addEventListener('click', () => {
      this._onCommandClick?.(commandType);
    });
  }

  // ── Expansion state ─────────────────────────────────────────────────────

  setExpansionState(level: 0 | 1 | 2): void {
    this.expansionState = level;
    if (!this.commandPanel) return;

    switch (level) {
      case 0: this.commandPanel.style.height = '20px'; break;
      case 1: this.commandPanel.style.height = '110px'; break;
      case 2: this.commandPanel.style.height = '200px'; break;
    }
  }

  // ── Alerts ──────────────────────────────────────────────────────────────

  showAlert(message: string, position?: { x: number; y: number }): void {
    if (!this.alertContainer) return;

    const alert = this.el('div', `
      background: rgba(244, 67, 54, 0.9); color: #fff; font: ${FONT_MAIN};
      padding: 6px 16px; border-radius: 4px; pointer-events: none;
      animation: fadeInUp 0.3s ease; white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `, this.alertContainer);
    alert.textContent = message;
    this.activeAlerts.push(alert);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        alert.remove();
        this.activeAlerts = this.activeAlerts.filter((a) => a !== alert);
      }, 500);
    }, 3000);
  }

  // ── Event log ───────────────────────────────────────────────────────────

  addEventLog(message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
    if (!this.eventLogContainer) return;

    this.eventLogEntries.push({ message, type, time: Date.now() });

    // Keep only last 8 entries
    if (this.eventLogEntries.length > 8) {
      this.eventLogEntries.shift();
    }

    // Rebuild log display
    this.eventLogContainer.innerHTML = '';

    for (const entry of this.eventLogEntries) {
      const color = entry.type === 'warning' ? ORANGE :
                    entry.type === 'success' ? GREEN : TEXT_DIM;
      const line = this.el('div', `
        color: ${color}; font: ${FONT_SMALL}; padding: 1px 4px;
        background: rgba(13, 13, 26, 0.6); margin-bottom: 1px;
        border-radius: 2px;
      `, this.eventLogContainer);
      line.textContent = entry.message;
    }
  }

  // ── Callback setters ────────────────────────────────────────────────────

  set onUnitClick(fn: UnitClickCallback) { this._onUnitClick = fn; }
  set onSegmentClick(fn: SegmentClickCallback) { this._onSegmentClick = fn; }
  set onCommandClick(fn: CommandClickCallback) { this._onCommandClick = fn; }
  set onDeployConfirm(fn: DeployConfirmCallback) { this._onDeployConfirm = fn; }

  // ── Deployment UI ───────────────────────────────────────────────────────

  showDeploymentUI(
    budget: number,
    availableUnits: DeploymentUnit[],
    segments: WallSegmentStatus[],
  ): void {
    if (this.deploymentOverlay) this.hideDeploymentUI();

    this.deploymentOverlay = this.el('div', `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.8); z-index: 100;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; pointer-events: auto;
    `, this.overlay);

    // Title
    const title = this.el('div', `
      color: ${GOLD}; font: bold 24px monospace; margin-bottom: 16px;
    `, this.deploymentOverlay);
    title.textContent = 'Deployment Phase';

    // Budget display
    const budgetEl = this.el('div', `
      color: ${TEXT_LIGHT}; font: ${FONT_TITLE}; margin-bottom: 20px;
    `, this.deploymentOverlay);
    budgetEl.textContent = `Budget: ${budget} gold`;
    budgetEl.dataset.role = 'budget-display';

    // Main container: unit list + segment assignment
    const container = this.el('div', `
      display: flex; gap: 24px; max-width: 900px; width: 90%;
    `, this.deploymentOverlay);

    // Unit purchasing panel
    const unitPanel = this.el('div', `
      flex: 1; background: ${BG_PANEL}; border: 1px solid ${BORDER};
      border-radius: 4px; padding: 12px; max-height: 400px; overflow-y: auto;
    `, container);
    const unitTitle = this.el('div', `
      color: ${GOLD}; font: ${FONT_TITLE}; margin-bottom: 8px;
      border-bottom: 1px solid ${BORDER}; padding-bottom: 4px;
    `, unitPanel);
    unitTitle.textContent = 'Available Units';

    // Track assignments: segmentId -> list of templateIds
    const assignments = new Map<string, string[]>();
    let spent = 0;

    for (const unit of availableUnits) {
      const row = this.el('div', `
        display: flex; align-items: center; justify-content: space-between;
        padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.05);
      `, unitPanel);

      const info = this.el('div', `color: ${TEXT_LIGHT}; font: ${FONT_SMALL};`, row);
      info.innerHTML = `<b>${unit.name}</b> <span style="color:${TEXT_DIM}">[${unit.type}]</span>
        <br><span style="color:${GOLD}">Cost: ${unit.cost}</span>
        <span style="color:${TEXT_DIM}"> x${unit.count}</span>`;

      // Segment assignment dropdown
      const selectWrapper = this.el('div', `display: flex; gap: 4px; align-items: center;`, row);
      const select = document.createElement('select');
      select.style.cssText = `
        background: ${BG_DARK}; color: ${TEXT_LIGHT}; border: 1px solid ${BORDER};
        padding: 2px 4px; font: ${FONT_SMALL}; border-radius: 2px;
      `;
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- Assign --';
      select.appendChild(defaultOpt);

      for (const seg of segments) {
        const opt = document.createElement('option');
        opt.value = seg.id;
        opt.textContent = seg.id;
        select.appendChild(opt);
      }
      selectWrapper.appendChild(select);

      const addBtn = this.el('button', `
        background: ${GREEN}; color: #fff; border: none; padding: 4px 8px;
        cursor: pointer; font: ${FONT_SMALL}; border-radius: 2px;
      `, selectWrapper);
      addBtn.textContent = 'Add';
      addBtn.addEventListener('click', () => {
        const segId = select.value;
        if (!segId) return;
        if (spent + unit.cost > budget) {
          this.showAlert('Not enough budget!');
          return;
        }
        spent += unit.cost;
        const list = assignments.get(segId) ?? [];
        list.push(unit.templateId);
        assignments.set(segId, list);
        budgetEl.textContent = `Budget: ${budget - spent} gold remaining`;
      });
    }

    // Segment overview panel
    const segPanel = this.el('div', `
      flex: 1; background: ${BG_PANEL}; border: 1px solid ${BORDER};
      border-radius: 4px; padding: 12px; max-height: 400px; overflow-y: auto;
    `, container);
    const segTitle = this.el('div', `
      color: ${GOLD}; font: ${FONT_TITLE}; margin-bottom: 8px;
      border-bottom: 1px solid ${BORDER}; padding-bottom: 4px;
    `, segPanel);
    segTitle.textContent = 'Wall Segments';

    for (const seg of segments) {
      const ratio = seg.maxHp > 0 ? seg.hp / seg.maxHp : 1;
      const row = this.el('div', `
        padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.05);
      `, segPanel);
      row.innerHTML = `
        <div style="color:${GOLD}; font:${FONT_SMALL}">
          ${seg.id} <span style="color:${TEXT_DIM}">[${seg.segmentType}]</span>
        </div>
        <div style="width:100%; height:6px; background:rgba(0,0,0,0.3);
             margin-top:2px; border-radius:1px; overflow:hidden">
          <div style="width:${ratio * 100}%; height:100%;
               background:${ratio > 0.6 ? GREEN : ratio > 0.3 ? ORANGE : RED}"></div>
        </div>
        <div style="color:${TEXT_DIM}; font:9px monospace; margin-top:1px">
          HP: ${seg.hp}/${seg.maxHp}
        </div>
      `;
    }

    // Confirm button
    const confirmBtn = this.el('button', `
      background: ${GOLD}; color: ${BG_DARK}; border: none;
      padding: 10px 32px; cursor: pointer; font: bold 16px monospace;
      border-radius: 4px; margin-top: 20px; transition: opacity 0.2s;
    `, this.deploymentOverlay);
    confirmBtn.textContent = 'Begin Battle';
    confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.opacity = '0.85'; });
    confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.opacity = '1'; });
    confirmBtn.addEventListener('click', () => {
      this._onDeployConfirm?.(assignments);
      this.hideDeploymentUI();
    });
  }

  hideDeploymentUI(): void {
    if (this.deploymentOverlay) {
      this.deploymentOverlay.remove();
      this.deploymentOverlay = null;
    }
  }

  // ── Dispose ─────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.resourceBar) { this.resourceBar.remove(); this.resourceBar = null; }
    if (this.troopRoster) { this.troopRoster.remove(); this.troopRoster = null; }
    if (this.wallStatusBar) { this.wallStatusBar.remove(); this.wallStatusBar = null; }
    if (this.commandPanel) { this.commandPanel.remove(); this.commandPanel = null; }
    if (this.alertContainer) { this.alertContainer.remove(); this.alertContainer = null; }
    if (this.eventLogContainer) { this.eventLogContainer.remove(); this.eventLogContainer = null; }
    this.hideDeploymentUI();
    for (const alert of this.activeAlerts) { alert.remove(); }
    this.activeAlerts = [];
    this.eventLogEntries = [];
  }
}
