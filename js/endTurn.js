import { estimateSales } from "./estimateSales.js";
import { state, pushHistory, renderTopBar, $ } from "./main.js";
import { renderMarket } from "./market.js";
import { updateCompetitorsForTurn } from "./competition.js";
import { updateBuyersForTurn } from "./buyers.js";
import { revealFeatureDemand } from "./marketEvolution.js";

function unitCostFromRnD() {
  // "R&D allocation" = how ambitious your product spec is.
  // You said: scales with R&D allocation. We'll use cap+spd for now.
  const rd = (state.production.comfort || 0) + (state.production.speed || 0);

  // Baseline + scaling. Tune later.
  // Example: rd=0 => 1, rd=100 => 2, rd=200 => 3, etc.
  const base = 1;
  const slope = 0.01; // cost increases by 0.01 per R&D point
  return base + rd * slope;
}

export function setupEndTurn() {
  $("btnNext").addEventListener("click", () => {
    // --- 1) Pay R&D investment (production budget) every turn ---
    state.money -= state.production.budget;

    // --- 2) Pay fixed cost of supply capacity (1 per capacity) ---
    const fixedCapacityCost = (state.pricing.supplyCapacity || 0) * 1;
    state.money -= fixedCapacityCost;

    updateCompetitorsForTurn();
    updateBuyersForTurn();

    // Offers in market (you + competitors)
    const offers = [
      {
        id: "player",
        name: "You",
        comfort: state.production.comfort,
        speed: state.production.speed
      },
      ...state.competitors
        .filter(c => state.turn >= c.showFrom)
        .map(c => ({ id: c.id, name: c.name, comfort: c.comfort, speed: c.speed }))
    ];

    const result = estimateSales({
      buyers: state.buyers,
      offers,
      playerId: "player"
    });

    // ✅ store last market
    state.lastMarket = result;

    // --- 3) Revenue ---
    const sales = result.playerSales;
    const revenue = sales * state.pricing.price;

    // --- 4) Variable cost (COGS): cost per unit sold, scales with R&D allocation ---
    const unitCost = unitCostFromRnD();
    const variableCost = sales * unitCost;

    // Net cash impact of sales
    state.money += Math.max(0, revenue - variableCost);

    // (Optional) keep these for debugging/UI later
    state.lastTurn = {
      sales,
      revenue,
      unitCost,
      variableCost,
      fixedCapacityCost,
      rdBudget: state.production.budget
    };

    pushHistory(state.turn, state.pricing.price, sales);

    state.turn += 1;
    const pending = state.market?.pendingReveals || [];
    if (pending.length) {
    for (const k of pending) revealFeatureDemand(k);
    state.market.pendingReveals = [];
    }
    renderTopBar();
    renderMarket();
  });
}
