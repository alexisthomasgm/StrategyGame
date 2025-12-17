import { estimateSales } from "./estimateSales.js";
import { state, pushHistory, renderTopBar, $ } from "./main.js";
import { renderMarket } from "./market.js";

export function setupEndTurn() {
  $("btnNext").addEventListener("click", () => {
    // Pay production every turn
    state.money -= state.production.budget;

    // Offers in market (you + placeholder competitors)
    const offers = [
    {
        id: "player",
        name: "You",
        capacity: state.production.capacity,
        speed: state.production.speed
    },
    ...state.competitors
        .filter(c => state.turn >= c.showFrom)
        .map(c => ({ id: c.id, name: c.name, capacity: c.capacity, speed: c.speed }))
    ];

    const result = estimateSales({
      buyers: state.buyers,
      offers,
      playerId: "player"
    });

    // ✅ STORE last market result HERE
    state.lastMarket = result;

    const sales = result.playerSales;
    const revenue = sales * state.pricing.price;
    state.money += Math.max(0, revenue);

    pushHistory(state.turn, state.pricing.price, sales);

    state.turn += 1;
    renderTopBar();
    renderMarket(); // update buyer UI immediately
  });
}
