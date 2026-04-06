/**
 * AISystem — Enemy AI + Wave Management
 *
 * Controls the non-player side (attacker or defender) with:
 *   - Wave-based enemy spawning with escalating difficulty
 *   - Periodic strategic decision-making (every 3-5 seconds)
 *   - Attacker strategies: Probe → Advance → Assault → Feint
 *   - Defender strategies: Distribute → Reinforce → Deploy reserves
 *   - Difficulty scaling for AI reaction time and decision quality
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Configuration for a single attack/defense wave. */
export interface WaveConfig {
  /** Which round/wave number this config belongs to. */
  round: number;
  /** Type of units in this wave. */
  type: 'infantry' | 'archer' | 'engineer' | 'mixed' | 'elite';
  /** Number of units to spawn. */
  count: number;
  /** Number of siege ladders provided (attacker only). */
  ladders?: number;
  /** Number of battering rams provided (attacker only). */
  rams?: number;
  /** Delay in seconds before this wave spawns after trigger. */
  delay?: number;
}

/** Represents a strategic decision made by the AI. */
export interface AIDecision {
  /** The type of strategic action. */
  type:
    | 'probe'
    | 'advance'
    | 'assault'
    | 'feint'
    | 'distribute_archers'
    | 'reinforce'
    | 'deploy_oil'
    | 'deploy_reserves'
    | 'retreat'
    | 'hold';
  /** Target wall segment ID for the action. */
  targetSegment?: string;
  /** Target world position. */
  targetPosition?: { x: number; y: number };
  /** Unit IDs assigned to carry out this decision. */
  units?: string[];
}

/** Threat assessment for a wall segment or area. */
export interface ThreatLevel {
  segmentId: string;
  /** 0-1 normalized threat value. */
  threat: number;
  /** Number of enemy units near this segment. */
  enemyCount: number;
  /** Wall HP ratio (0-1). */
  wallHpRatio: number;
  /** Whether a breach exists. */
  breached: boolean;
}

/** Entity-like interface for units the AI manages. */
export interface AIUnit {
  id: string;
  x: number;
  y: number;
  getField<T>(name: string): T;
  setField(name: string, value: unknown): void;
}

/** Spawn point descriptor. */
export interface SpawnPoint {
  x: number;
  y: number;
  side: 'attacker' | 'defender';
}

/** Wall segment data for AI evaluation. */
export interface WallSegmentData {
  id: string;
  x: number;
  y: number;
  width: number;
  hp: number;
  maxHp: number;
  breached: boolean;
  defenderCount: number;
  attackerCount: number;
}

/** Snapshot of the battlefield passed to the AI each decision cycle. */
export interface BattleState {
  /** Current game time in seconds. */
  gameTime: number;
  /** Current round/wave number. */
  currentRound: number;
  /** All wall segment data. */
  wallSegments: WallSegmentData[];
  /** All attacker units. */
  attackerUnits: AIUnit[];
  /** All defender units. */
  defenderUnits: AIUnit[];
  /** Attacker spawn points. */
  attackerSpawns: SpawnPoint[];
  /** Defender spawn points (reserves). */
  defenderSpawns: SpawnPoint[];
  /** Current battle phase: probe → advance → assault → street_fight. */
  phase: 'probe' | 'advance' | 'assault' | 'street_fight';
  /** Global morale for each side (0-100). */
  attackerMorale: number;
  defenderMorale: number;
}

/** Spawner interface — the AI calls this to create units. */
export interface UnitSpawner {
  spawnUnit(
    type: string,
    x: number,
    y: number,
    side: 'attacker' | 'defender',
    fields?: Record<string, unknown>,
  ): AIUnit;
}

// ── AISystem ─────────────────────────────────────────────────────────────

export class AISystem {
  /** Which side the AI controls. */
  side: 'attacker' | 'defender';

  /** All wave configurations for the current level. */
  waveConfigs: WaveConfig[];

  /** Set of round numbers that have already been spawned. */
  spawnedWaves: Set<number> = new Set();

  /** Timer counting down to the next strategic decision (seconds). */
  decisionTimer: number = 0;

