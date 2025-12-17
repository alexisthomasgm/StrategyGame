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

const STRATEGY = {
  c1: { focus: "comfort" },
  c2: { focus: "speed" },
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function unitCostFor(c) {
  const rd = (c.comfort || 0) + (c.speed || 0);
  return BASE_UNIT_COST + rd * COST_SLOPE;
}

function minPriceForMargin(unitCost) {
  return unitCost / (1 - MIN_MARGIN);
}

function roundToStep(x, step) {
  return Math.ceil(x / step) * step;
}

function unlockedDemandIfAdopt(c, featureKey) {
  let total = 0;

  for (const b of state.buyers) {
    if (c.comfort < b.minComfort || c.speed < b.minSpeed) continue;

    const req = b.reqFeatures || {};
    const have = { ...(c.features || {}), [featureKey]: true };

    let ok = true;
    for (const k of Object.keys(req)) {
      if (req[k] && !have[k]) { ok = false; break; }
    }
    if (!ok) continue;

    total += b.size;
  }
  return total;
}

function unlockedDemandNow(c) {
  let total = 0;

  for (const b of state.buyers) {
    if (c.comfort < b.minComfort || c.speed < b.minSpeed) continue;

    const req = b.reqFeatures || {};
    const have = c.features || {};

    let ok = true;
    for (const k of Object.keys(req)) {
      if (req[k] && !have[k]) { ok = false; break; }
    }
    if (!ok) continue;

    total += b.size;
  }

  return total;
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
    const focusDelta = randInt(IMPROVE_FOCUS_MIN, IMPROVE_FOCUS_MAX);
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

      const now = unlockedDemandNow(c);
      const withIt = unlockedDemandIfAdopt(c, featureKey);

      // adopt if it unlocks meaningful demand
      if (withIt - now >= 40) {
        c.features[featureKey] = true;
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
