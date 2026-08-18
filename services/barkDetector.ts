/**
 * Adaptive bark detector.
 *
 * Replaces the previous "single frame above an absolute dBFS threshold" gate.
 * See docs/SENSITIVITY_REVIEW.md for the full rationale; the short version:
 *
 *  - Absolute dBFS thresholds cannot work, because the mic's AGC normalises the
 *    signal upward in quiet rooms. The reported level tracks the AGC's target,
 *    not the room. So we detect on SNR — how far the level jumps above the
 *    room's *own* adaptively-tracked noise floor. AGC drift then largely cancels
 *    out, because it moves the floor and the signal together.
 *
 *  - A bark is a short burst with a sharp attack (>8 dB rise inside ~250 ms),
 *    lasting roughly 100-400 ms. Requiring that shape rejects the two big
 *    false-positive families that no threshold value can filter:
 *      * brief impulses (taps, clicks, door latches) — fail the duration gate
 *      * sustained noise (TV, vacuum, AC, traffic)   — fail the attack gate
 *
 *    Note the asymmetry: sustained noise that is *already running* has no attack
 *    and is rejected, but the moment it switches on does look like a bark and
 *    will produce one detection. `maxBurstMs` then pulls the noise floor up to
 *    the new ambient level so it doesn't keep firing. It is a re-adaptation
 *    trigger, not a shape filter — confirmation happens at `minBurstMs`, long
 *    before `maxBurstMs` is reached.
 *
 * This module is intentionally pure and synchronous: no expo, no store, no
 * timers. Feed it dB samples, get decisions back. That makes it testable against
 * synthetic traces — see services/__tests__/barkDetector.test.ts.
 */

/** How often we sample the meter. 100 ms is too coarse to resolve a bark's attack. */
export const FRAME_MS = 50;

export interface DetectorConfig {
  /**
   * Ascending SNR boundaries in dB above the noise floor, one per bark level.
   *
   * `levelDeltasDb[0]` doubles as the trigger threshold and is the user-facing
   * sensitivity — the *only* knob most users should ever touch:
   *   6 dB  = very sensitive (catches whimpers, but also footsteps)
   *  14 dB  = default
   *  24 dB  = only unmistakably loud barks
   *
   * Each subsequent entry promotes the bark to the next level, so `[14, 24]`
   * means "soft bark at +14 dB, loud bark at +24 dB". Relative dB rather than
   * absolute dBFS is the whole point: it transfers between rooms.
   */
  levelDeltasDb: number[];
  /** Minimum rise over the attack window for a candidate to open. */
  attackDeltaDb: number;
  /** Look-back window for the attack test. */
  attackWindowMs: number;
  /** A candidate must stay above the release threshold this long to be confirmed. */
  minBurstMs: number;
  /**
   * Beyond this a still-open burst is treated as sustained noise: the candidate is
   * abandoned and the noise floor is pulled up to the new ambient level. Because
   * confirmation happens at `minBurstMs`, a bark has already been emitted by this
   * point — so this suppresses *repeat* firing on sustained noise, it does not
   * prevent the first one.
   */
  maxBurstMs: number;
  /** Trigger threshold minus this = release threshold. Prevents boundary chatter. */
  hysteresisDb: number;
  /** Minimum gap between two counted barks, so one bark isn't counted twice. */
  refractoryMs: number;
  /** Ignore everything until the floor has been primed from real samples. */
  warmupMs: number;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  levelDeltasDb: [14, 24],
  attackDeltaDb: 8,
  attackWindowMs: 250,
  minBurstMs: 150,
  maxBurstMs: 2000,
  hysteresisDb: 5,
  refractoryMs: 350,
  warmupMs: 1500,
};

/** Sensitivity slider bounds, in dB of SNR. Lower delta = more sensitive. */
export const SENSITIVITY_MIN_DB = 6;
export const SENSITIVITY_MAX_DB = 24;

