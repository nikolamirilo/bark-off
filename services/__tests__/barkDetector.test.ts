/**
 * Detector tests, driven by synthetic dB traces.
 *
 * Uses node:test so it runs with zero extra dependencies:
 *   node --experimental-strip-types --test services/__tests__/barkDetector.test.ts
 *
 * Every trace is expressed in FRAME_MS steps. `noise()` gives a stationary room,
 * `burst()` overlays a bark-shaped envelope (fast attack, decay).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BarkDetector,
  ConfirmedBark,
  DetectorConfig,
  FRAME_MS,
  deltaToSensitivityPercent,
  normaliseExpoAvMetering,
  sensitivityPercentToDelta,
} from "../barkDetector";

// Deterministic PRNG so a failure is always reproducible.
const makeRng = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const frames = (ms: number) => Math.round(ms / FRAME_MS);

/** Stationary room noise: `level` dBFS with +/- `jitter` dB of variation. */
const noise = (ms: number, level: number, jitter: number, rng: () => number) =>
  Array.from({ length: frames(ms) }, () => level + (rng() * 2 - 1) * jitter);

/**
 * Bark-shaped envelope: instant attack to `peak`, then linear decay back to the
 * floor over the burst duration.
 */
const burst = (ms: number, peak: number, floor: number) => {
  const n = frames(ms);
  return Array.from({ length: n }, (_, i) => {
    const decay = n <= 1 ? 0 : i / (n - 1);
    return peak - (peak - floor) * decay * 0.6;
  });
};

const run = (
  trace: number[],
  config: Partial<DetectorConfig> = {},
  deltaMs = FRAME_MS,
) => {
  const detector = new BarkDetector(config);
  const barks: ConfirmedBark[] = [];
  let lastFloor = 0;
  for (const db of trace) {
    const frame = detector.push(db, deltaMs);
    if (frame.bark) barks.push(frame.bark);
    lastFloor = frame.noiseFloorDb;
  }
  return { barks, lastFloor };
};

/** Resample a 50 ms-step trace to a coarser interval, as expo-av might deliver. */
const decimate = (trace: number[], factor: number) =>
  trace.filter((_, i) => i % factor === 0);

/** Every trace gets a settle period so the floor is primed from real samples. */
const settle = (level: number, rng: () => number) => noise(3000, level, 1, rng);

describe("noise floor priming", () => {
  it("primes the floor to the quiet baseline of a quiet room", () => {
    const rng = makeRng(1);
    const { lastFloor } = run(settle(-50, rng));
    assert.ok(
      Math.abs(lastFloor - -50) < 3,
      `floor should settle near -50, got ${lastFloor.toFixed(1)}`,
    );
  });

  it("primes the floor to the quiet baseline of a loud room", () => {
    const rng = makeRng(2);
    const { lastFloor } = run(settle(-25, rng));
    assert.ok(
      Math.abs(lastFloor - -25) < 3,
      `floor should settle near -25, got ${lastFloor.toFixed(1)}`,
    );
  });
});

describe("false positives", () => {
  it("does not fire on a quiet room", () => {
    const rng = makeRng(3);
    const trace = [...settle(-50, rng), ...noise(30_000, -50, 1.5, rng)];
    assert.equal(run(trace).barks.length, 0);
  });

  it("does not fire on a loud room (TV, AC) with no barks", () => {
    // This is the case the old absolute-threshold detector could never handle:
    // ambient level sits above the old default -30 dB trigger.
    const rng = makeRng(4);
    const trace = [...settle(-25, rng), ...noise(30_000, -25, 4, rng)];
    assert.equal(run(trace).barks.length, 0);
  });

  it("does not fire on short TV dialogue peaks (fails the duration gate)", () => {
    const rng = makeRng(5);
    const trace = [...settle(-25, rng)];
    for (let i = 0; i < 20; i++) {
      trace.push(...noise(800, -25, 3, rng));
      trace.push(...noise(100, -16, 1, rng)); // 2-frame consonant peak
    }
    assert.equal(run(trace).barks.length, 0);
  });

  it("does not fire on a single-frame impulse (tap, click)", () => {
    const rng = makeRng(6);
    const trace = [...settle(-50, rng)];
    for (let i = 0; i < 10; i++) {
      trace.push(...noise(1000, -50, 1, rng));
      trace.push(-15); // one 50 ms frame
    }
    assert.equal(run(trace).barks.length, 0);
  });

  it("fires at most once on a sustained vacuum cleaner, then re-adapts", () => {
    const rng = makeRng(7);
    const trace = [
      ...settle(-50, rng),
      ...noise(20_000, -20, 2, rng), // vacuum switched on, runs 20 s
    ];
    const { barks, lastFloor } = run(trace);
    // The onset genuinely is an impulsive event, so one detection is acceptable.
    assert.ok(barks.length <= 1, `expected <=1 bark, got ${barks.length}`);
    assert.ok(
      lastFloor > -30,
      `floor should have re-adapted upward toward -20, got ${lastFloor.toFixed(1)}`,
    );
  });
});

