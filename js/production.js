import { state, openPanel, closePanel, $ } from "./main.js";
import { renderMarket } from "./market.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function enforceProductionConstraints() {
  const p = state.production;

  p.budget = Math.max(0, p.budget);
  p.capacity = Math.max(0, p.capacity);
  p.speed = Math.max(0, p.speed);

  if (p.capacity > p.budget) p.capacity = p.budget;
  if (p.speed > p.budget) p.speed = p.budget;

  const sum = p.capacity + p.speed;
  if (sum > p.budget) {
    const overflow = sum - p.budget;
    p.speed = Math.max(0, p.speed - overflow); // simple rule
  }
}

export function setupProductionUI() {
  $("btnProduction").addEventListener("click", () => {
    const p = state.production;

    openPanel("Production Decisions", `
      <div style="display:grid; gap:14px;">
        <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
          <label><b>Production budget (per turn):</b>
            <input id="prodBudget" type="number" min="0" step="10" value="${p.budget}" style="width:120px;">
          </label>
          <div><b>Available:</b> <span id="prodRemaining">0</span></div>
        </div>

        <div style="display:grid; gap:10px;">
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <label style="min-width:110px;"><b>Capacity</b></label>
            <input id="capRange" type="range" min="0" value="${p.capacity}">
            <input id="capNum" type="number" min="0" value="${p.capacity}" style="width:110px;">
          </div>

          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <label style="min-width:110px;"><b>Speed</b></label>
            <input id="spdRange" type="range" min="0" value="${p.speed}">
            <input id="spdNum" type="number" min="0" value="${p.speed}" style="width:110px;">
          </div>
        </div>

        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <button class="pill" id="saveProduction">Save</button>
          <small>Rule: capacity + speed ≤ budget.</small>
        </div>
      </div>
    `);

    queueMicrotask(() => {
      const budgetEl = $("prodBudget");
      const capRange = $("capRange");
      const spdRange = $("spdRange");
      const capNum = $("capNum");
      const spdNum = $("spdNum");
      const remainingEl = $("prodRemaining");

      function syncUI() {
        const b = Number(budgetEl.value) || 0;

        capRange.max = String(b);
        spdRange.max = String(b);

        let cap = clamp(Number(capNum.value) || 0, 0, b);
        let spd = clamp(Number(spdNum.value) || 0, 0, b);

        const sum = cap + spd;
        if (sum > b) spd = Math.max(0, spd - (sum - b));

        capNum.value = String(cap);
        spdNum.value = String(spd);
        capRange.value = String(cap);
        spdRange.value = String(spd);

        remainingEl.textContent = String(b - (cap + spd));
      }

      budgetEl.addEventListener("input", syncUI);
      capRange.addEventListener("input", () => { capNum.value = capRange.value; syncUI(); });
      spdRange.addEventListener("input", () => { spdNum.value = spdRange.value; syncUI(); });
      capNum.addEventListener("input", syncUI);
      spdNum.addEventListener("input", syncUI);

      $("saveProduction").addEventListener("click", () => {
        state.production.budget = Number(budgetEl.value) || 0;
        state.production.capacity = Number(capNum.value) || 0;
        state.production.speed = Number(spdNum.value) || 0;

        enforceProductionConstraints();
        renderMarket();
        closePanel();
      });

      syncUI();
    });
  });
}
