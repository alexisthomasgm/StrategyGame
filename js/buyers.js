import { state } from "./main.js";

// Tunables
const SIZE_GROWTH_MIN = 2;
const SIZE_GROWTH_MAX = 6;

const SPEC_GROWTH_OFF_MIN = 0;
const SPEC_GROWTH_OFF_MAX = 1;

const PRICE_TIGHTEN_STEP = 0.1;   // maxPrice drops per turn for price buyer (strictness)
const SPEC_GROWTH_FOCUS_MIN = 1;
const SPEC_GROWTH_FOCUS_MAX = 3;

const BUYER_STRATEGY = {
  b1: { focus: "price" },
  b2: { focus: "comfort" },
  b3: { focus: "speed" }
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function updateBuyersForTurn() {
  for (const b of state.buyers) {
    const strat = BUYER_STRATEGY[b.id];
    if (!strat) continue;

    // 1) Size grows over time
    b.size = (b.size || 0) + randInt(SIZE_GROWTH_MIN, SIZE_GROWTH_MAX);

    // 2) Becoming more demanding (different focus per buyer)
    const focusDelta = randInt(SPEC_GROWTH_FOCUS_MIN, SPEC_GROWTH_FOCUS_MAX);
    const offDelta = randInt(SPEC_GROWTH_OFF_MIN, SPEC_GROWTH_OFF_MAX);

    if (strat.focus === "comfort") {
      b.minComfort = (b.minComfort || 0) + focusDelta;
      b.minSpeed = (b.minSpeed || 0) + offDelta;
    } else if (strat.focus === "speed") {
      b.minSpeed = (b.minSpeed || 0) + focusDelta;
      b.minComfort = (b.minComfort || 0) + offDelta;
    } else if (strat.focus === "price") {
      // Price buyer gets stricter on price
      b.maxPrice = Math.max(1, (b.maxPrice || 1) - PRICE_TIGHTEN_STEP);

      // Still gets a little more demanding on specs, but slower
      b.minComfort = (b.minComfort || 0) + offDelta;
      b.minSpeed = (b.minSpeed || 0) + offDelta;
    }

    // Optional sanity caps so the game doesn’t go insane in 50 turns
    b.minComfort = clamp(b.minComfort, 0, 999);
    b.minSpeed = clamp(b.minSpeed, 0, 999);
    b.maxPrice = clamp(b.maxPrice, 1, 999);
  }
}
