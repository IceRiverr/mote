// ---------------------------------------------------------------------------
// src/listening-pot-system.ts — Listening pot detection system
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PotSignal {
  potId: string;
  potX: number;
  potY: number;
  intensity: number;   // 0 = none, 1 = far, 2 = medium, 3 = near
  direction: number;   // radians
  active: boolean;
}

export interface SuspiciousArea {
  id: string;
  bounds: { x: number; y: number; w: number; h: number };
  confidence: number;  // 0-100
  markedAt: number;    // game-time when marked
}

interface PotEntry {
  x: number;
  y: number;
  radius: number;
  specialistId: string;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTOR_SIZE = Math.PI / 4;        // 45-degree sectors
const NOISE_RANGE = Math.PI / 12;       // +/- 15 degrees
const HARD_SOIL_SIGNAL_MULT = 1.3;      // hard soil amplifies digging sound
const MOAT_NOISE_MULT = 0.7;            // moat proximity reduces clarity
const FAN_HALF_ANGLE = Math.PI / 8;     // 22.5-degree half-angle for fan

// Confidence thresholds for counter-actions
const CONFIDENCE_FLOOD = 30;
const CONFIDENCE_COUNTER_DIG = 60;
const CONFIDENCE_AMBUSH = 80;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _nextAreaId = 0;
function genAreaId(): string {
  return `area_${++_nextAreaId}`;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function quantizeAngle(angle: number): number {
  return Math.round(angle / SECTOR_SIZE) * SECTOR_SIZE;
}

function normalizeAngle(a: number): number {
  while (a < -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

// ---------------------------------------------------------------------------
// ListeningPotSystem
// ---------------------------------------------------------------------------

export class ListeningPotSystem {
  pots: Map<string, PotEntry> = new Map();
  signals: PotSignal[] = [];
  suspiciousAreas: SuspiciousArea[] = [];

  /** Positions of moat tiles in world coords (set externally). */
  moatPositions: Array<{ x: number; y: number }> = [];

  /** Current game time (updated externally or via update). */
  private gameTime = 0;

  // -----------------------------------------------------------------------
  // Pot management
  // -----------------------------------------------------------------------

  deployPot(id: string, x: number, y: number, radius: number, specialistId: string): void {
    this.pots.set(id, { x, y, radius, specialistId, active: true });
  }

  removePot(id: string): void {
    this.pots.delete(id);
  }

  // -----------------------------------------------------------------------
  // Per-frame signal calculation
  // -----------------------------------------------------------------------

  /**
   * Recalculate all pot signals based on active digging positions.
   *
   * @param activeDigging  Array of digging positions and soil types from
   *                       TunnelSystem.getActiveDigging().
   */
  update(activeDigging: Array<{ x: number; y: number; soilType: string }>): void {
    this.signals = [];

    for (const [potId, pot] of this.pots) {
      if (!pot.active || !pot.specialistId) {
        this.signals.push({
          potId,
          potX: pot.x,
          potY: pot.y,
          intensity: 0,
          direction: 0,
          active: false,
        });
        continue;
      }

      let bestIntensity = 0;
      let bestDirection = 0;

      for (const dig of activeDigging) {
        const d = dist(pot.x, pot.y, dig.x, dig.y);
        if (d > pot.radius) continue;

        // Raw intensity based on distance ratio
        const ratio = 1 - d / pot.radius;

        // Soil hardness modifier: hard soil transmits sound better
        const soilMod = dig.soilType === 'hard' ? HARD_SOIL_SIGNAL_MULT : 1.0;

        // Moat noise reduction if pot is near moat
        const moatMod = this.isNearMoat(pot.x, pot.y) ? MOAT_NOISE_MULT : 1.0;

        const intensity = ratio * soilMod * moatMod;

        if (intensity > bestIntensity) {
          bestIntensity = intensity;

          // Direction from pot to dig source
          const rawAngle = Math.atan2(dig.y - pot.y, dig.x - pot.x);
          const quantized = quantizeAngle(rawAngle);
          const noise = (Math.random() - 0.5) * 2 * NOISE_RANGE;
          bestDirection = quantized + noise;
        }
      }

      // Quantize intensity to 4 levels: 0=none, 1=far, 2=medium, 3=near
      let level: number;
      if (bestIntensity > 0.7) {
        level = 3;
      } else if (bestIntensity > 0.4) {
        level = 2;
      } else if (bestIntensity > 0.1) {
        level = 1;
      } else {
        level = 0;
      }

      this.signals.push({
        potId,
        potX: pot.x,
        potY: pot.y,
        intensity: level,
        direction: bestDirection,
        active: level > 0,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Triangulation
  // -----------------------------------------------------------------------

  /**
   * Given multiple pot IDs, calculate the overlap area of their directional
   * fans.  Returns a bounding rectangle of the overlapping region or null
   * if the fans do not intersect.
   */
  triangulate(potIds: string[]): { x: number; y: number; w: number; h: number } | null {
    // Gather active signals for the requested pots
    const fans: Array<{ cx: number; cy: number; dir: number; radius: number }> = [];
    for (const pid of potIds) {
      const sig = this.signals.find(s => s.potId === pid);
      if (!sig || !sig.active) continue;
      const pot = this.pots.get(pid);
      if (!pot) continue;

      fans.push({
        cx: pot.x,
        cy: pot.y,
        dir: sig.direction,
        radius: pot.radius,
      });
    }

    if (fans.length < 2) return null;

    // For each fan, compute a bounding box of the fan sector
    // Then intersect all bounding boxes
    let minX = -Infinity, minY = -Infinity;
    let maxX = Infinity, maxY = Infinity;

    for (const fan of fans) {
      // Fan endpoints
      const d1 = fan.dir - FAN_HALF_ANGLE;
      const d2 = fan.dir + FAN_HALF_ANGLE;
      const r = fan.radius;

      const px1 = fan.cx + Math.cos(d1) * r;
      const py1 = fan.cy + Math.sin(d1) * r;
      const px2 = fan.cx + Math.cos(d2) * r;
      const py2 = fan.cy + Math.sin(d2) * r;

      const fanMinX = Math.min(fan.cx, px1, px2);
      const fanMinY = Math.min(fan.cy, py1, py2);
      const fanMaxX = Math.max(fan.cx, px1, px2);
      const fanMaxY = Math.max(fan.cy, py1, py2);

      minX = Math.max(minX, fanMinX);
      minY = Math.max(minY, fanMinY);
      maxX = Math.min(maxX, fanMaxX);
      maxY = Math.min(maxY, fanMaxY);
    }

    if (minX >= maxX || minY >= maxY) {
      // No overlap — expand slightly as an approximation
      const cxAvg = fans.reduce((s, f) => s + f.cx + Math.cos(f.dir) * f.radius * 0.5, 0) / fans.length;
      const cyAvg = fans.reduce((s, f) => s + f.cy + Math.sin(f.dir) * f.radius * 0.5, 0) / fans.length;
      const estimatedSize = 96;
      return {
        x: cxAvg - estimatedSize / 2,
        y: cyAvg - estimatedSize / 2,
        w: estimatedSize,
        h: estimatedSize,
      };
    }

    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  // -----------------------------------------------------------------------
  // Suspicious area management
  // -----------------------------------------------------------------------

  markSuspiciousArea(
    bounds: { x: number; y: number; w: number; h: number },
    potSignals: PotSignal[],
  ): SuspiciousArea {
    const confidence = this.calculateConfidence(bounds, potSignals);
    const area: SuspiciousArea = {
      id: genAreaId(),
      bounds,
      confidence,
      markedAt: this.gameTime,
    };
    this.suspiciousAreas.push(area);
    return area;
  }

  /**
   * Calculate confidence score based on number of converging signals.
   *
   * - 1 pot with signal:  30 %
   * - 2 pots converging:  60 %
   * - 3+ pots converging: 85 %
   */
  calculateConfidence(
    _area: { x: number; y: number; w: number; h: number },
    signals: PotSignal[],
  ): number {
    const activeCount = signals.filter(s => s.active).length;
    if (activeCount >= 3) return 85;
    if (activeCount === 2) return 60;
    if (activeCount === 1) return 30;
    return 0;
  }

  // -----------------------------------------------------------------------
  // Getters
  // -----------------------------------------------------------------------

  getSignals(): PotSignal[] {
    return this.signals;
  }

  getSuspiciousAreas(): SuspiciousArea[] {
    return this.suspiciousAreas;
  }

  // -----------------------------------------------------------------------
  // Counter-action eligibility
  // -----------------------------------------------------------------------

  canFlood(areaId: string): boolean {
    const area = this.suspiciousAreas.find(a => a.id === areaId);
    return area !== undefined && area.confidence >= CONFIDENCE_FLOOD;
  }

  canCounterDig(areaId: string): boolean {
    const area = this.suspiciousAreas.find(a => a.id === areaId);
    return area !== undefined && area.confidence >= CONFIDENCE_COUNTER_DIG;
  }

  canAmbush(areaId: string): boolean {
    const area = this.suspiciousAreas.find(a => a.id === areaId);
    return area !== undefined && area.confidence >= CONFIDENCE_AMBUSH;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private isNearMoat(x: number, y: number): boolean {
    const threshold = 96; // within 3 tiles
    for (const m of this.moatPositions) {
      if (dist(x, y, m.x, m.y) < threshold) return true;
    }
    return false;
  }
}
