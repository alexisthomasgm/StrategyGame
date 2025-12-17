import { state, $ } from "./main.js";

const FIRM_COLORS = {
  player: "#4A90E2",
  c1: "#E94E77",
  c2: "#50E3C2",
  none: "#B0B0B0"
};

function featuresToChecks(features) {
  const f = features || {};
  const a = f.accessibility ? "✅" : "—";
  const w = f.wifi ? "✅" : "—";
  const r = f.restauration ? "✅" : "—";
  return `${a} ${w} ${r}`;
}

function fmtMoney(n) {
  if (n === "—" || n === null || n === undefined) return "—";
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function playerQualifies(buyer) {
  const com = state.production.comfort;
  const spd = state.production.speed;
  return com >= buyer.minComfort && spd >= buyer.minSpeed;
}

function getBuyerAllocation(buyerId) {
  const lm = state.lastMarket;
  if (!lm || !lm.allocations) return null;
  return lm.allocations.find(a => a.buyerId === buyerId) || null;
}

function renderBuyerReqBox(b) {
  const el = $(`${b.id}Req`);
  if (!el) return;

  // Display only for now (no sales logic impact)
  const maxPrice = (b.maxPrice ?? b.price ?? "—");

  el.innerHTML = `
    <div class="spec-line"><span class="spec-label">Comfort</span><span class="spec-value">${b.minComfort}</span></div>
    <div class="spec-line"><span class="spec-label">Speed</span><span class="spec-value">${b.minSpeed}</span></div>
    <div class="spec-line">
    <span class="spec-label">Price</span>
    <span class="spec-value">${maxPrice === "—" ? "—" : `$${fmtMoney(maxPrice)}`}</span>
    </div>
    <div class="spec-line"><span class="spec-label">Features</span><span class="spec-value">${featuresToChecks(b.features)}</span></div>
  `;
}

function renderSellerSpecsBox(domIdPrefix, cap, spd, features, price) {
  const el = $(`${domIdPrefix}Specs`);
  if (!el) return;

  el.innerHTML = `
    <div class="spec-line"><span class="spec-label">Comfort</span><span class="spec-value">${cap}</span></div>
    <div class="spec-line"><span class="spec-label">Speed</span><span class="spec-value">${spd}</span></div>
    <div class="spec-line"><span class="spec-label">Price</span><span class="spec-value">$${fmtMoney(price)}</span></div>
    <div class="spec-line"><span class="spec-label">Features</span><span class="spec-value">${featuresToChecks(features)}</span></div>
  `;
}

function upsertBuyerPie(canvasId, allocationsByFirm) {
  if (typeof Chart === "undefined") return;

  const canvas = $(canvasId);
  if (!canvas) return;

  const key = `__pie_${canvasId}`;
  if (window[key]) window[key].destroy();

  const hasSales =
    allocationsByFirm &&
    Object.values(allocationsByFirm).some(v => v > 0);

  let labels = [];
  let values = [];
  let colors = [];

  if (!hasSales) {
    labels = ["No sales"];
    values = [1];
    colors = [FIRM_COLORS.none];
  } else {
    const ORDER = ["player", "c1", "c2"]; // stable order

    for (const firmId of ORDER) {
      const amt = allocationsByFirm[firmId] ?? 0;
      if (amt <= 0) continue;

      labels.push(firmId === "player" ? "You" : firmId.toUpperCase());
      values.push(amt);
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
  // --- YOU: bubble shows SUPPLY; specs show product specs + price ---
  const youCapEl = $("youCap");
  if (youCapEl) {
    youCapEl.textContent = `Supply: ${state.pricing.supplyCapacity}`;
  }

  renderSellerSpecsBox(
    "you",
    state.production.comfort,
    state.production.speed,
    state.production.features,
    state.pricing.price
  );

  // --- Competitors: show only when active ---
  for (const c of state.competitors) {
    const isActive = state.turn >= c.showFrom;

    const bubble = $(c.bubbleId);
    const stack = $(`${c.id}Stack`);

    if (bubble) bubble.classList.toggle("hidden", !isActive);
    if (stack) stack.classList.toggle("hidden", !isActive);

    if (!isActive) continue;

    // Bubble title + SUPPLY
    const nameEl = $(`${c.id}Name`);
    if (nameEl) nameEl.textContent = c.name;

    const sizeEl = $(`${c.id}Size`);
    if (sizeEl) sizeEl.textContent = `Supply: ${c.supplyCapacity ?? "—"}`;

    // Specs box: Comfort / Speed / Price / Features
    renderSellerSpecsBox(
      c.id,
      c.comfort,
      c.speed,
      c.features,
      c.price
    );
  }

  // --- Buyers: labels + qualification + requirements + buyer pies ---
  for (const b of state.buyers) {
    const nameEl = $(`${b.id}Name`);
    if (nameEl) nameEl.textContent = b.name;

    const sizeEl = $(`${b.id}Size`);
    if (sizeEl) sizeEl.textContent = `Size: ${b.size}`;

    const statusEl = $(`${b.id}Status`);
    if (statusEl) {
      const qualifies = playerQualifies(b);
      statusEl.textContent = qualifies ? "✅ You qualify" : "❌ You don’t qualify";
      statusEl.classList.toggle("ok", qualifies);
      statusEl.classList.toggle("bad", !qualifies);
    }

    renderBuyerReqBox(b);

    const alloc = getBuyerAllocation(b.id);
    upsertBuyerPie(`${b.id}Pie`, alloc ? alloc.allocated : null);
  }
}
