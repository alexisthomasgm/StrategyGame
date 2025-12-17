/**
 * Market allocation model (requirements gating + weighted split + feature requirements)
 *
 * buyers: [{ id, name, size, minComfort, minSpeed, focus, reqFeatures }, ...]
 * offers: [{ id, name, comfort, speed, features }, ...]
 */

const FUZZY_FALLBACK_SHARE = 0.5;     // "half its remaining size"
const FUZZY_PRICE_SLACK = 0.20;       // allow up to +20% above maxPrice
const FUZZY_SPEC_SLACK = 0.12;        // allow up to 12% below minComfort/minSpeed
const FUZZY_SCORE_PENALTY = 0.75;     // downweight near-miss vs true qualifiers

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Softmax: turns scores into shares that sum to 1, without winner-take-all.
function softmax(scores, temperature = 1.0) {
  const t = Math.max(0.0001, temperature);
  const max = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(e => e / sum);
}

// Normalized advantage above requirement (0 = barely qualifies, 1+ = far above)
function normalizedAdvantage(value, requirement) {
  if (requirement <= 0) return value > 0 ? 1 : 0;
  return (value - requirement) / requirement;
}

// Buyer requires features? seller must have them all.
function meetsFeatureReq(reqFeatures, sellerFeatures) {
  const req = reqFeatures || {};
  const have = sellerFeatures || {};
  for (const k of Object.keys(req)) {
    if (req[k] && !have[k]) return false;
  }
  return true;
}

// Count how many required features are demanded (for bonus calc)
function countRequired(reqFeatures) {
  const req = reqFeatures || {};
  let n = 0;
  for (const k of Object.keys(req)) if (req[k]) n++;
  return n;
}

// Count how many features seller has among known keys
function countSellerFeatures(features) {
  const f = features || {};
  let n = 0;
  for (const k of ["accessibility", "wifi", "restauration"]) if (f[k]) n++;
  return n;
}

// Score based on buyer focus + small feature bonus
function scoreOfferForBuyer(buyer, offer) {
  const focus = buyer.focus || "balanced";

  const advComfort = normalizedAdvantage(offer.comfort, buyer.minComfort);
  const advSpeed = normalizedAdvantage(offer.speed, buyer.minSpeed);

  const c = clamp(advComfort, 0, 5);
  const s = clamp(advSpeed, 0, 5);

  let score;
  if (focus === "speed") score = 0.25 * c + 0.75 * s;
  else if (focus === "comfort") score = 0.75 * c + 0.25 * s;
  else score = 0.5 * c + 0.5 * s;

  // --- Feature bonuses (kept small on purpose) ---
  // If buyer requires features, reward having them (even though it's already gated).
  const reqCount = countRequired(buyer.reqFeatures);
  if (reqCount > 0) score += 0.10 * reqCount; // tune (0.10 is mild)

  // Optional tiny bump for "more features" (market perception).
  // Set to 0 if you want *no* effect unless required.
  const sellerFeatCount = countSellerFeatures(offer.features);
  score += 0.02 * sellerFeatCount; // tiny

  return score;
}

function withinSpecSlack(value, requirement, slackFrac) {
  if (requirement <= 0) return true;
  return value >= requirement * (1 - slackFrac);
}

function withinPriceSlack(price, maxPrice, slackFrac) {
  if (maxPrice <= 0) return false;
  return price <= maxPrice * (1 + slackFrac);
}

// A penalty multiplier based on how “close” the offer is.
// 1.0 = perfect, lower = worse. Kept simple and stable.
function closenessMultiplier(buyer, offer) {
  // price closeness: <=maxPrice => 1, above => linearly down to 0 at slack limit
  const priceMax = buyer.maxPrice;
  const priceLimit = priceMax * (1 + FUZZY_PRICE_SLACK);
  let priceMul = 1;
  if (offer.price > priceMax) {
    priceMul = 1 - (offer.price - priceMax) / Math.max(0.0001, (priceLimit - priceMax));
    priceMul = clamp(priceMul, 0, 1);
  }

  // spec closeness: >=min => 1, below => linearly down to 0 at slack limit
  const comMin = buyer.minComfort;
  const comLimit = comMin * (1 - FUZZY_SPEC_SLACK);
  let comMul = 1;
  if (offer.comfort < comMin) {
    comMul = 1 - (comMin - offer.comfort) / Math.max(0.0001, (comMin - comLimit));
    comMul = clamp(comMul, 0, 1);
  }

  const spdMin = buyer.minSpeed;
  const spdLimit = spdMin * (1 - FUZZY_SPEC_SLACK);
  let spdMul = 1;
  if (offer.speed < spdMin) {
    spdMul = 1 - (spdMin - offer.speed) / Math.max(0.0001, (spdMin - spdLimit));
    spdMul = clamp(spdMul, 0, 1);
  }

  // Combine. Price usually matters a lot, so weight it slightly more.
  return clamp(0.45 * priceMul + 0.275 * comMul + 0.275 * spdMul, 0, 1);
}

