const state = {
  turn: 1,
  money: 1000,
  name: "YOUR NAME",

  pricing: { price: 5 },
  rd: { spend: 100 },

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

$("btnRD").addEventListener("click", () => {
  openPanel("R&D Decisions", `
    <p>Choose how much to spend on R&amp;D.</p>
    <label>R&amp;D Spend:
      <input id="rdInput" type="number" min="0" step="10" value="${state.rd.spend}">
    </label>
    <button class="pill" id="saveRD" style="margin-top:12px;">Save</button>
  `);

  queueMicrotask(() => {
    $("saveRD").addEventListener("click", () => {
      state.rd.spend = Number($("rdInput").value);
      closePanel();
    });
  });
});

$("btnNext").addEventListener("click", () => {
  // Resolve a turn (placeholder logic)
  const sales = estimateSales(state.pricing.price, state.rd.spend);
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

// Seed history so chart isn't empty on first open
pushHistory(0, state.pricing.price, 0);

render();
