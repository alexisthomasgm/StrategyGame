import { state } from "./main.js";

// Tunables
const MIN_MARGIN = 0.30;
const BASE_UNIT_COST = 1;     // baseline cost per unit
const COST_SLOPE = 0.01;      // cost increases with "R&D allocation" (comfort+speed)
const PRICE_STEP = 0.25;      // how quickly they adjust price toward target
const IMPROVE_FOCUS_MIN = 2;
const IMPROVE_FOCUS_MAX = 5;
const IMPROVE_OFF_MIN = 0;
const IMPROVE_OFF_MAX = 2;

const STRATEGY = {
  c1: { focus: "comfort" },
  c2: { focus: "speed" },
  // c3 optional later
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

export function updateCompetitorsForTurn() {
  for (const c of state.competitors) {
    // Only update once they exist in the market
    if (state.turn < c.showFrom) continue;

    const strat = STRATEGY[c.id];
    if (!strat) continue; // ignore competitors without strategy

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

    // 2) Pricing: maintain >= 30% margin
    const unitCost = unitCostFor(c);
    const minP = minPriceForMargin(unitCost);

    // Keep them competitive-ish: drift price toward ~5% above minimum margin price,
    // but NEVER below minimum margin.
    const target = minP * 1.05;

    const nextPrice =
      c.price < target
        ? Math.min(target, c.price + PRICE_STEP)
        : Math.max(target, c.price - PRICE_STEP);

    c.price = roundToStep(Math.max(nextPrice, minP), 0.25);

    // 3) Optional: tiny supply expansion occasionally (purely cosmetic for now)
    // (doesn't affect sales yet, since you told me not to touch that)
    if ((state.turn % 4) === 0) {
      c.supplyCapacity = (c.supplyCapacity || 0) + 25;
    }
  }
}