/**
 * Noise-floor smoothing coefficients, per frame.
 *
 * Asymmetric on purpose: the floor drops quickly toward a new quiet baseline but
 * rises slowly, so the barks we are trying to detect don't drag the floor up
 * behind them. (A symmetric average desensitises itself during a barking fit —
 * the classic failure mode of naive adaptive thresholds.)
 */
const FLOOR_ALPHA_DOWN = 0.3;
const FLOOR_ALPHA_UP = 0.02;

/**
 * Percentile of the warm-up samples used to prime the floor. Using a low
 * percentile rather than the mean keeps the initial estimate on the quiet
 * baseline even if the user starts a session mid-noise.
 */
const PRIME_PERCENTILE = 0.25;

/**
 * Sentinel for "no signal". expo-av and expo-audio both report -160 for silence.
 * Treated as absence of data rather than as a very quiet measurement, so it
 * never poisons the floor estimate or the attack history.
 */
const SILENCE_DB = -160;
const FLOOR_INIT_DB = -60;
/**
 * Sanity clamps only. The ceiling must stay close to 0 dBFS: capping it lower
 * would pin the floor in a genuinely loud room and inflate every SNR reading by
 * the amount the room exceeded the cap — reintroducing the absolute-threshold
 * failure this module exists to fix. AGC pushes reported levels upward, so a
 * tight ceiling is reachable in practice.
 */
const FLOOR_MIN_DB = -70;
const FLOOR_MAX_DB = -3;

/**
 * Why a loud-enough sound did *not* become a bark.
 *
 * These are the diagnostic payload: a rejection tells you far more about how to
 * tune the detector than a detection does. If a real bark is being missed, the
 * reason names the gate to loosen; if a false positive gets through, the absence
 * of a reason says the gates aren't the problem.
 */
export type RejectionReason =
  /** Below the trigger threshold. Ordinary — most frames in a quiet room. */
  | 'below_trigger'
  /** Loud enough, but rose too slowly: sustained noise, not an onset. */
  | 'no_attack'
  /** Sharp and loud, but too brief: an impulse (tap, click, latch). */
  | 'too_short'
  /** Stayed up past maxBurstMs: sustained noise. Floor re-adapts. */
  | 'sustained'
  /** Within the refractory window of the previous bark. */
  | 'refractory'
  /** Still priming the noise floor from real samples. */
  | 'warmup';

export interface DetectorFrame {
  /** Calibrated dBFS for this frame. */
  db: number;
  /** Current adaptive noise-floor estimate. */
  noiseFloorDb: number;
  /** db - noiseFloorDb. The quantity thresholds actually apply to. */
  snrDb: number;
  /** True while a candidate burst is open (not yet confirmed or rejected). */
  inCandidate: boolean;
  /** Non-null only on the frame a bark is confirmed. */
  bark: ConfirmedBark | null;
  /** Level to display: the current bark's level, or null between barks. */
  level: number | null;
  /**
   * How close this frame is to triggering, 0-100. Drives the live meter — far
   * more useful than an absolute dB percentage, which told the user nothing
   * about whether a bark was imminent.
   */
  triggerProgress: number;
  /** Why this frame didn't produce a bark. Null on a confirming frame. */
  rejection: RejectionReason | null;
  /**
   * Set when this frame was loud enough to trigger but was rejected for some
   * other reason — i.e. a near miss worth showing to a human. Frames that are
   * simply below the trigger are not near misses; there are thousands of those.
   */
  nearMiss: NearMiss | null;
  /** dB rise over the attack window. Diagnostic for tuning attackDeltaDb. */
  attackDb: number;
}

export interface NearMiss {
  reason: Exclude<RejectionReason, 'below_trigger' | 'warmup'>;
  snrDb: number;
  attackDb: number;
  /** Time the burst held above release before rejection, ms. 0 if it never opened. */
  durationMs: number;
}