describe("true positives", () => {
  it("detects a single bark in a quiet room", () => {
    const rng = makeRng(8);
    const trace = [
      ...settle(-50, rng),
      ...burst(250, -20, -50),
      ...noise(2000, -50, 1, rng),
    ];
    const { barks } = run(trace);
    assert.equal(barks.length, 1);
    assert.equal(barks[0].level, 2, "SNR 30 dB should be a loud bark");
  });

  it("detects the same relative bark in a loud room — self-calibrating", () => {
    // Identical 25 dB jump, 25 dB louder room. An absolute threshold tuned for
    // one of these rooms cannot work in the other; SNR handles both.
    const rng = makeRng(9);
    const quiet = run([
      ...settle(-55, rng),
      ...burst(250, -30, -55),
      ...noise(2000, -55, 1, rng),
    ]);
    const loud = run([
      ...settle(-30, rng),
      ...burst(250, -5, -30),
      ...noise(2000, -30, 1, rng),
    ]);
    assert.equal(quiet.barks.length, 1);
    assert.equal(loud.barks.length, 1);
    assert.equal(quiet.barks[0].level, loud.barks[0].level);
  });

  it("counts each bark in a barking fit rather than collapsing them", () => {
    // Also guards the floor-freeze: a symmetric moving average would let the
    // floor climb during the fit and stop detecting partway through.
    const rng = makeRng(10);
    const trace = [...settle(-50, rng)];
    for (let i = 0; i < 10; i++) {
      trace.push(...burst(250, -20, -50));
      trace.push(...noise(750, -50, 1, rng));
    }
    const { barks } = run(trace);
    assert.equal(barks.length, 10);
  });

  it("does not double-count one long bark", () => {
    const rng = makeRng(11);
    const trace = [
      ...settle(-50, rng),
      ...noise(600, -18, 1, rng), // one 600 ms sustained bark
      ...noise(2000, -50, 1, rng),
    ];
    assert.equal(run(trace).barks.length, 1);
  });

  it("ignores barks during warm-up", () => {
    const rng = makeRng(12);
    const trace = [
      ...noise(500, -50, 1, rng),
      ...burst(250, -20, -50),
      ...noise(500, -50, 1, rng),
    ];
    assert.equal(run(trace).barks.length, 0);
  });
});

describe("level classification", () => {
  const rng = makeRng(13);
  const settled = settle(-50, rng);

  it("classifies a moderate bark as soft", () => {
    // SNR 18 dB: above the 14 dB trigger, below the 24 dB loud boundary.
    const { barks } = run([...settled, ...burst(250, -32, -50)]);
    assert.equal(barks.length, 1);
    assert.equal(barks[0].level, 1);
  });

  it("classifies a strong bark as loud", () => {
    const { barks } = run([...settled, ...burst(250, -20, -50)]);
    assert.equal(barks.length, 1);
    assert.equal(barks[0].level, 2);
  });

  it("uses the burst peak, not the frame at confirmation time", () => {
    // Peak lands in the first frame and has decayed by the confirmation frame;
    // the reported level must still reflect the peak.
    const { barks } = run([...settled, ...burst(400, -18, -50)]);
    assert.equal(barks.length, 1);
    assert.ok(
      barks[0].peakDb <= -18 + 0.1 && barks[0].peakDb >= -19,
      `peakDb should be the burst peak, got ${barks[0].peakDb}`,
    );
  });
});

