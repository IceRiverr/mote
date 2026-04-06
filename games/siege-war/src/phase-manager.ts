/**
 * PhaseManager -- 阶段管理系统
 *
 * Manages the progression of battle phases:
 *   试探期 (Probing) -> 推进期 (Advance) -> 总攻期 (Assault) ->
 *   巷战期 (StreetFight) -> Victory / Defeat
 *
 * Between major phases the defender gets a "喘息时间" (BreathingTime) window
 * to repair walls and redeploy units.
 *
 * Phase transitions are driven by battlefield conditions (morale, wall HP,
 * moat state, unit positions) checked each frame. The PhaseManager does NOT
 * directly modify game state -- it only reads a BattleState snapshot and
 * emits events when transitions occur.
 *
 * Design reference: PRD section 7
 * - Probing: 1-2 rounds, ranged fire exchange, scouting
 * - Advance: 3-5 rounds, fill moat / push engines / dig tunnels
 * - Assault: 2-3 rounds, full attack, multi-point breach
 * - StreetFight: 1-2 rounds (if wall breached), urn-city / inner wall combat
 */

import { EventEmitter } from './command-system';

// ── Battle Phases ───────────────────────────────────────────────────────────

export enum BattlePhase {
  Probing       = 'probing',        // 试探期
  Advance       = 'advance',        // 推进期
  Assault       = 'assault',        // 总攻期
  StreetFight   = 'street_fight',   // 巷战期
  BreathingTime = 'breathing',      // 喘息时间 (between phases)
  Victory       = 'victory',        // 攻方胜利 (defender morale = 0)
  Defeat        = 'defeat',         // 攻方败退 (attacker morale = 0)
}

// ── Phase Configuration ─────────────────────────────────────────────────────

/**
 * Configuration for a single battle phase.
 */
export interface PhaseConfig {
  /** The phase this config applies to. */
  phase: BattlePhase;
  /** Minimum duration in seconds before transition is allowed. */
  minDuration: number;
  /** Maximum duration in seconds -- force transition after this. */
  maxDuration: number;
  /** Human-readable Chinese name. */
  nameCN: string;
  /** Description of what happens in this phase. */
  description: string;
}

/**
 * Default phase configurations matching the PRD round durations.
 * One "round" = ~60 seconds of game time.
 */
const PHASE_CONFIGS: Record<string, PhaseConfig> = {
  [BattlePhase.Probing]: {
    phase: BattlePhase.Probing,
    minDuration: 60,      // 1 round minimum
    maxDuration: 120,     // 2 rounds max -> auto advance
    nameCN: '试探期',
    description: '双方远程火力交换；侦察对方布局。投石机校准，弓弩手压制。',
  },
  [BattlePhase.Advance]: {
    phase: BattlePhase.Advance,
    minDuration: 180,     // 3 rounds minimum
    maxDuration: 300,     // 5 rounds max
    nameCN: '推进期',
    description: '攻方开始填壕、推进器械、挖掘地道。守方加强防御，部署听瓮。',
  },
  [BattlePhase.Assault]: {
    phase: BattlePhase.Assault,
    minDuration: 120,     // 2 rounds minimum
    maxDuration: 180,     // 3 rounds max
    nameCN: '总攻期',
    description: '全面进攻，多点突破。云梯架设，攻城锤撞门，投石机集中轰击。',
  },
  [BattlePhase.StreetFight]: {
    phase: BattlePhase.StreetFight,
    minDuration: 60,      // 1 round minimum
    maxDuration: 120,     // 2 rounds max
    nameCN: '巷战期',
    description: '城墙被破或城门被破后，瓮城和内城展开激烈巷战。',
  },
  [BattlePhase.BreathingTime]: {
    phase: BattlePhase.BreathingTime,
    minDuration: 15,
    maxDuration: 30,      // Breathing window
    nameCN: '喘息时间',
    description: '短暂休战。守方可修复城墙、重新部署单位、补充资源。',
  },
  [BattlePhase.Victory]: {
    phase: BattlePhase.Victory,
    minDuration: 0,
    maxDuration: Infinity,
    nameCN: '胜利',
    description: '守方士气归零，开城投降。攻方取得最终胜利。',
  },
  [BattlePhase.Defeat]: {
    phase: BattlePhase.Defeat,
    minDuration: 0,
    maxDuration: Infinity,
    nameCN: '败退',
    description: '攻方士气归零，撤围退兵。守方成功坚守城池。',
  },
};

// ── Battle State Snapshot (read-only interface for condition checks) ─────────

/**
 * A snapshot of the current battlefield state, provided each frame by the
 * game loop. The PhaseManager reads this but never writes to it.
 */