export interface ConfirmedBark {
  /**
   * 1-based level index, matching `Settings.thresholds`. Derived from the
   * burst's *peak* SNR rather than whichever frame happened to confirm it.
   */
  level: number;
  /** Peak SNR reached during the burst, dB. */
  peakSnrDb: number;
  /** Peak absolute level during the burst, dBFS. Reported for stats. */
  peakDb: number;
  /** Noise floor at burst onset, dBFS. Useful for diagnosing environments. */
  floorAtOnsetDb: number;
  /**
   * Time above the release threshold at the moment of confirmation, ms.
   *
   * This is *not* the full length of the bark: confirmation deliberately fires as
   * soon as `minBurstMs` is satisfied, so the calming clip starts while the dog is
   * still barking. For a normally-confirmed bark this is therefore ≈ `minBurstMs`,
   * and it is only larger when a single frame arrived late.
   */
  durationMs: number;
}

type CandidateState = {
  /** Accumulated time above the release threshold, ms. */
  durationMs: number;
  peakDb: number;
  peakSnrDb: number;
  floorAtOnsetDb: number;
  /** Set once minBurstMs is satisfied, so we only emit one bark per burst. */
  confirmed: boolean;
};

export class BarkDetector {
  private config: DetectorConfig;
  private noiseFloorDb = FLOOR_INIT_DB;
  /**
   * Recent samples with their timestamps. Timestamped rather than counted so the
   * attack window is a real 250 ms regardless of how often frames actually
   * arrive — a frame count would silently become a 500 ms window at 100 ms
   * framing, changing which ramps qualify as an onset.
   */
  private history: { db: number; tMs: number }[] = [];
  private candidate: CandidateState | null = null;
  private elapsedMs = 0;
  private msSinceLastBark = Number.POSITIVE_INFINITY;
  private lastLevel: number | null = null;
  private primeSamples: number[] = [];
  private primed = false;
  /** Burst length of the most recent rejected candidate, for the near-miss report. */
  private lastRejectedDurationMs = 0;

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = normaliseConfig({ ...DEFAULT_DETECTOR_CONFIG, ...config });
  }

  updateConfig(config: Partial<DetectorConfig>): void {
    this.config = normaliseConfig({ ...this.config, ...config });
  }

  /** The trigger threshold: the lowest level boundary. */
  get triggerDeltaDb(): number {
    return this.config.levelDeltasDb[0];
  }

  reset(): void {
    this.noiseFloorDb = FLOOR_INIT_DB;
    this.history = [];
    this.candidate = null;
    this.elapsedMs = 0;
    this.msSinceLastBark = Number.POSITIVE_INFINITY;
    this.lastLevel = null;
    this.primeSamples = [];
    this.primed = false;
    this.lastRejectedDurationMs = 0;
  }

  /** Exposed so the settings screen can show a live "your room is this loud" readout. */
  get currentNoiseFloorDb(): number {
    return this.noiseFloorDb;
  }

  get isWarmingUp(): boolean {
    return this.elapsedMs < this.config.warmupMs;
  }

  /**
   * Feed one metering sample. Returns the frame's full state so the UI can
   * render without recomputing.
   *
   * `deltaMs` is the real time since the previous sample. It defaults to
   * FRAME_MS, but the caller should pass the measured value: expo-av does not
   * guarantee the requested interval, and assuming 50 ms when frames actually
   * arrive every 100 ms would silently double every duration gate — minBurst,
   * refractory and warm-up alike.
   */
  push(rawDb: number, deltaMs: number = FRAME_MS): DetectorFrame {
    this.elapsedMs += deltaMs;
    this.msSinceLastBark += deltaMs;

    // -160 means the platform gave us nothing this frame.
    const hasSignal = rawDb > SILENCE_DB;
    const db = hasSignal ? rawDb : this.noiseFloorDb;

    // --- warm-up: prime the floor from real samples ---------------------------
    // Starting from a fixed -60 and easing upward at FLOOR_ALPHA_UP would leave
    // the floor ~15 dB too low for the first several seconds in a loud room,
    // i.e. wildly over-sensitive exactly when the user has just hit Start.
    if (!this.primed) {
      if (hasSignal) this.primeSamples.push(rawDb);
      if (this.elapsedMs >= this.config.warmupMs) {
        if (this.primeSamples.length > 0) {
          this.noiseFloorDb = this.clampFloor(
            percentile(this.primeSamples, PRIME_PERCENTILE),
          );
        }
        this.primeSamples = [];
        this.primed = true;
      }
    }

    const triggerDeltaDb = this.triggerDeltaDb;
    const triggerDb = this.noiseFloorDb + triggerDeltaDb;
    const releaseDb = triggerDb - this.config.hysteresisDb;
    const snrDb = db - this.noiseFloorDb;

    // Attack is computed once per frame now: both the gate and the diagnostics
    // need it, and recomputing it in hasAttack() would scan the window twice.
    const attackDb = this.attackDb(db);

    let bark: ConfirmedBark | null = null;
    let rejection: RejectionReason | null = null;

    if (this.candidate) {
      const outcome = this.advanceCandidate(db, snrDb, releaseDb, deltaMs);
      bark = outcome.bark;
      rejection = outcome.rejection;
    } else {
      rejection = this.whyNotOpening(db, triggerDb, attackDb);
      if (rejection === null) {
        this.candidate = {
          durationMs: deltaMs,
          peakDb: db,
          peakSnrDb: snrDb,
          floorAtOnsetDb: this.noiseFloorDb,
          confirmed: false,
        };
      }
    }

    if (!this.candidate && hasSignal && this.primed) {
      // What the floor is allowed to learn from:
      //   * quiet frames                       — always
      //   * loud but steady frames             — yes: that's ambient noise the
      //                                          floor has to follow, otherwise a
      //                                          room that gets louder mid-session
      //                                          leaves the floor stranded and the
      //                                          detector hypersensitive
      //   * loud frames during the refractory  — never: those are the tail of a
      //     window, or with an onset             bark, and learning from them
      //                                          would teach the detector to
      //                                          ignore barks
      const isLoud = db >= releaseDb;
      const inRefractory = this.msSinceLastBark < this.config.refractoryMs;
      const hasAttack = attackDb >= this.config.attackDeltaDb;
      const canLearn = !isLoud || (!inRefractory && !hasAttack);
      if (canLearn) this.updateNoiseFloor(db);
    }

    // Appended *after* the attack test, so hasAttack() compares the current frame
    // against preceding frames only.
    this.history.push({ db, tMs: this.elapsedMs });
    this.pruneHistory();

    if (bark) {
      this.msSinceLastBark = 0;
      this.lastLevel = bark.level;
    } else if (!this.candidate) {
      this.lastLevel = null;
    }

    return {
      db,
      noiseFloorDb: this.noiseFloorDb,
      snrDb,
      inCandidate: this.candidate !== null,
      bark,
      level: bark ? bark.level : this.lastLevel,
      triggerProgress: this.primed
        ? Math.max(0, Math.min(100, Math.round((snrDb / triggerDeltaDb) * 100)))
        : 0,
      rejection,
      nearMiss: isNearMiss(rejection)
        ? {
            reason: rejection,
            snrDb: round1(snrDb),
            attackDb: round1(attackDb),
            durationMs: this.lastRejectedDurationMs,
          }
        : null,
      attackDb: round1(attackDb),
    };
  }

  /**
   * Which gate stopped a new candidate from opening, or null if none did.
   * Ordered cheapest-first, and the order also determines which reason a frame
   * reports when several apply — warm-up and below-trigger are reported before
   * the more interesting ones because they're not actionable.
   */
  private whyNotOpening(
    db: number,
    triggerDb: number,
    attackDb: number,
  ): RejectionReason | null {
    if (!this.primed) return 'warmup';
    if (db < triggerDb) return 'below_trigger';
    if (this.msSinceLastBark < this.config.refractoryMs) return 'refractory';
    if (attackDb < this.config.attackDeltaDb) return 'no_attack';
    return null;
  }

  /**
   * dB rise from the quietest sample in the attack window to now.
   *
   * Compared against the *quietest* sample rather than the oldest, so a bark
   * landing on top of a brief lull is still caught. Returns 0 with no history in
   * the window — warm-up guarantees there is some by the time detection is live.
   */
  private attackDb(db: number): number {
    const cutoff = this.elapsedMs - this.config.attackWindowMs;
    let quietest = Number.POSITIVE_INFINITY;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].tMs < cutoff) break;
      if (this.history[i].db < quietest) quietest = this.history[i].db;
    }
    return quietest === Number.POSITIVE_INFINITY ? 0 : db - quietest;
  }

  /** Keep a little more than the attack window, so the window is always covered. */
  private pruneHistory(): void {
    const cutoff = this.elapsedMs - this.config.attackWindowMs * 2;
    let drop = 0;
    while (drop < this.history.length && this.history[drop].tMs < cutoff) drop++;
    if (drop > 0) this.history.splice(0, drop);
  }

  private advanceCandidate(
    db: number,
    snrDb: number,
    releaseDb: number,
    deltaMs: number,
  ): { bark: ConfirmedBark | null; rejection: RejectionReason | null } {
    const candidate = this.candidate!;

    // Dropped below the release threshold. The current frame is *not* part of
    // the burst, so duration is what accumulated before it.
    if (db < releaseDb) {
      const durationMs = candidate.durationMs;
      this.candidate = null;
      this.lastRejectedDurationMs = durationMs;
      if (durationMs >= this.config.minBurstMs && !candidate.confirmed) {
        return { bark: this.buildBark(candidate, durationMs), rejection: null };
      }
      // A burst that already confirmed isn't a rejection, it's just the tail.
      return {
        bark: null,
        rejection: candidate.confirmed ? null : 'too_short',
      };
    }

    candidate.durationMs += deltaMs;
    if (db > candidate.peakDb) candidate.peakDb = db;
    if (snrDb > candidate.peakSnrDb) candidate.peakSnrDb = snrDb;

    const durationMs = candidate.durationMs;

    // Still going after maxBurstMs: this is sustained noise, not a bark. Abandon
    // it and pull the floor up toward the new ambient level so we stop
    // re-triggering on it.
    if (durationMs > this.config.maxBurstMs) {
      this.candidate = null;
      this.lastRejectedDurationMs = durationMs;
      this.noiseFloorDb = this.clampFloor(
        this.noiseFloorDb + (db - this.noiseFloorDb) * FLOOR_ALPHA_DOWN,
      );
      return { bark: null, rejection: 'sustained' };
    }

    // Held above the release threshold long enough — confirm now rather than
    // waiting for the tail, so the calming clip starts while the dog is still
    // barking rather than after it has stopped.
    if (durationMs >= this.config.minBurstMs && !candidate.confirmed) {
      candidate.confirmed = true;
      return { bark: this.buildBark(candidate, durationMs), rejection: null };
    }

    return { bark: null, rejection: null };
  }

  private buildBark(candidate: CandidateState, durationMs: number): ConfirmedBark {
    return {
      level: this.levelForSnr(candidate.peakSnrDb),
      peakSnrDb: round1(candidate.peakSnrDb),
      peakDb: round1(candidate.peakDb),
      floorAtOnsetDb: round1(candidate.floorAtOnsetDb),
      durationMs,
    };
  }

  /**
   * Highest level boundary the peak SNR cleared, as a 1-based index. Always at
   * least 1, because a bark only gets here by clearing levelDeltasDb[0].
   */
  private levelForSnr(peakSnrDb: number): number {
    let level = 1;
    for (let i = 1; i < this.config.levelDeltasDb.length; i++) {
      if (peakSnrDb >= this.config.levelDeltasDb[i]) level = i + 1;
    }
    return level;
  }

  private updateNoiseFloor(db: number): void {
    const alpha = db < this.noiseFloorDb ? FLOOR_ALPHA_DOWN : FLOOR_ALPHA_UP;
    this.noiseFloorDb = this.clampFloor(
      this.noiseFloorDb + (db - this.noiseFloorDb) * alpha,
    );
  }

  private clampFloor(value: number): number {
    return Math.min(FLOOR_MAX_DB, Math.max(FLOOR_MIN_DB, value));
  }
}