describe("sensitivity", () => {
  const quietWhimper = (rng: () => number) => [
    ...settle(-50, rng),
    ...burst(250, -40, -50), // SNR 10 dB
    ...noise(2000, -50, 1, rng),
  ];

  it("catches a quiet whimper at high sensitivity", () => {
    const { barks } = run(quietWhimper(makeRng(14)), { levelDeltasDb: [6, 24] });
    assert.equal(barks.length, 1);
  });

  it("ignores the same whimper at low sensitivity", () => {
    const { barks } = run(quietWhimper(makeRng(14)), { levelDeltasDb: [24, 34] });
    assert.equal(barks.length, 0);
  });

  it("is monotonic — lowering the trigger never reduces the bark count", () => {
    const rng = makeRng(15);
    const trace = [...settle(-50, rng)];
    for (let i = 0; i < 15; i++) {
      trace.push(...burst(250, -50 + 6 + i * 1.5, -50));
      trace.push(...noise(900, -50, 1, rng));
    }
    let previous = 0;
    for (const trigger of [24, 20, 16, 12, 8, 6]) {
      const count = run(trace, { levelDeltasDb: [trigger, trigger + 10] }).barks
        .length;
      assert.ok(
        count >= previous,
        `count should not drop as sensitivity rises (+${trigger} dB gave ${count}, previous ${previous})`,
      );
      previous = count;
    }
  });
});

describe("frame-rate independence", () => {
  // expo-av does not guarantee the requested progress interval. Duration gates
  // must be driven by real elapsed time, not by a frame count.
  const rng = makeRng(20);
  const trace = [...settle(-50, rng)];
  for (let i = 0; i < 8; i++) {
    trace.push(...burst(300, -20, -50));
    trace.push(...noise(900, -50, 1, rng));
  }

  it("counts the same barks at 100 ms frames as at 50 ms", () => {
    const at50 = run(trace, {}, 50).barks.length;
    const at100 = run(decimate(trace, 2), {}, 100).barks.length;
    assert.equal(at50, 8);
    assert.equal(at100, at50);
  });

  it("still rejects a short impulse at a coarser frame rate", () => {
    const impulses = [...settle(-50, rng)];
    for (let i = 0; i < 10; i++) {
      impulses.push(...noise(1000, -50, 1, rng));
      impulses.push(...noise(100, -15, 0, rng)); // 100 ms, under minBurst
    }
    assert.equal(run(impulses, {}, 50).barks.length, 0);
    assert.equal(run(decimate(impulses, 2), {}, 100).barks.length, 0);
  });
});