export function estimateSales({ buyers, offers, playerId = "player" }) {
  const totalSalesByFirm = {};
  const allocations = [];

  // Remaining capacity per firm (Infinity if not provided)
  const remainingCap = {};
  for (const o of offers) {
    totalSalesByFirm[o.id] = 0;
    const cap = o.supplyCapacity;
    remainingCap[o.id] = (typeof cap === "number" && Number.isFinite(cap)) ? cap : Infinity;
  }

  for (const buyer of buyers) {
    // STRICT qualify (plus capacity > 0)
    let qualifying = offers.filter(o =>
      o.price <= buyer.maxPrice &&
      o.comfort >= buyer.minComfort &&
      o.speed >= buyer.minSpeed &&
      meetsFeatureReq(buyer.reqFeatures, o.features) &&
      remainingCap[o.id] > 0
    );

    let fuzzyMode = false;
    let demandToAllocate = buyer.size;

    // FUZZY fallback if nobody qualifies
    if (qualifying.length === 0) {
      fuzzyMode = true;
      demandToAllocate = buyer.size * FUZZY_FALLBACK_SHARE;

      qualifying = offers.filter(o =>
        withinPriceSlack(o.price, buyer.maxPrice, FUZZY_PRICE_SLACK) &&
        withinSpecSlack(o.comfort, buyer.minComfort, FUZZY_SPEC_SLACK) &&
        withinSpecSlack(o.speed, buyer.minSpeed, FUZZY_SPEC_SLACK) &&
        meetsFeatureReq(buyer.reqFeatures, o.features) &&
        remainingCap[o.id] > 0
      );
    }

    if (qualifying.length === 0 || demandToAllocate <= 0) {
      allocations.push({
        buyerId: buyer.id,
        qualifyingFirmIds: [],
        weights: {},
        allocated: {},
        unmet: buyer.size,
        fuzzyMode
      });
      continue;
    }

    // Scores -> shares
    let scores = qualifying.map(o => scoreOfferForBuyer(buyer, o));

    if (fuzzyMode) {
      scores = scores.map((s, i) => {
        const o = qualifying[i];
        const close = closenessMultiplier(buyer, o); // 0..1
        return s * (FUZZY_SCORE_PENALTY * close);
      });
    }

    const shares = softmax(scores, buyer.temperature ?? 0.7);

    // Desired allocation by share (BASED ON demandToAllocate)
    const desired = {};
    const weights = {};
    qualifying.forEach((firm, i) => {
      weights[firm.id] = shares[i];
      desired[firm.id] = demandToAllocate * shares[i];
    });

    // Allocate with capacity constraints + redistribution
    const allocated = {};
    let remainingDemand = demandToAllocate;

    let active = qualifying
      .map(f => f.id)
      .filter(id => remainingCap[id] > 1e-9 && (desired[id] ?? 0) > 1e-9);

    while (remainingDemand > 1e-9 && active.length > 0) {
      let wSum = 0;
      for (const id of active) wSum += (weights[id] ?? 0);
      if (wSum <= 0) break;

      let anyAllocatedThisRound = false;

      for (const id of active) {
        const w = (weights[id] ?? 0) / wSum;
        const want = remainingDemand * w;

        const firmDesiredLeft = (desired[id] ?? 0) - (allocated[id] ?? 0);
        const capLeft = remainingCap[id];

        const give = Math.max(0, Math.min(want, firmDesiredLeft, capLeft));
        if (give > 0) {
          allocated[id] = (allocated[id] ?? 0) + give;
          remainingCap[id] -= give;
          remainingDemand -= give;
          totalSalesByFirm[id] += give;
          anyAllocatedThisRound = true;
        }
      }

      active = active.filter(id =>
        remainingCap[id] > 1e-9 &&
        ((desired[id] ?? 0) - (allocated[id] ?? 0)) > 1e-9
      );

      if (!anyAllocatedThisRound) break;
    }

    // In fuzzy mode, the "other half" is demand that refuses to buy by design
    const refusedByDesign = fuzzyMode ? (buyer.size - demandToAllocate) : 0;

    allocations.push({
      buyerId: buyer.id,
      qualifyingFirmIds: qualifying.map(q => q.id),
      weights,
      allocated,
      unmet: Math.max(0, remainingDemand + refusedByDesign),
      fuzzyMode
    });
  }

  return {
    totalSalesByFirm,
    playerSales: totalSalesByFirm[playerId] ?? 0,
    allocations
  };
}