export interface BattleState {
  /** Fraction of battlefield the attacker's farthest engine has crossed (0..1). */
  attackerAdvanceRatio: number;
  /** Whether the moat has been bridged or filled at any point. */
  moatBridged: boolean;
  /** Lowest wall HP ratio among all wall segments (0..1). */
  lowestWallHpRatio: number;
  /** Whether any wall segment has been fully breached. */
  anyWallBreached: boolean;
  /** Whether the main gate has been breached. */
  gateBreached: boolean;
  /** Current defender morale (0-100). */
  defenderMorale: number;
  /** Current attacker morale (0-100). */
  attackerMorale: number;
  /** Number of attacker units that have entered the city interior. */
  attackersInsideCity: number;
  /** Total alive defender soldiers count. */
  defenderSoldierCount: number;
  /** Total alive attacker soldiers count. */
  attackerSoldierCount: number;
}

// ── PhaseManager ────────────────────────────────────────────────────────────

/**
 * PhaseManager drives the progression of battle phases.
 *
 * Each frame, the game loop calls `update(dt, battleState)`. The manager
 * checks whether transition conditions are met and advances the phase when
 * appropriate. A BreathingTime window is inserted between major phases.
 *
 * Events emitted:
 * - `phase:changed`        -- phase transition ({ from, to, round })
 * - `phase:breathing_start` -- breathing time started ({ duration })
 * - `phase:breathing_end`   -- breathing time ended, next phase begins
 * - `phase:victory`         -- game over: attacker wins
 * - `phase:defeat`          -- game over: attacker loses (defender wins)
 */
export class PhaseManager {
  /** Current active battle phase. */
  private currentPhase: BattlePhase = BattlePhase.Probing;

  /** Time spent in the current phase (seconds). */
  private phaseTime: number = 0;

  /** Current round number (incremented on major phase transitions). */
  private round: number = 1;

  /** Maximum number of rounds before forced outcome. */
  private maxRounds: number = 15;

  /** Cross-system event bus. */
  public readonly events: EventEmitter = new EventEmitter();

  /** Whether the game has ended (Victory or Defeat). */
  private gameOver: boolean = false;

  /** Phase to transition to after BreathingTime ends. */
  private nextPhaseAfterBreathing: BattlePhase | null = null;

  /** Duration of the current breathing time window. */
  private breathingDuration: number = 0;

  /** Phase configs (can be overridden per level). */
  private configs: Record<string, PhaseConfig> = { ...PHASE_CONFIGS };

  // ── Initialization ──────────────────────────────────────────────────────

  constructor(maxRounds: number = 15) {
    this.maxRounds = maxRounds;
  }

  /**
   * Override phase configs for a specific level.
   */
  setPhaseConfig(phase: BattlePhase, config: Partial<PhaseConfig>): void {
    const existing = this.configs[phase];
    if (existing) {
      this.configs[phase] = { ...existing, ...config };
    }
  }

  // ── Per-Frame Update ────────────────────────────────────────────────────

  /**
   * Main update tick. Called once per frame.
   *
   * @param dt          - Delta time in seconds.
   * @param battleState - Current battlefield snapshot.
   */
  update(dt: number, battleState: BattleState): void {
    if (this.gameOver) return;

    this.phaseTime += dt;

    // Always check morale-based game end conditions first
    if (battleState.defenderMorale <= 0) {
      this.transitionTo(BattlePhase.Victory);
      return;
    }
    if (battleState.attackerMorale <= 0) {
      this.transitionTo(BattlePhase.Defeat);
      return;
    }

    // Round limit check
    if (this.round > this.maxRounds) {
      // If rounds exhausted, attacker failed to take the city
      this.transitionTo(BattlePhase.Defeat);
      return;
    }

    // Phase-specific transition logic
    switch (this.currentPhase) {
      case BattlePhase.Probing:
        this.updateProbing(battleState);
        break;
      case BattlePhase.Advance:
        this.updateAdvance(battleState);
        break;
      case BattlePhase.Assault:
        this.updateAssault(battleState);
        break;
      case BattlePhase.StreetFight:
        this.updateStreetFight(battleState);
        break;
      case BattlePhase.BreathingTime:
        this.updateBreathingTime();
        break;
      case BattlePhase.Victory:
      case BattlePhase.Defeat:
        // Terminal states -- nothing to update
        break;
    }
  }

  // ── Phase-Specific Transition Checks ────────────────────────────────────