describe("regressions", () => {
  it("stays quiet in a very loud room — the floor must not be pinned by a clamp", () => {
    // With the floor ceiling at -15 dBFS, an ambient of -10 inflated every SNR
    // reading by 5 dB and 9 dB speech peaks became 17 false barks.
    const rng = makeRng(30);
    const trace = [...settle(-10, rng)];
    for (let i = 0; i < 20; i++) {
      trace.push(...noise(800, -10, 2, rng));
      trace.push(...noise(250, -1, 1, rng)); // +9 dB peak, under the 14 dB trigger
    }
    const { barks, lastFloor } = run(trace);
    assert.ok(
      lastFloor > -14,
      `floor must track a -10 dB room, got ${lastFloor.toFixed(1)}`,
    );
    assert.equal(barks.length, 0);
  });

  it("does not let a barking fit drag the floor up", () => {
    // Barks suppressed by the refractory gate leave `candidate` null, so the floor
    // used to learn from them — the detector taught itself to ignore barks.
    const rng = makeRng(31);
    const trace = [...settle(-50, rng)];
    const floorBefore = run(trace).lastFloor;
    for (let i = 0; i < 30; i++) {
      trace.push(...burst(300, -20, -50));
      trace.push(...noise(50, -50, 1, rng)); // gap shorter than the refractory
    }
    const { lastFloor } = run(trace);
    assert.ok(
      lastFloor - floorBefore < 2,
      `floor drifted ${(lastFloor - floorBefore).toFixed(1)} dB during a fit`,
    );
  });

  it("tracks a room that gets louder mid-session", () => {
    // The floor must still be able to rise to a new sustained ambient level,
    // otherwise it strands 20+ dB low and the detector becomes hypersensitive.
    const rng = makeRng(32);
    const trace = [
      ...settle(-50, rng),
      ...noise(30_000, -22, 2, rng), // window opened onto a busy street
    ];
    const { lastFloor } = run(trace);
    assert.ok(
      Math.abs(lastFloor - -22) < 4,
      `floor should follow the new ambient of -22, got ${lastFloor.toFixed(1)}`,
    );
  });

  it("applies a real 250 ms attack window regardless of frame interval", () => {
    // attackFrames was a count derived from FRAME_MS, so at 100 ms framing the
    // "250 ms" look-back was really 500 ms and slow ramps started qualifying.
    const ramp = (dbPerSecond: number, stepMs: number) => {
      const out: number[] = [];
      for (let t = 0; t < 6000; t += stepMs) out.push(-50 + (t / 1000) * dbPerSecond);
      return out;
    };
    for (const dbPerSecond of [18, 40]) {
      const at50 = run(ramp(dbPerSecond, 50), {}, 50).barks.length;
      const at100 = run(ramp(dbPerSecond, 100), {}, 100).barks.length;
      assert.equal(
        at50,
        at100,
        `${dbPerSecond} dB/s ramp: ${at50} barks at 50 ms vs ${at100} at 100 ms`,
      );
    }
  });

  it("does not lock up when hysteresis would exceed the trigger delta", () => {
    // releaseDb <= noiseFloor makes `db < releaseDb` unreachable, so every
    // candidate stayed open (floor frozen) until maxBurstMs.
    const rng = makeRng(33);
    const trace = [
      ...settle(-50, rng),
      ...burst(200, -25, -50),
      ...noise(3000, -50, 1, rng),
    ];
    const { barks } = run(trace, { levelDeltasDb: [4, 24] });
    assert.equal(barks.length, 1, "should confirm and release exactly one bark");
  });
});

describe("metering normalisation", () => {
  it("corrects expo-av's Android natural-log bug", () => {
    // expo-av reports -30 on Android where the true level is -13.0 dBFS.
    assert.ok(Math.abs(normaliseExpoAvMetering(-30, true) - -13.03) < 0.05);
    assert.equal(normaliseExpoAvMetering(-30, false), -30);
  });

  it("passes silence through unchanged", () => {
    assert.equal(normaliseExpoAvMetering(-160, true), -160);
    assert.equal(normaliseExpoAvMetering(-200, true), -160);
  });
});

describe("sensitivity mapping", () => {
  // dB is the stored value and percent is display-only, so the direction that
  // has to be exact is dB -> percent -> dB. (percent -> dB -> percent cannot be,
  // because 101 percent values map onto 19 integer dB steps.)
  it("round-trips dB -> percent -> dB exactly", () => {
    for (let delta = 6; delta <= 24; delta++) {
      const percent = deltaToSensitivityPercent(delta);
      assert.equal(
        sensitivityPercentToDelta(percent),
        delta,
        `delta ${delta} -> ${percent}% -> ${sensitivityPercentToDelta(percent)}`,
      );
    }
  });

  it("is idempotent for percent after one pass (slider thumb does not drift)", () => {
    for (let percent = 0; percent <= 100; percent++) {
      const settled = deltaToSensitivityPercent(
        sensitivityPercentToDelta(percent),
      );
      assert.equal(
        deltaToSensitivityPercent(sensitivityPercentToDelta(settled)),
        settled,
      );
    }
  });

  it("maps 100 % to the most sensitive setting", () => {
    assert.ok(sensitivityPercentToDelta(100) < sensitivityPercentToDelta(0));
  });

  it("clamps out-of-range input", () => {
    assert.equal(sensitivityPercentToDelta(-50), sensitivityPercentToDelta(0));
    assert.equal(sensitivityPercentToDelta(500), sensitivityPercentToDelta(100));
  });
});
