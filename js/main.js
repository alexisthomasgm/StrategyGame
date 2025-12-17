const state = {
  turn: 1,
  money: 1000,
  name: "YOUR NAME",

  pricing: { price: 5 },
  production: {
    budget: 100,   // production budget per turn
    capacity: 50,  // allocation
    speed: 50      // allocation
    },

  // Track last 10 turns
  history: {
    turns: [],   // [1,2,3,...]
    price: [],   // [5,6,4,...]
    sales: [],   // [120,90,140,...]
  }
};

const MAX_TURNS = 10;

const $ = (id) => document.getElementById(id);

function render() {
  $("playerName").textContent = state.name;
  $("money").textContent = `$ ${state.money}  |  Turn ${state.turn}`;
}

function pushHistory(turn, price, sales) {
  state.history.turns.push(turn);
  state.history.price.push(price);
  state.history.sales.push(sales);

  // keep only last 10
  if (state.history.turns.length > MAX_TURNS) {
    state.history.turns.shift();
    state.history.price.shift();
    state.history.sales.shift();
  }
}

function openPanel(title, html) {
  $("panelTitle").textContent = title;
  $("panelBody").innerHTML = html;
  $("overlay").classList.add("open");
  $("overlay").setAttribute("aria-hidden", "false");
}

function closePanel() {
  $("overlay").classList.remove("open");
  $("overlay").setAttribute("aria-hidden", "true");
}

function estimateSales(price, rdSpend) {
  // Placeholder demand model (swap later)
  // Higher price -> lower sales; more R&D -> slightly higher sales
  const base = 160;
  const priceEffect = Math.max(0, 1.4 - price * 0.12);      // drops with price
  const rdEffect = 1 + Math.min(0.25, rdSpend / 1000);       // gentle boost
  const noise = (Math.random() * 14) - 7;                    // +/- 7

  return Math.max(0, Math.round(base * priceEffect * rdEffect + noise));
}

function renderPricingChart() {
  if (typeof Chart === "undefined") {
    $("chartWrap").innerHTML = `<p><b>Chart.js not loaded.</b> Check the CDN script tag in index.html.</p>`;
    return;
  }

  const ctx = $("pricingChart").getContext("2d");

  // Destroy old chart if the user reopens the panel
  if (window.pricingChartInstance) {
    window.pricingChartInstance.destroy();
  }

  window.pricingChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: state.history.turns.map(t => `T${t}`),
      datasets: [
        {
          label: "Sales",
          data: state.history.sales,
          tension: 0.25
        },
        {
          label: "Price",
          data: state.history.price,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

$("btnPricing").addEventListener("click", () => {
  openPanel("Pricing Decisions", `
    <div style="display:grid; gap:12px;">
      <div id="chartWrap" style="height:260px;">
        <canvas id="pricingChart"></canvas>
      </div>

      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <label>Price:
          <input id="priceInput" type="number" min="1" step="1" value="${state.pricing.price}">
        </label>
        <button class="pill" id="savePrice">Save</button>
      </div>

      <small>Showing last ${MAX_TURNS} turns.</small>
    </div>
  `);

  // Render chart AFTER DOM exists
  queueMicrotask(() => {
    renderPricingChart();

    $("savePrice").addEventListener("click", () => {
      state.pricing.price = Number($("priceInput").value);
      closePanel();
    });
  });
});

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
        <small>Rule: capacity + speed must be ≤ production budget.</small>
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

      // Set slider max to budget
      capRange.max = String(b);
      spdRange.max = String(b);

      // Read current allocations
      let cap = Number(capNum.value) || 0;
      let spd = Number(spdNum.value) || 0;

      // Clamp to [0..budget]
      cap = clamp(cap, 0, b);
      spd = clamp(spd, 0, b);

      // Enforce cap+spd <= budget by reducing speed
      const sum = cap + spd;
      if (sum > b) {
        spd = Math.max(0, spd - (sum - b));
      }

      // Write back to both range + number inputs
      capNum.value = String(cap);
      spdNum.value = String(spd);
      capRange.value = String(cap);
      spdRange.value = String(spd);

      remainingEl.textContent = String(b - (cap + spd));
    }

    // Wire events (any change re-syncs)
    budgetEl.addEventListener("input", syncUI);

    capRange.addEventListener("input", () => { capNum.value = capRange.value; syncUI(); });
    spdRange.addEventListener("input", () => { spdNum.value = spdRange.value; syncUI(); });

    capNum.addEventListener("input", syncUI);
    spdNum.addEventListener("input", syncUI);

    $("saveProduction").addEventListener("click", () => {
      state.production.budget = Math.max(0, Number(budgetEl.value) || 0);
      state.production.capacity = Math.max(0, Number(capNum.value) || 0);
      state.production.speed = Math.max(0, Number(spdNum.value) || 0);

      enforceProductionConstraints();
      closePanel();
    });

    syncUI();
  });
});

$("btnNext").addEventListener("click", () => {
  // Resolve a turn (placeholder logic)
  state.money -= state.production.budget;

  // Existing placeholder turn resolution
  const sales = estimateSales(state.pricing.price, /* rdSpend */ 0);
  const revenue = sales * state.pricing.price;

  state.money += Math.max(0, revenue - state.rd.spend);
  pushHistory(state.turn, state.pricing.price, sales);

  state.turn += 1;
  render();
});

$("btnClose").addEventListener("click", closePanel);
$("overlay").addEventListener("click", (e) => {
  if (e.target === $("overlay")) closePanel();
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function enforceProductionConstraints() {
  // Ensure allocations are non-negative
  state.production.capacity = Math.max(0, state.production.capacity);
  state.production.speed = Math.max(0, state.production.speed);

  // Ensure allocations do not exceed budget
  const b = state.production.budget;
  if (state.production.capacity > b) state.production.capacity = b;
  if (state.production.speed > b) state.production.speed = b;

  // Ensure capacity + speed <= budget
  const sum = state.production.capacity + state.production.speed;
  if (sum > b) {
    // Reduce speed first (arbitrary; pick a rule and stick to it)
    const overflow = sum - b;
    state.production.speed = Math.max(0, state.production.speed - overflow);
  }
}

// Seed history so chart isn't empty on first open
pushHistory(0, state.pricing.price, 0);

render();