  /**
   * Probing -> Advance:
   * - Attacker moves engines past halfway (advanceRatio > 0.5), OR
   * - Timer exceeds maxDuration (2 rounds)
   */
  private updateProbing(state: BattleState): void {
    const config = this.configs[BattlePhase.Probing];

    // Cannot transition before minimum duration
    if (this.phaseTime < config.minDuration) return;

    const conditionMet =
      state.attackerAdvanceRatio > 0.5 ||
      this.phaseTime >= config.maxDuration;

    if (conditionMet) {
      this.startBreathingTime(20, BattlePhase.Advance);
    }
  }

  /**
   * Advance -> Assault:
   * - Moat bridged/filled at any point, OR
   * - Any wall damaged below 70% HP, OR
   * - Timer exceeds maxDuration (5 rounds)
   */
  private updateAdvance(state: BattleState): void {
    const config = this.configs[BattlePhase.Advance];

    if (this.phaseTime < config.minDuration) return;

    const conditionMet =
      state.moatBridged ||
      state.lowestWallHpRatio < 0.7 ||
      this.phaseTime >= config.maxDuration;

    if (conditionMet) {
      this.startBreathingTime(25, BattlePhase.Assault);
    }
  }

  /**
   * Assault -> StreetFight:
   * - Any wall segment fully breached, OR
   * - Main gate breached, OR
   * - Timer exceeds maxDuration (3 rounds)
   *
   * If timer expires without breach, attacker morale should be suffering
   * from HeavyCasualties events, potentially triggering Defeat instead.
   */
  private updateAssault(state: BattleState): void {
    const config = this.configs[BattlePhase.Assault];

    if (this.phaseTime < config.minDuration) return;

    const breached = state.anyWallBreached || state.gateBreached;
    const timedOut = this.phaseTime >= config.maxDuration;

    if (breached) {
      this.startBreathingTime(15, BattlePhase.StreetFight);
    } else if (timedOut) {
      // Prolonged assault without breach -- attacker is failing
      // Force transition to StreetFight if any attackers managed inside,
      // otherwise the morale system should be driving toward Defeat
      if (state.attackersInsideCity > 0) {
        this.startBreathingTime(15, BattlePhase.StreetFight);
      }
      // If no one got inside and timer expired, stay in Assault --
      // morale decay will eventually trigger Defeat
    }
  }

  /**
   * StreetFight -> Victory / Defeat:
   * - Defender morale = 0: Victory
   * - Attacker morale = 0: Defeat
   * - Timer exceeds maxDuration: evaluate by soldier count
   *
   * These morale checks are handled in the main update() method above.
   * Here we only handle the timeout fallback.
   */
  private updateStreetFight(state: BattleState): void {
    const config = this.configs[BattlePhase.StreetFight];

    if (this.phaseTime >= config.maxDuration) {
      // Tiebreaker: which side has more soldiers remaining?
      if (state.attackersInsideCity > state.defenderSoldierCount * 0.3) {
        this.transitionTo(BattlePhase.Victory);
      } else {
        this.transitionTo(BattlePhase.Defeat);
      }
    }
  }

  /**
   * BreathingTime countdown.
   * When the breathing window ends, transition to the queued next phase.
   */
  private updateBreathingTime(): void {
    if (this.phaseTime >= this.breathingDuration) {
      const next = this.nextPhaseAfterBreathing ?? BattlePhase.Assault;
      this.nextPhaseAfterBreathing = null;
      this.events.emit('phase:breathing_end', { nextPhase: next });
      this.transitionTo(next);
    }
  }

  // ── Breathing Time ──────────────────────────────────────────────────────

  /**
   * Enter a breathing time window before transitioning to the next major phase.
   * During this period the defender can repair walls and redeploy.
   *
   * @param duration  - Duration of the breathing window in seconds.
   * @param nextPhase - The phase to enter after breathing time ends.
   */
  startBreathingTime(duration: number, nextPhase: BattlePhase): void {
    this.breathingDuration = duration;
    this.nextPhaseAfterBreathing = nextPhase;

    const fromPhase = this.currentPhase;
    this.currentPhase = BattlePhase.BreathingTime;
    this.phaseTime = 0;
    this.round++;

    this.events.emit('phase:changed', {
      from: fromPhase,
      to: BattlePhase.BreathingTime,
      round: this.round,
    });
    this.events.emit('phase:breathing_start', {
      duration,
      nextPhase,
    });
  }

  // ── Phase Transition ────────────────────────────────────────────────────

