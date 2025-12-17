import { state, openPanel, closePanel, $ } from "./main.js";
import { renderMarket } from "./market.js";

/** Feature unlock switches (set true later) */
const UNLOCK_ACCESSIBILITY = true;
const UNLOCK_WIFI = true;
const UNLOCK_RESTAURATION = true;

const FEATURE_COST = 100;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Enforce constraints:
 * - nonnegative
 * - cap <= budget, spd <= budget
 * - cap + spd + featureCost <= budget
 *
 * Rule: if over budget, reduce SPEED first (simple rule),
 * then COMFORT if needed, then disable features if still needed.
 */
function enforceProductionConstraints() {
  const p = state.production;

  p.budget = Math.max(0, p.budget);
  p.comfort = Math.max(0, p.comfort);
  p.speed = Math.max(0, p.speed);

  if (!p.features) {
    p.features = { accessibility: false, wifi: false, restauration: false };
  }

  // Clamp individual spec caps
  if (p.comfort > p.budget) p.comfort = p.budget;
  if (p.speed > p.budget) p.speed = p.budget;

  const featureCost =
    (p.features.accessibility ? FEATURE_COST : 0) +
    (p.features.wifi ? FEATURE_COST : 0) +
    (p.features.restauration ? FEATURE_COST : 0);

  let total = p.comfort + p.speed + featureCost;

  // If over, reduce speed then comfort
  if (total > p.budget) {
    let overflow = total - p.budget;

    const spdCut = Math.min(p.speed, overflow);
    p.speed -= spdCut;
    overflow -= spdCut;

    const capCut = Math.min(p.comfort, overflow);
    p.comfort -= capCut;
    overflow -= capCut;

    // If STILL over (can happen if features push it), disable features last
    if (overflow > 0) {
      // disable in a deterministic order
      if (p.features.restauration) { p.features.restauration = false; overflow -= FEATURE_COST; }
      if (overflow > 0 && p.features.wifi) { p.features.wifi = false; overflow -= FEATURE_COST; }
      if (overflow > 0 && p.features.accessibility) { p.features.accessibility = false; overflow -= FEATURE_COST; }
    }
  }
}

function calcFeatureCostLocal(features) {
  return (features.accessibility ? FEATURE_COST : 0)
    + (features.wifi ? FEATURE_COST : 0)
    + (features.restauration ? FEATURE_COST : 0);
}

