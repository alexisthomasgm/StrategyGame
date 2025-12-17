/**
 * Market allocation model (requirements gating + weighted split)
 *
 * buyers: [{ id, name, size, minComfort, minSpeed, focus }, ...]
 *   focus: "comfort" | "speed" | "balanced" (optional; defaults to balanced)
 *
 * offers: [{ id, name, comfort, speed }, ...] // includes player + competitors
 *
 * Returns:
 * {
 *   totalSalesByFirm: { [firmId]: number },
 *   playerSales: number,
 *   allocations: [
 *     { buyerId, qualifyingFirmIds: string[], weights: { [firmId]: number }, allocated: { [firmId]: number } }
 *   ]
 * }
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

// Softmax: turns scores into shares that sum to 1, without winner-take-all.
function softmax(scores, temperature = 1.0) {
  // lower temperature => more winner-takes-most; higher => more equal split
  const t = Math.max(0.0001, temperature);

  const max = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(e => e / sum);
}

// Normalized advantage above requirement (0 = barely qualifies, 1+ = far above)
function normalizedAdvantage(value, requirement) {
  // If requirement is 0, avoid division madness
  if (requirement <= 0) return value > 0 ? 1 : 0;
  return (value - requirement) / requirement; // 0 at threshold, grows with advantage
}

// Buyer score for an offer, based on buyer focus.
// You can tune these weights later.
function scoreOfferForBuyer(buyer, offer) {
  const focus = buyer.focus || "balanced";

  const advComfort = normalizedAdvantage(offer.comfort, buyer.minComfort);
  const advSpeed = normalizedAdvantage(offer.speed, buyer.minSpeed);

  // Only qualifying offers are scored, so advantages are >= 0 (or tiny float).
  // Clamp to avoid runaway scores if someone gets huge stats.
  const c = clamp(advComfort, 0, 5);
  const s = clamp(advSpeed, 0, 5);

  // Weighted sum. Speed-focused values speed more, etc.
  if (focus === "speed") return 0.25 * c + 0.75 * s;
  if (focus === "comfort") return 0.75 * c + 0.25 * s;

  // balanced
  return 0.5 * c + 0.5 * s;
}

export function estimateSales({ buyers, offers, playerId = "player" }) {
  const totalSalesByFirm = {};
  const allocations = [];

  for (const offer of offers) totalSalesByFirm[offer.id] = 0;

  for (const buyer of buyers) {
    // 1) Hard gate: eliminate non-qualifying offers
    const qualifying = offers.filter(o =>
      o.comfort >= buyer.minComfort && o.speed >= buyer.minSpeed
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

    // Temperature controls how "aggressive" allocation is.
    // 0.6 => strongly favors best, but still shares; 1.0 => softer.
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