  /**
   * Transition directly to a new phase (no breathing time).
   * Used for terminal states (Victory/Defeat) and post-breathing transitions.
   */
  private transitionTo(phase: BattlePhase): void {
    const from = this.currentPhase;
    if (from === phase) return; // No-op if already in this phase

    this.currentPhase = phase;
    this.phaseTime = 0;

    // Terminal states
    if (phase === BattlePhase.Victory || phase === BattlePhase.Defeat) {
      this.gameOver = true;
    }

    this.events.emit('phase:changed', {
      from,
      to: phase,
      round: this.round,
    });

    if (phase === BattlePhase.Victory) {
      this.events.emit('phase:victory', { round: this.round });
    } else if (phase === BattlePhase.Defeat) {
      this.events.emit('phase:defeat', { round: this.round });
    }
  }

  /**
   * Force-advance to the next logical phase. Used for debugging or scripted events.
   */
  advancePhase(): void {
    switch (this.currentPhase) {
      case BattlePhase.Probing:
        this.startBreathingTime(20, BattlePhase.Advance);
        break;
      case BattlePhase.Advance:
        this.startBreathingTime(25, BattlePhase.Assault);
        break;
      case BattlePhase.Assault:
        this.startBreathingTime(15, BattlePhase.StreetFight);
        break;
      case BattlePhase.StreetFight:
        this.transitionTo(BattlePhase.Victory);
        break;
      case BattlePhase.BreathingTime:
        // End breathing early
        this.updateBreathingTime();
        break;
      default:
        break;
    }
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /**
   * Check conditions and return whether a phase transition is warranted.
   * Useful for UI prediction ("transition imminent" indicator).
   */
  checkTransition(battleState: BattleState): boolean {
    if (this.gameOver) return false;

    // Morale checks
    if (battleState.defenderMorale <= 0 || battleState.attackerMorale <= 0) {
      return true;
    }

    const config = this.configs[this.currentPhase];
    if (!config || this.phaseTime < config.minDuration) return false;

    switch (this.currentPhase) {
      case BattlePhase.Probing:
        return (
          battleState.attackerAdvanceRatio > 0.5 ||
          this.phaseTime >= config.maxDuration
        );
      case BattlePhase.Advance:
        return (
          battleState.moatBridged ||
          battleState.lowestWallHpRatio < 0.7 ||
          this.phaseTime >= config.maxDuration
        );
      case BattlePhase.Assault:
        return (
          battleState.anyWallBreached ||
          battleState.gateBreached ||
          (this.phaseTime >= config.maxDuration && battleState.attackersInsideCity > 0)
        );
      case BattlePhase.StreetFight:
        return this.phaseTime >= config.maxDuration;
      case BattlePhase.BreathingTime:
        return this.phaseTime >= this.breathingDuration;
      default:
        return false;
    }
  }

  /**
   * Whether the current phase has exceeded its maximum duration.
   */
  isPhaseComplete(): boolean {
    const config = this.configs[this.currentPhase];
    if (!config) return false;
    return this.phaseTime >= config.maxDuration;
  }

  /**
   * Get Chinese name and description for the current phase.
   */
  getPhaseDescription(): { nameCN: string; description: string } {
    const config = this.configs[this.currentPhase];
    if (!config) {
      return { nameCN: '未知', description: '' };
    }
    return { nameCN: config.nameCN, description: config.description };
  }

  /**
   * Get the current battle phase.
   */
  getCurrentPhase(): BattlePhase {
    return this.currentPhase;
  }

  /**
   * Get time spent in the current phase (seconds).
   */
  getPhaseTime(): number {
    return this.phaseTime;
  }

  /**
   * Get the current round number.
   */
  getRound(): number {
    return this.round;
  }

  /**
   * Get the maximum rounds configured.
   */
  getMaxRounds(): number {
    return this.maxRounds;
  }

  /**
   * Whether the game has ended.
   */
  isGameOver(): boolean {
    return this.gameOver;
  }

  /**
   * Get the config for the current phase (for UI progress bars, etc.).
   */
  getCurrentPhaseConfig(): Readonly<PhaseConfig> | null {
    return this.configs[this.currentPhase] ?? null;
  }

  /**
   * Get the remaining time in the current phase before max duration.
   * Returns Infinity for terminal states.
   */
  getRemainingTime(): number {
    const config = this.configs[this.currentPhase];
    if (!config || config.maxDuration === Infinity) return Infinity;
    if (this.currentPhase === BattlePhase.BreathingTime) {
      return Math.max(0, this.breathingDuration - this.phaseTime);
    }
    return Math.max(0, config.maxDuration - this.phaseTime);
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  /**
   * Reset the phase manager to initial state (level restart).
   */
  reset(): void {
    this.currentPhase = BattlePhase.Probing;
    this.phaseTime = 0;
    this.round = 1;
    this.gameOver = false;
    this.nextPhaseAfterBreathing = null;
    this.breathingDuration = 0;
    this.configs = { ...PHASE_CONFIGS };
  }
}
