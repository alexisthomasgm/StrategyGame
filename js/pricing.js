import { state, openPanel, closePanel, $ } from "./main.js";

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

        <small>Shows last 10 turns.</small>
      </div>
    `);

    queueMicrotask(() => {
      renderPricingChart();
      $("savePrice").addEventListener("click", () => {
        state.pricing.price = Number($("priceInput").value);
        closePanel();
      });
    });
  });
}