/**
 * Guard the config against the shapes persisted state can actually arrive in.
 * `levelDeltasDb` comes from user settings via AsyncStorage, so it may be empty,
 * unsorted, or (after a partial migration) hold absolute dBFS values.
 */
const normaliseConfig = (config: DetectorConfig): DetectorConfig => {
  const deltas = (
    Array.isArray(config.levelDeltasDb) && config.levelDeltasDb.length > 0
      ? config.levelDeltasDb
      : DEFAULT_DETECTOR_CONFIG.levelDeltasDb
  )
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);

  const levelDeltasDb =
    deltas.length > 0 ? deltas : DEFAULT_DETECTOR_CONFIG.levelDeltasDb;

  // Hysteresis must stay strictly below the trigger delta. If it doesn't, the
  // release threshold falls to or below the noise floor, `db < releaseDb` is never
  // true, and every candidate stays open — floor frozen — until maxBurstMs.
  const hysteresisDb = Math.max(
    0,
    Math.min(config.hysteresisDb, levelDeltasDb[0] - 1),
  );

  return { ...config, levelDeltasDb, hysteresisDb };
};

/**
 * Whether a rejection is worth surfacing to a human. `below_trigger` and `warmup`
 * describe the overwhelming majority of frames and aren't actionable; the rest
 * mean "this was loud enough to be a bark and something else stopped it", which
 * is exactly what you want to see when tuning.
 */
