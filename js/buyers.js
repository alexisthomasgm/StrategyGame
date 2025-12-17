import { state } from "./main.js";

// ---- Tunables (keep these at top; they matter) ----
const TURN_ACCEL_START = 4;   // after this turn, focus divergence ramps harder
const TURN_ACCEL_RATE  = 0.08; // how fast divergence increases per turn after start

// size growth baselines per segment (different "stories")
const SIZE_PROFILE = {
  b1: { baseMin: 2, baseMax: 5, volatility: 1 }, // commuters: steady
  b2: { baseMin: 1, baseMax: 3, volatility: 1 }, // high-speed: slower volume
  b3: { baseMin: 2, baseMax: 6, volatility: 3 }, // low-cost: more volatile
};

const SIZE_GROWTH_RATE = {
  b1: { min: 0.015, max: 0.030 }, // commuters: steady
  b2: { min: 0.005, max: 0.018 }, // high-speed: slower volume growth
  b3: { min: 0.020, max: 0.050 }, // low-cost: fastest growth
};

const SIZE_NOISE_ABS = {
  b1: 2,
  b2: 1,
  b3: 4
};

// “How demanding” each segment becomes on each axis
const STRATEGY = {
  b1: { focus: "price"   }, // commuters
  b2: { focus: "speed"   }, // high-speed
  b3: { focus: "price"   }, // low-cost
};

// Controls how quickly focused spec requirements rise vs off-specs
const FOCUS_SPEC_BASE_MIN = 1;
const FOCUS_SPEC_BASE_MAX = 2;
const OFF_SPEC_BASE_MIN   = 0;
const OFF_SPEC_BASE_MAX   = 1;

// Nonlinear price tightening (segmentation amplifier)
const PRICE_TIGHTEN_BASE = 0.06;  // per turn early
const PRICE_TIGHTEN_RAMP = 0.015; // extra tightening that grows with turn
const PRICE_MIN_FLOOR    = 2.0;   // never below this unless you want pain

// caps (keep game playable)
const CAP_COMFORT = 95;
const CAP_SPEED   = 95;
const CAP_PRICE   = 15;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function accelFactor(turn) {
  if (turn <= TURN_ACCEL_START) return 1;
  return 1 + (turn - TURN_ACCEL_START) * TURN_ACCEL_RATE;
}

export function updateBuyersForTurn() {
  const t = state.turn;
  const a = accelFactor(t);

  for (const b of state.buyers) {
    const strat = STRATEGY[b.id];
    const sp = SIZE_PROFILE[b.id];
    if (!strat || !sp) continue;

    // 1) Segment-specific size evolution (not flat)
    const baseGrowth = randInt(sp.baseMin, sp.baseMax);
    const noise = randInt(-sp.volatility, sp.volatility);
    const r = SIZE_GROWTH_RATE[b.id];
    if (r) {
      const rate = randFloat(r.min, r.max);
      const noise = randInt(-SIZE_NOISE_ABS[b.id], SIZE_NOISE_ABS[b.id]);

      const next = Math.round((b.size || 0) * (1 + rate) + noise);
      b.size = Math.max(0, next);
    }

    // 2) Divergence: focus ramps harder over time
    const focusDelta = Math.round(randInt(FOCUS_SPEC_BASE_MIN, FOCUS_SPEC_BASE_MAX) * a);
    const offDelta   = randInt(OFF_SPEC_BASE_MIN, OFF_SPEC_BASE_MAX);

    // 3) Apply the strategy (segmentation becomes obvious)
    if (strat.focus === "comfort") {
      b.minComfort = (b.minComfort || 0) + focusDelta;
      b.minSpeed   = (b.minSpeed   || 0) + offDelta;
    } else if (strat.focus === "speed") {
      b.minSpeed   = (b.minSpeed   || 0) + focusDelta;
      b.minComfort = (b.minComfort || 0) + offDelta;
    } else if (strat.focus === "price") {
      // Tighten willingness-to-pay nonlinearly (this is the “separation” lever)
      const tighten = PRICE_TIGHTEN_BASE + (t * PRICE_TIGHTEN_RAMP);
      b.maxPrice = (b.maxPrice || 1) - tighten;

      // Price-focused still gets slightly pickier, but much slower than “premium” segments
      b.minComfort = (b.minComfort || 0) + offDelta;
      b.minSpeed   = (b.minSpeed   || 0) + offDelta;
    }

    // 4) Sanity caps
    b.minComfort = clamp(b.minComfort, 0, CAP_COMFORT);
    b.minSpeed   = clamp(b.minSpeed,   0, CAP_SPEED);
    b.maxPrice   = clamp(b.maxPrice,   PRICE_MIN_FLOOR, CAP_PRICE);
  }
}
