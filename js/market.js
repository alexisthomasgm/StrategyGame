import { state, $ } from "./main.js";

const FIRM_COLORS = {
  player: "#4A90E2",   // blue
  c1: "#E94E77",       // red
  c2: "#50E3C2",       // green
  none: "#B0B0B0"      // grey for no sales
};

function playerQualifies(buyer) {
  const cap = state.production.capacity;
  const spd = state.production.speed;
  return cap >= buyer.minCapacity && spd >= buyer.minSpeed;
}

function getBuyerAllocation(buyerId) {
  const lm = state.lastMarket;
  if (!lm || !lm.allocations) return null;
  return lm.allocations.find(a => a.buyerId === buyerId) || null;
}

function upsertPieChart(canvasId, allocations) {
  if (typeof Chart === "undefined") return;

  const canvas = $(canvasId);
  if (!canvas) return;

  const key = `__pie_${canvasId}`;
  if (window[key]) window[key].destroy();

  // No allocations OR all zero → grey "No sales"
  const hasSales =
    allocations &&
    Object.values(allocations).some(v => v > 0);

  let labels, values, colors;

  if (!hasSales) {
    labels = ["No sales"];
    values = [1];
    colors = [FIRM_COLORS.none];
  } else {
    labels = [];
    values = [];
    colors = [];

    for (const [firmId, amount] of Object.entries(allocations)) {
      if (amount <= 0) continue;
      labels.push(firmId === "player" ? "You" : firmId.toUpperCase());
      values.push(amount);
      colors.push(FIRM_COLORS[firmId] || "#999");
    }
  }

  window[key] = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      cutout: "55%"
    }
  });
}

export function renderMarket() {
  // Render buyer labels + requirements + qualification + last-turn pie split
  for (const b of state.buyers) {
    const buyerEl = $(b.id);
    if (buyerEl) buyerEl.querySelector(".token-title").textContent = b.name;

    const statsEl = $(`${b.id}Stats`);
    if (statsEl) {
      statsEl.innerHTML =
        `Size: <b>${b.size}</b><br>` +
        `Min Cap: <b>${b.minCapacity}</b> · Min Spd: <b>${b.minSpeed}</b>`;
    }

    const statusEl = $(`${b.id}Status`);
    const qualifies = playerQualifies(b);
    if (statusEl) {
      statusEl.textContent = qualifies ? "✅ You qualify" : "❌ You don’t qualify";
      statusEl.classList.toggle("ok", qualifies);
      statusEl.classList.toggle("bad", !qualifies);
    }

    for (const c of state.competitors) {
        const bubble = $(c.bubbleId);
        if (!bubble) continue;

        const isActive = state.turn >= c.showFrom;
        bubble.classList.toggle("hidden", !isActive);

        if (isActive) {
            $(`${c.id}Name`).textContent = c.name;
            $(`${c.id}Stats`).innerHTML = `Cap: <b>${c.capacity}</b> · Spd: <b>${c.speed}</b>`;
        }
    }
    const alloc = getBuyerAllocation(b.id);
    upsertPieChart(
    `${b.id}Pie`,
    alloc ? alloc.allocated : null
    );
  }
}