const isNearMiss = (
  reason: RejectionReason | null,
): reason is NearMiss['reason'] =>
  reason !== null && reason !== 'below_trigger' && reason !== 'warmup';

const round1 = (value: number): number => Math.round(value * 10) / 10;

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[index];
};

/**
 * Normalise a raw metering value to true dBFS.
 *
 * expo-av's Android implementation computes `20 * Math.log(amp / 32767)` —
 * Java's Math.log is the *natural* log, not log10, so every Android value is
 * scaled by ln(10) ≈ 2.3026 (AVManager.java:637). expo-audio's Kotlin
 * implementation uses log10 and is correct, so this is only needed while any
 * code path still reads metering from expo-av.
 */
export const normaliseExpoAvMetering = (
  metering: number,
  isAndroid: boolean,
): number => {
  if (metering <= SILENCE_DB) return SILENCE_DB;
  return isAndroid ? metering / Math.LN10 : metering;
};

/** Map the sensitivity slider (0-100 %, higher = more sensitive) to trigger dB. */
export const sensitivityPercentToDelta = (percent: number): number => {
  const clamped = Math.max(0, Math.min(100, percent));
  return Math.round(
    SENSITIVITY_MAX_DB -
      (clamped / 100) * (SENSITIVITY_MAX_DB - SENSITIVITY_MIN_DB),
  );
};

export const deltaToSensitivityPercent = (deltaDb: number): number => {
  const clamped = Math.max(
    SENSITIVITY_MIN_DB,
    Math.min(SENSITIVITY_MAX_DB, deltaDb),
  );
  return Math.round(
    ((SENSITIVITY_MAX_DB - clamped) / (SENSITIVITY_MAX_DB - SENSITIVITY_MIN_DB)) *
      100,
  );
};

export { SILENCE_DB };
