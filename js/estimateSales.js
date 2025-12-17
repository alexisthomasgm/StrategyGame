/**
 * Market allocation model (requirements gating + weighted split + feature requirements)
 *
 * buyers: [{ id, name, size, minComfort, minSpeed, focus, reqFeatures }, ...]
 * offers: [{ id, name, comfort, speed, features }, ...]
 */

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

export function estimateSales({ buyers, offers, playerId = "player" }) {
  const totalSalesByFirm = {};
  const allocations = [];

  for (const offer of offers) totalSalesByFirm[offer.id] = 0;

  for (const buyer of buyers) {
    // 1) Hard gate: specs + feature requirements
    const qualifying = offers.filter(o =>
      o.comfort >= buyer.minComfort &&
      o.speed >= buyer.minSpeed &&
      meetsFeatureReq(buyer.reqFeatures, o.features)
    );

    if (qualifying.length === 0) {
      allocations.push({
        buyerId: buyer.id,
        qualifyingFirmIds: [],
        weights: {},
        allocated: {}
      });
      continue;
    }

    // 2) Compute scores -> shares (softmax)
    const scores = qualifying.map(o => scoreOfferForBuyer(buyer, o));
    const shares = softmax(scores, buyer.temperature ?? 0.7);

    // 3) Allocate buyer.size across firms
    const allocated = {};
    const weights = {};
    qualifying.forEach((firm, i) => {
      const share = shares[i];
      const units = buyer.size * share;
      allocated[firm.id] = units;
      weights[firm.id] = share;
      totalSalesByFirm[firm.id] += units;
    });

    allocations.push({
      buyerId: buyer.id,
      qualifyingFirmIds: qualifying.map(q => q.id),
      weights,
      allocated
    });
  }

  return {
    totalSalesByFirm,
    playerSales: totalSalesByFirm[playerId] ?? 0,
    allocations
  };
}