  /** Base interval between AI decisions (seconds). */
  private decisionInterval: number = 4;

  /** Minimum decision interval (seconds). */
  private minDecisionInterval: number = 3;

  /** Maximum decision interval (seconds). */
  private maxDecisionInterval: number = 5;

  /** Current difficulty level (1-5). Affects reaction time and quality. */
  private difficulty: number = 3;

  /** History of recent decisions for avoiding repetition. */
  private recentDecisions: AIDecision[] = [];

  /** Maximum recent decisions to track. */
  private readonly maxRecentDecisions: number = 5;

  /** Pending wave spawn timers: { config, remainingDelay }. */
  private pendingWaves: Array<{ config: WaveConfig; remainingDelay: number }> = [];

  /** Decision listeners — external systems can subscribe to AI decisions. */
  private decisionListeners: Array<(decision: AIDecision) => void> = [];

  constructor(
    side: 'attacker' | 'defender',
    waveConfigs: WaveConfig[],
    difficulty: number = 3,
  ) {
    this.side = side;
    this.waveConfigs = waveConfigs;
    this.applyDifficulty(difficulty);
    // Randomize initial decision timer so AI doesn't act on frame 0
    this.decisionTimer = 1 + Math.random() * 2;
  }

  // ── Event subscription ────────────────────────────────────────────

  onDecision(listener: (decision: AIDecision) => void): void {
    this.decisionListeners.push(listener);
  }

  private emitDecision(decision: AIDecision): void {
    for (const listener of this.decisionListeners) {
      listener(decision);
    }
  }

  // ── Main update loop ──────────────────────────────────────────────