export function setupProductionUI() {
  $("btnProduction").addEventListener("click", () => {
    const p = state.production;

    // Ensure features exist
    if (!p.features) {
      p.features = { accessibility: false, wifi: false, restauration: false };
    }

    const showFeatures = UNLOCK_ACCESSIBILITY || UNLOCK_WIFI || UNLOCK_RESTAURATION;

    openPanel("Production Decisions", `
      <div style="display:grid; gap:14px;">
        <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
          <label><b>Production budget (per turn):</b>
            <input id="prodBudget" type="number" min="0" step="10" value="${p.budget}" style="width:120px;">
          </label>
          <div><b>Available:</b> <span id="prodRemaining">0</span></div>
          ${showFeatures ? `<div><b>Features cost:</b> <span id="prodFeatureCost">0</span></div>` : ""}
        </div>

        <div style="display:grid; gap:10px;">
          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <label style="min-width:110px;"><b>Comfort</b></label>
            <input id="capRange" type="range" min="0" value="${p.comfort}">
            <input id="capNum" type="number" min="0" value="${p.comfort}" style="width:110px;">
          </div>

          <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
            <label style="min-width:110px;"><b>Speed</b></label>
            <input id="spdRange" type="range" min="0" value="${p.speed}">
            <input id="spdNum" type="number" min="0" value="${p.speed}" style="width:110px;">
          </div>
        </div>

        ${showFeatures ? `
        <div id="featuresBlock" style="display:grid; gap:8px; padding-top:6px;">
          <div><b>Features</b> <small>(each costs ${FEATURE_COST})</small></div>

          ${UNLOCK_ACCESSIBILITY ? `
            <label style="display:flex; gap:10px; align-items:center;">
              <input type="checkbox" id="featAccessibility" ${p.features.accessibility ? "checked" : ""}>
              Accessibility
            </label>` : ""}

          ${UNLOCK_WIFI ? `
            <label style="display:flex; gap:10px; align-items:center;">
              <input type="checkbox" id="featWifi" ${p.features.wifi ? "checked" : ""}>
              WiFi
            </label>` : ""}

          ${UNLOCK_RESTAURATION ? `
            <label style="display:flex; gap:10px; align-items:center;">
              <input type="checkbox" id="featRestauration" ${p.features.restauration ? "checked" : ""}>
              Restauration
            </label>` : ""}
        </div>
        ` : ""}

        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <button class="pill" id="saveProduction">Save</button>
          <small>Rule: comfort + speed + features ≤ budget.</small>
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
      const featureCostEl = $("prodFeatureCost");

      // Local working copy so "budget increases keep specs" while editing
      let local = {
        budget: Number(budgetEl.value) || 0,
        comfort: p.comfort,
        speed: p.speed,
        features: { ...p.features }
      };

      function syncUI(fromWhere = "") {
        local.budget = Number(budgetEl.value) || 0;

        // Slider max depends on budget (but don't change values just because budget increased)
        capRange.max = String(local.budget);
        spdRange.max = String(local.budget);

        // Read current inputs (when user edits them)
        let cap = clamp(Number(capNum.value) || 0, 0, local.budget);
        let spd = clamp(Number(spdNum.value) || 0, 0, local.budget);

        // Update local values
        local.comfort = cap;
        local.speed = spd;

        // Feature toggles (if present)
        const acc = $("featAccessibility");
        const wifi = $("featWifi");
        const rest = $("featRestauration");
        if (acc) local.features.accessibility = !!acc.checked;
        if (wifi) local.features.wifi = !!wifi.checked;
        if (rest) local.features.restauration = !!rest.checked;

        // Enforce total constraint (cap+spd+features <= budget) WITHOUT resetting on budget increase.
        // Only reduce if overflow happens.
        let fCost = calcFeatureCostLocal(local.features);
        let total = local.comfort + local.speed + fCost;
        if (total > local.budget) {
          let overflow = total - local.budget;

          const spdCut = Math.min(local.speed, overflow);
          local.speed -= spdCut;
          overflow -= spdCut;

          const capCut = Math.min(local.comfort, overflow);
          local.comfort -= capCut;
          overflow -= capCut;

          // If still over, untick features last
          if (overflow > 0) {
            if (local.features.restauration) { local.features.restauration = false; overflow -= FEATURE_COST; }
            if (overflow > 0 && local.features.wifi) { local.features.wifi = false; overflow -= FEATURE_COST; }
            if (overflow > 0 && local.features.accessibility) { local.features.accessibility = false; overflow -= FEATURE_COST; }
          }
        }

        // Push corrected values back into inputs
        capNum.value = String(local.comfort);
        spdNum.value = String(local.speed);
        capRange.value = String(local.comfort);
        spdRange.value = String(local.speed);

        // Push corrected feature toggles back into UI (if they got disabled due to overflow)
        const acc2 = $("featAccessibility");
        const wifi2 = $("featWifi");
        const rest2 = $("featRestauration");
        if (acc2) acc2.checked = local.features.accessibility;
        if (wifi2) wifi2.checked = local.features.wifi;
        if (rest2) rest2.checked = local.features.restauration;

        // Update remaining
        fCost = calcFeatureCostLocal(local.features);
        if (featureCostEl) featureCostEl.textContent = String(fCost);

        remainingEl.textContent = String(local.budget - (local.comfort + local.speed + fCost));

        // Live preview: update state so qualify checks update immediately
        state.production.budget = local.budget;
        state.production.comfort = local.comfort;
        state.production.speed = local.speed;
        state.production.features = { ...local.features };

        renderMarket();
      }

      // When budget changes, DO NOT overwrite cap/spd with range defaults.
      // Just recompute max and remaining.
      budgetEl.addEventListener("input", () => {
        // keep local.comfort/local.speed as-is unless now invalid
        capNum.value = String(local.comfort);
        spdNum.value = String(local.speed);
        syncUI("budget");
      });

      capRange.addEventListener("input", () => { capNum.value = capRange.value; syncUI("capRange"); });
      spdRange.addEventListener("input", () => { spdNum.value = spdRange.value; syncUI("spdRange"); });
      capNum.addEventListener("input", () => syncUI("capNum"));
      spdNum.addEventListener("input", () => syncUI("spdNum"));

      // Feature toggles
      const acc = $("featAccessibility");
      const wifi = $("featWifi");
      const rest = $("featRestauration");
      if (acc) acc.addEventListener("change", () => syncUI("acc"));
      if (wifi) wifi.addEventListener("change", () => syncUI("wifi"));
      if (rest) rest.addEventListener("change", () => syncUI("rest"));

      $("saveProduction").addEventListener("click", () => {
        state.production.budget = local.budget;
        state.production.comfort = local.comfort;
        state.production.speed = local.speed;
        state.production.features = { ...local.features };

        enforceProductionConstraints();
        renderMarket();
        closePanel();
      });

      // Initialize UI
      capNum.value = String(local.comfort);
      spdNum.value = String(local.speed);
      syncUI("init");
    });
  });
}
