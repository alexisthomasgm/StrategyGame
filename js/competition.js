import { state } from "./main.js";

// Tunables
const MIN_MARGIN = 0.30;
const BASE_UNIT_COST = 1;
const COST_SLOPE = 0.01;
const PRICE_STEP = 0.25;
const IMPROVE_FOCUS_MIN = 2;
const IMPROVE_FOCUS_MAX = 5;
const IMPROVE_OFF_MIN = 0;
const IMPROVE_OFF_MAX = 2;
const FEATURE__CONSTANT_COST = 100; // keep consistent with production.js

// Feature adoption "cost" (tradeoffs)
const FEATURE_COST = {
  accessibility: { comfort: 2, speed: 1 },
  wifi:          { comfort: 1, speed: 2 },
  restauration:  { comfort: 3, speed: 3 }
};

// How much the competitor *cares* about losing a point of its focus vs off-stat
// Larger = more reluctant to sacrifice that stat.
const STRATEGY_STAT_PENALTY = {
  comfort: { comfort: 1.6, speed: 1.0 },
  speed:   { comfort: 1.0, speed: 1.6 }
};

// Strategy-flavored feature preference multipliers (optional but makes it feel “human”)
const STRATEGY_FEATURE_BIAS = {
  comfort: { accessibility: 1.1, wifi: 0.9, restauration: 1.25 },
  speed:   { accessibility: 1.0, wifi: 1.2, restauration: 0.95 }
};

// Minimum “net gain” required before adopting (in demand points)
const FEATURE_ADOPT_NET_THRESHOLD = 35;

const STRATEGY = {
  c1: { focus: "comfort" },
  c2: { focus: "speed" },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function unitCostFor(c) {
  const feats = c.features || {};
  const featureRd =
    (feats.accessibility ? FEATURE__CONSTANT_COST : 0) +
    (feats.wifi ? FEATURE__CONSTANT_COST : 0) +
    (feats.restauration ? FEATURE__CONSTANT_COST : 0);

  const rd = (c.comfort || 0) + (c.speed || 0) + featureRd;
  return BASE_UNIT_COST + rd * COST_SLOPE;
}

function minPriceForMargin(unitCost) {
  return unitCost / (1 - MIN_MARGIN);
}

function roundToStep(x, step) {
  return Math.ceil(x / step) * step;
}

function demandUnlockedByConfig(config) {
  let total = 0;

  for (const b of state.buyers) {
    if (config.comfort < b.minComfort || config.speed < b.minSpeed) continue;

    const req = b.reqFeatures || {};
    const have = config.features || {};

    let ok = true;
    for (const k of Object.keys(req)) {
      if (req[k] && !have[k]) { ok = false; break; }
    }
    if (!ok) continue;

    total += b.size;
  }
  return total;
}

function shouldAdoptFeature(c, stratFocus, featureKey) {
  const nowDemand = demandUnlockedByConfig({
    comfort: c.comfort || 0,
    speed: c.speed || 0,
    features: c.features || {}
  });

  const { sim, cost } = simulateAdoptWithCost(c, featureKey);
  const withDemand = demandUnlockedByConfig(sim);

  const rawGain = withDemand - nowDemand;
  if (rawGain <= 0) return false;

  // Strategy bias: some features “feel right” for some competitors
  const bias = (STRATEGY_FEATURE_BIAS[stratFocus]?.[featureKey] ?? 1.0);

  // Stat sacrifice penalty (strategy-specific)
  const penW = STRATEGY_STAT_PENALTY[stratFocus] || { comfort: 1.0, speed: 1.0 };
  const statPenalty =
    (cost.comfort * penW.comfort) +
    (cost.speed   * penW.speed);

  // Net score in "demand points"
  const net = rawGain * bias - statPenalty;

  return net >= FEATURE_ADOPT_NET_THRESHOLD;
}

function simulateAdoptWithCost(c, featureKey) {
  const cost = FEATURE_COST[featureKey] || { comfort: 0, speed: 0 };

  // Simulate post-adoption stats (cost paid immediately)
  const sim = {
    comfort: Math.max(0, (c.comfort || 0) - cost.comfort),
    speed:   Math.max(0, (c.speed || 0) - cost.speed),
    features: { ...(c.features || {}), [featureKey]: true }
  };

  return { sim, cost };
}

function canCompetitorReactToFeature(featureKey) {
  // Feature must be revealed, and competitors only react starting the NEXT turn after reveal.
  const revealed = !!state.market?.revealed?.[featureKey];
  if (!revealed) return false;

  const t = state.market?.revealedTurn?.[featureKey];
  if (t == null) return false;

  // Example:
  // - reveal happens on turn 6 (t=6)
  // - competitors can react on turn 7+ (state.turn > 6)
  return state.turn > (t + 1);
}

export function updateCompetitorsForTurn() {
  for (const c of state.competitors) {
    if (state.turn < c.showFrom) continue;

    const strat = STRATEGY[c.id];
    if (!strat) continue;

    // Ensure features object exists
    if (!c.features) c.features = { accessibility:false, wifi:false, restauration:false };

    // 1) Improve product slightly each turn
    const accel = 1 + Math.max(0, state.turn - c.showFrom) * 0.03;
    const focusDelta = Math.round(randInt(IMPROVE_FOCUS_MIN, IMPROVE_FOCUS_MAX) * accel);
    const offDelta = randInt(IMPROVE_OFF_MIN, IMPROVE_OFF_MAX);

    if (strat.focus === "comfort") {
      c.comfort = (c.comfort || 0) + focusDelta;
      c.speed = (c.speed || 0) + offDelta;
    } else {
      c.speed = (c.speed || 0) + focusDelta;
      c.comfort = (c.comfort || 0) + offDelta;
    }

    // 1b) Feature adoption (LAGGED)
    for (const featureKey of ["accessibility", "wifi", "restauration"]) {
      if (!canCompetitorReactToFeature(featureKey)) continue;
      if (c.features[featureKey]) continue;

    if (shouldAdoptFeature(c, strat.focus, featureKey)) {
      // Apply feature AND the cost (tradeoff)
      const { cost } = simulateAdoptWithCost(c, featureKey);

      c.features[featureKey] = true;
      c.comfort = Math.max(0, (c.comfort || 0) - cost.comfort);
      c.speed   = Math.max(0, (c.speed   || 0) - cost.speed);
    }
    }

    // 2) Pricing: maintain >= 30% margin
    const unitCost = unitCostFor(c);
    const minP = minPriceForMargin(unitCost);
    const target = minP * 1.05;

    const nextPrice =
      c.price < target
        ? Math.min(target, c.price + PRICE_STEP)
        : Math.max(target, c.price - PRICE_STEP);

    c.price = roundToStep(Math.max(nextPrice, minP), 0.25);

    // 3) Cosmetic supply expansion
    if ((state.turn % 4) === 0) {
      c.supplyCapacity = (c.supplyCapacity || 0) + 25;
    }
  }
}