  /**
   * Called every frame. Manages wave spawning timers and periodic
   * strategic decision-making.
   */
  update(dt: number, battleState: BattleState, spawner: UnitSpawner): void {
    // ── Process pending wave spawn delays ────────────────────────
    for (let i = this.pendingWaves.length - 1; i >= 0; i--) {
      const pending = this.pendingWaves[i];
      pending.remainingDelay -= dt;
      if (pending.remainingDelay <= 0) {
        this.executeSpawn(pending.config, battleState, spawner);
        this.pendingWaves.splice(i, 1);
      }
    }

    // ── Check if new waves should be triggered ──────────────────
    this.checkWaveSpawn(battleState, spawner);

    // ── Strategic decision timer ────────────────────────────────
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      const decision = this.makeDecision(battleState);
      if (decision) {
        this.recordDecision(decision);
        this.emitDecision(decision);
      }
      // Next decision in randomized interval
      this.decisionTimer =
        this.minDecisionInterval +
        Math.random() * (this.maxDecisionInterval - this.minDecisionInterval);
    }
  }

  // ── Wave spawning ─────────────────────────────────────────────────

  /**
   * Check if any wave configs should be triggered based on the
   * current round and spawn them (possibly with delay).
   */
  private checkWaveSpawn(battleState: BattleState, spawner: UnitSpawner): void {
    for (const config of this.waveConfigs) {
      if (config.round !== battleState.currentRound) continue;
      if (this.spawnedWaves.has(config.round)) continue;

      this.spawnedWaves.add(config.round);
      this.spawnWave(config, battleState, spawner);
    }
  }

  /**
   * Initiate spawning of a wave. If the wave has a delay, queue it;
   * otherwise spawn immediately.
   */
  spawnWave(config: WaveConfig, battleState: BattleState, spawner: UnitSpawner): void {
    const delay = config.delay ?? 0;
    if (delay > 0) {
      this.pendingWaves.push({ config, remainingDelay: delay });
    } else {
      this.executeSpawn(config, battleState, spawner);
    }
  }

  /**
   * Actually spawn the units for a wave config at appropriate positions.
   */
  private executeSpawn(
    config: WaveConfig,
    battleState: BattleState,
    spawner: UnitSpawner,
  ): void {
    const spawns =
      this.side === 'attacker'
        ? battleState.attackerSpawns
        : battleState.defenderSpawns;

    if (spawns.length === 0) return;

    // Distribute units across available spawn points
    for (let i = 0; i < config.count; i++) {
      const sp = spawns[i % spawns.length];
      // Stagger positions slightly so units don't stack
      const offsetX = (i % 5) * 20 - 40;
      const offsetY = Math.floor(i / 5) * 12;

      const unitType = this.resolveUnitType(config.type, i, config.count);
      spawner.spawnUnit(unitType, sp.x + offsetX, sp.y + offsetY, this.side, {
        wave: config.round,
        state: 'idle',
      });
    }

    // Spawn siege equipment if specified
    if (config.ladders && config.ladders > 0) {
      for (let l = 0; l < config.ladders; l++) {
        const sp = spawns[l % spawns.length];
        spawner.spawnUnit('siege_ladder', sp.x + l * 60, sp.y, this.side, {
          wave: config.round,
        });
      }
    }

    if (config.rams && config.rams > 0) {
      for (let r = 0; r < config.rams; r++) {
        const sp = spawns[r % spawns.length];
        spawner.spawnUnit('battering_ram', sp.x + r * 80, sp.y, this.side, {
          wave: config.round,
          crewSize: 4,
        });
      }
    }
  }

  /**
   * Resolve the concrete unit template name from the wave type.
   * For 'mixed' waves, distribute different unit types.
   */
  private resolveUnitType(
    waveType: WaveConfig['type'],
    index: number,
    total: number,
  ): string {
    switch (waveType) {
      case 'infantry':
        return 'soldier_melee';
      case 'archer':
        return 'soldier_archer';
      case 'engineer':
        return 'engineer';
      case 'elite':
        return 'soldier_elite';
      case 'mixed': {
        // 50% infantry, 30% archer, 20% engineer
        const ratio = index / total;
        if (ratio < 0.5) return 'soldier_melee';
        if (ratio < 0.8) return 'soldier_archer';
        return 'engineer';
      }
      default:
        return 'soldier_melee';
    }
  }

  // ── Strategic decision-making ─────────────────────────────────────

  /**
   * Evaluate the battlefield and produce a strategic AIDecision.
   * The decision type depends on whether the AI is attacker or defender.
   */
  makeDecision(battleState: BattleState): AIDecision | null {
    if (this.side === 'attacker') {
      return this.makeAttackerDecision(battleState);
    }
    return this.makeDefenderDecision(battleState);
  }

  // ── Attacker AI strategies ────────────────────────────────────────

  private makeAttackerDecision(state: BattleState): AIDecision {
    const threats = this.evaluateThreats(state);

    // Find the weakest wall segment (lowest HP ratio, or breached)
    const weakest = this.findWeakestSegment(threats);

    // Check morale — if very low, consider retreat
    if (state.attackerMorale < 20) {
      return { type: 'retreat' };
    }

    // Strategy selection based on battle phase
    switch (state.phase) {
      case 'probe':
        return this.attackerProbe(state, threats);
      case 'advance':
        return this.attackerAdvance(state, threats, weakest);
      case 'assault':
        return this.attackerAssault(state, threats, weakest);
      case 'street_fight':
        return this.attackerAssault(state, threats, weakest);
      default:
        return this.attackerProbe(state, threats);
    }
  }

  /**
   * Probe strategy: send small groups to test defenses and find weak points.
   */
  private attackerProbe(state: BattleState, threats: ThreatLevel[]): AIDecision {
    // Pick a random segment to probe
    const segments = state.wallSegments.filter((s) => !s.breached);
    if (segments.length === 0) {
      return { type: 'assault' };
    }

    const targetSeg = segments[Math.floor(Math.random() * segments.length)];
    // Send a small scouting group (20% of idle attackers)
    const idleAttackers = state.attackerUnits.filter(
      (u) => u.getField<string>('state') === 'idle',
    );
    const probeSize = Math.max(3, Math.floor(idleAttackers.length * 0.2));
    const probeUnits = idleAttackers.slice(0, probeSize).map((u) => u.id);

    return {
      type: 'probe',
      targetSegment: targetSeg.id,
      targetPosition: { x: targetSeg.x + targetSeg.width / 2, y: targetSeg.y },
      units: probeUnits,
    };
  }

  /**
   * Advance strategy: push siege engines forward, start moat-filling,
   * and soften defenses with projectile volleys.
   */
  private attackerAdvance(
    state: BattleState,
    threats: ThreatLevel[],
    weakest: ThreatLevel | null,
  ): AIDecision {
    // Advance toward the weakest segment
    const target = weakest ?? threats[0];
    if (!target) return { type: 'hold' };

    const idleAttackers = state.attackerUnits.filter(
      (u) => u.getField<string>('state') === 'idle',
    );
    const advanceSize = Math.max(5, Math.floor(idleAttackers.length * 0.5));
    const advanceUnits = idleAttackers.slice(0, advanceSize).map((u) => u.id);

    const seg = state.wallSegments.find((s) => s.id === target.segmentId);

    return {
      type: 'advance',
      targetSegment: target.segmentId,
      targetPosition: seg
        ? { x: seg.x + seg.width / 2, y: seg.y }
        : undefined,
      units: advanceUnits,
    };
  }

  /**
   * Assault strategy: concentrate forces on the weakest wall segment.
   * Sometimes uses a feint to misdirect defenders.
   */
  private attackerAssault(
    state: BattleState,
    threats: ThreatLevel[],
    weakest: ThreatLevel | null,
  ): AIDecision {
    // 25% chance of feint (adjusted by difficulty)
    const feintChance = 0.15 + (this.difficulty - 1) * 0.05;
    if (Math.random() < feintChance && threats.length >= 2) {
      return this.attackerFeint(state, threats, weakest);
    }

    const target = weakest ?? threats[0];
    if (!target) return { type: 'hold' };

    const idleAttackers = state.attackerUnits.filter(
      (u) => u.getField<string>('state') === 'idle',
    );
    // Commit a large portion of forces
    const assaultSize = Math.max(8, Math.floor(idleAttackers.length * 0.7));
    const assaultUnits = idleAttackers.slice(0, assaultSize).map((u) => u.id);

    const seg = state.wallSegments.find((s) => s.id === target.segmentId);

    return {
      type: 'assault',
      targetSegment: target.segmentId,
      targetPosition: seg
        ? { x: seg.x + seg.width / 2, y: seg.y }
        : undefined,
      units: assaultUnits,
    };
  }

  /**
   * Feint strategy: make a diversionary attack on one segment while
   * the main force hits the real target from the other side.
   */
  private attackerFeint(
    state: BattleState,
    threats: ThreatLevel[],
    weakest: ThreatLevel | null,
  ): AIDecision {
    // Pick a feint target different from the real target
    const realTarget = weakest ?? threats[0];
    const feintCandidates = threats.filter(
      (t) => t.segmentId !== realTarget?.segmentId,
    );
    const feintTarget =
      feintCandidates.length > 0
        ? feintCandidates[Math.floor(Math.random() * feintCandidates.length)]
        : threats[0];

    const idleAttackers = state.attackerUnits.filter(
      (u) => u.getField<string>('state') === 'idle',
    );

    // 30% of forces for feint, 70% for real assault
    const feintSize = Math.max(2, Math.floor(idleAttackers.length * 0.3));
    const feintUnits = idleAttackers.slice(0, feintSize).map((u) => u.id);

    const seg = state.wallSegments.find((s) => s.id === feintTarget.segmentId);

    return {
      type: 'feint',
      targetSegment: feintTarget.segmentId,
      targetPosition: seg
        ? { x: seg.x + seg.width / 2, y: seg.y }
        : undefined,
      units: feintUnits,
    };
  }

  // ── Defender AI strategies ────────────────────────────────────────

  private makeDefenderDecision(state: BattleState): AIDecision {
    const threats = this.evaluateThreats(state);

    // Check morale — if very low, hold and pray
    if (state.defenderMorale < 15) {
      return { type: 'hold' };
    }

    // Check for breaches — highest priority
    const breachedThreats = threats.filter((t) => t.breached);
    if (breachedThreats.length > 0) {
      return this.defenderDeployReserves(state, breachedThreats[0]);
    }

    // Find the most threatened segment
    const mostThreatened = threats.reduce(
      (max, t) => (t.threat > max.threat ? t : max),
      threats[0],
    );

    if (!mostThreatened) return { type: 'hold' };

    // High threat: reinforce
    if (mostThreatened.threat > 0.7) {
      return this.defenderReinforce(state, mostThreatened);
    }

    // Medium threat: check if oil/rocks should be used
    if (mostThreatened.threat > 0.4 && mostThreatened.enemyCount > 5) {
      return this.defenderDeployOil(state, mostThreatened);
    }

    // Low threat: distribute archers evenly
    return this.defenderDistributeArchers(state, threats);
  }

  /**
   * Distribute archers evenly across all wall segments, weighted by threat.
   */
  private defenderDistributeArchers(
    state: BattleState,
    threats: ThreatLevel[],
  ): AIDecision {
    const archers = state.defenderUnits.filter(
      (u) => u.getField<string>('unitType') === 'archer' &&
             u.getField<string>('state') === 'idle',
    );

    if (archers.length === 0) return { type: 'hold' };

    // Weight distribution by threat level
    const totalThreat = threats.reduce((sum, t) => sum + Math.max(t.threat, 0.1), 0);
    const unitIds: string[] = [];
    let assigned = 0;

    for (const threat of threats) {
      const weight = Math.max(threat.threat, 0.1) / totalThreat;
      const count = Math.max(1, Math.round(archers.length * weight));
      for (let i = 0; i < count && assigned < archers.length; i++) {
        unitIds.push(archers[assigned].id);
        assigned++;
      }
    }

    return {
      type: 'distribute_archers',
      units: unitIds,
    };
  }

  /**
   * Reinforce a threatened wall segment by moving nearby idle defenders.
   */
  private defenderReinforce(
    state: BattleState,
    threat: ThreatLevel,
  ): AIDecision {
    const seg = state.wallSegments.find((s) => s.id === threat.segmentId);
    if (!seg) return { type: 'hold' };

    // Find idle defenders not already at this segment
    const idleDefenders = state.defenderUnits.filter(
      (u) => u.getField<string>('state') === 'idle',
    );

    // Sort by distance to the threatened segment
    const sorted = idleDefenders.sort((a, b) => {
      const distA = Math.abs(a.x - (seg.x + seg.width / 2));
      const distB = Math.abs(b.x - (seg.x + seg.width / 2));
      return distA - distB;
    });

    const reinforceCount = Math.min(sorted.length, Math.max(3, threat.enemyCount));
    const units = sorted.slice(0, reinforceCount).map((u) => u.id);

    return {
      type: 'reinforce',
      targetSegment: threat.segmentId,
      targetPosition: { x: seg.x + seg.width / 2, y: seg.y },
      units,
    };
  }

  /**
   * Deploy oil/rocks when enemies are massed at the wall base.
   */
  private defenderDeployOil(
    state: BattleState,
    threat: ThreatLevel,
  ): AIDecision {
    const seg = state.wallSegments.find((s) => s.id === threat.segmentId);
    if (!seg) return { type: 'hold' };

    return {
      type: 'deploy_oil',
      targetSegment: threat.segmentId,
      targetPosition: { x: seg.x + seg.width / 2, y: seg.y },
    };
  }

  /**
   * Deploy reserve units to plug a breach.
   */
  private defenderDeployReserves(
    state: BattleState,
    threat: ThreatLevel,
  ): AIDecision {
    const seg = state.wallSegments.find((s) => s.id === threat.segmentId);
    if (!seg) return { type: 'hold' };

    // Commit all idle defenders as reserves
    const reserves = state.defenderUnits.filter(
      (u) => u.getField<string>('state') === 'idle',
    );
    const units = reserves.map((u) => u.id);

    return {
      type: 'deploy_reserves',
      targetSegment: threat.segmentId,
      targetPosition: { x: seg.x + seg.width / 2, y: seg.y },
      units,
    };
  }

  // ── Threat evaluation ─────────────────────────────────────────────

  /**
   * Analyze the battlefield and produce a threat level for each wall segment.
   * Higher threat = more enemies, lower wall HP, closer to breach.
   */
  evaluateThreats(state: BattleState): ThreatLevel[] {
    const threats: ThreatLevel[] = [];

    for (const seg of state.wallSegments) {
      const hpRatio = seg.maxHp > 0 ? seg.hp / seg.maxHp : 0;

      // Count nearby enemies (within 150px of the segment center)
      const segCenterX = seg.x + seg.width / 2;
      const enemyUnits =
        this.side === 'defender' ? state.attackerUnits : state.defenderUnits;

      let enemyCount = 0;
      for (const unit of enemyUnits) {
        const dx = Math.abs(unit.x - segCenterX);
        if (dx < 150) {
          enemyCount++;
        }
      }

      // Threat formula:
      //   threat = (1 - hpRatio) * 0.4 + normalizedEnemyCount * 0.4 + breachBonus * 0.2
      const maxExpectedEnemies = 20;
      const normalizedEnemyCount = Math.min(1, enemyCount / maxExpectedEnemies);
      const breachBonus = seg.breached ? 1 : 0;

      const threat =
        (1 - hpRatio) * 0.4 +
        normalizedEnemyCount * 0.4 +
        breachBonus * 0.2;

      threats.push({
        segmentId: seg.id,
        threat: Math.min(1, Math.max(0, threat)),
        enemyCount,
        wallHpRatio: hpRatio,
        breached: seg.breached,
      });
    }

    // Sort by threat descending
    threats.sort((a, b) => b.threat - a.threat);
    return threats;
  }

  /**
   * Find the wall segment with the lowest HP ratio (most vulnerable).
   */
  private findWeakestSegment(threats: ThreatLevel[]): ThreatLevel | null {
    if (threats.length === 0) return null;

    // Prefer breached segments, then lowest HP ratio
    const breached = threats.find((t) => t.breached);
    if (breached) return breached;

    return threats.reduce((weakest, t) =>
      t.wallHpRatio < weakest.wallHpRatio ? t : weakest,
    );
  }

  // ── Decision tracking ─────────────────────────────────────────────

  private recordDecision(decision: AIDecision): void {
    this.recentDecisions.push(decision);
    if (this.recentDecisions.length > this.maxRecentDecisions) {
      this.recentDecisions.shift();
    }
  }

  /** Check if a decision type was made recently (to avoid repetition). */
  wasRecentlyDecided(type: AIDecision['type']): boolean {
    return this.recentDecisions.some((d) => d.type === type);
  }

  // ── Difficulty scaling ────────────────────────────────────────────

  /**
   * Apply difficulty level (1-5). Affects:
   *   - Decision interval (lower = faster reactions)
   *   - Strategic quality (higher = smarter choices, e.g., more feints)
   */
  applyDifficulty(level: number): void {
    this.difficulty = Math.max(1, Math.min(5, level));

    // Higher difficulty → faster decisions
    // Level 1: 5-7s, Level 3: 3-5s, Level 5: 1.5-3s
    const baseMin = 5 - (this.difficulty - 1) * 0.9;
    const baseMax = 7 - (this.difficulty - 1) * 1.0;
    this.minDecisionInterval = Math.max(1.5, baseMin);
    this.maxDecisionInterval = Math.max(this.minDecisionInterval + 0.5, baseMax);
    this.decisionInterval =
      (this.minDecisionInterval + this.maxDecisionInterval) / 2;
  }

  // ── Accessors ─────────────────────────────────────────────────────

  /** Get the current decision interval range. */
  getDecisionIntervalRange(): { min: number; max: number } {
    return { min: this.minDecisionInterval, max: this.maxDecisionInterval };
  }

  /** Get the current difficulty level. */
  getDifficulty(): number {
    return this.difficulty;
  }

  /** Reset AI state (e.g., between levels). */
  reset(): void {
    this.spawnedWaves.clear();
    this.pendingWaves.length = 0;
    this.recentDecisions.length = 0;
    this.decisionTimer = 1 + Math.random() * 2;
  }
}
