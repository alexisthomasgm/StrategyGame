import { state, openPanel, closePanel, $, renderTopBar } from "./main.js";
import { renderMarket } from "./market.js";

const CAPACITY_STEP = 100;
const CAPACITY_STEP_COST = 500;

const UNIT_COST_BASE = 1;
const UNIT_COST_SLOPE = 0.01;
const FEATURE_COST = 100; // must match production.js

function estimateUnitCost() {
  // IMPORTANT: use preview values if player is in Production panel
  const p = state.previewProduction || state.production;

  const feats = p.features || {};
  const featureRd =
    (feats.accessibility ? FEATURE_COST : 0) +
    (feats.wifi ? FEATURE_COST : 0) +
    (feats.restauration ? FEATURE_COST : 0);

  const rd =
    (p.comfort || 0) +
    (p.speed || 0) +
    featureRd;

  return UNIT_COST_BASE + rd * UNIT_COST_SLOPE;
}

function fmtMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

function renderPricingChart() {
  if (typeof Chart === "undefined") {
    $("chartWrap").innerHTML = `<p><b>Chart.js not loaded.</b> Check your CDN script tag.</p>`;
    return;
  }

  const ctx = $("pricingChart").getContext("2d");
  if (window.pricingChartInstance) window.pricingChartInstance.destroy();

  window.pricingChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: state.history.turns.map(t => `T${t}`),
      datasets: [
        { label: "Sales", data: state.history.sales, tension: 0.25 },
        { label: "Price", data: state.history.price, tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

export function setupPricingUI() {
  $("btnPricing").addEventListener("click", () => {
    if (typeof state.pricing.supplyCapacity !== "number") state.pricing.supplyCapacity = 100;
    if (typeof state.pricing.price !== "number") state.pricing.price = 5;

    // --- Pending (only committed on Save) ---
    let pendingPrice = state.pricing.price;
    let pendingSupply = state.pricing.supplyCapacity;

    function pendingUpgradesCount() {
      return Math.max(0, Math.round((pendingSupply - state.pricing.supplyCapacity) / CAPACITY_STEP));
    }
    function pendingCost() {
      return pendingUpgradesCount() * CAPACITY_STEP_COST;
    }

    openPanel("Pricing Decisions", `
      <div style="display:grid; gap:12px;">
        <div id="chartWrap" style="height:260px;">
          <canvas id="pricingChart"></canvas>
        </div>

        <!-- Price + Supply on same row -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:end;">
          <label style="display:grid; gap:6px;">
            <span><b>Price</b></span>
            <input id="priceInput" type="number" min="0" step="0.25" value="${state.pricing.price}">
          </label>

          <div style="display:grid; gap:6px;">
            <div><b>Supply capacity</b></div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <span id="supplyCapLabel">${state.pricing.supplyCapacity}</span>
              <button class="pill" id="btnIncCapacity">
                +${CAPACITY_STEP} (Cost $${CAPACITY_STEP_COST})
              </button>
            </div>
            <small id="pendingCostLine" style="opacity:.85;"></small>
          </div>
        </div>

        <!-- Unit cost info -->
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <div><b>Estimated unit cost (from R&D):</b> $<span id="unitCostLabel">${fmtMoney(estimateUnitCost())}</span></div>
        </div>

        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <button class="pill" id="savePrice">Save</button>
          <button class="pill" id="cancelPrice" type="button">Cancel</button>
          <small>Changes apply only when you press Save.</small>
        </div>
      </div>
    `);

    queueMicrotask(() => {
      renderPricingChart();

      const priceInput = $("priceInput");
      const supplyCapLabel = $("supplyCapLabel");
      const pendingCostLine = $("pendingCostLine");

      function refreshPanel() {
        supplyCapLabel.textContent = String(pendingSupply);

        const upgrades = pendingUpgradesCount();
        const cost = pendingCost();

        if (upgrades > 0) {
          pendingCostLine.textContent = `Pending: +${upgrades * CAPACITY_STEP} supply (Cost $${fmtMoney(cost)})`;
        } else {
          pendingCostLine.textContent = `Pending: none`;
        }
      }

      priceInput.addEventListener("input", () => {
        pendingPrice = Number(priceInput.value);
      });

      $("btnIncCapacity").addEventListener("click", () => {
        // Only preview increase here
        pendingSupply += CAPACITY_STEP;
        refreshPanel();
      });

      $("savePrice").addEventListener("click", () => {
        // Validate affordability on save
        const cost = pendingCost();
        if (cost > state.money) {
          alert(`Not enough money to buy capacity upgrades. Need $${fmtMoney(cost)}.`);
          return;
        }

        // Commit changes
        state.pricing.price = Number(pendingPrice) || state.pricing.price;
        state.pricing.supplyCapacity = pendingSupply;

        // Spend money now (only on save)
        state.money -= cost;

        // Update UI everywhere
        renderTopBar();
        renderMarket();

        closePanel();
      });

      $("cancelPrice").addEventListener("click", () => {
        closePanel();
      });

      refreshPanel();
    });
  });
}
