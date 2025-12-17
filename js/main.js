const state = {
  turn: 1,
  money: 1000,
  name: "YOUR NAME",
  pricing: { price: 5 },
  rd: { spend: 100 },
};

const $ = (id) => document.getElementById(id);

function render() {
  $("playerName").textContent = state.name;
  $("money").textContent = `$ ${state.money}  |  Turn ${state.turn}`;
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

$("btnPricing").addEventListener("click", () => {
  openPanel("Pricing Decisions", `
    <p>Set your price for next turn.</p>
    <label>Price:
      <input id="priceInput" type="number" min="1" step="1" value="${state.pricing.price}">
    </label>
    <button class="pill" id="savePrice" style="margin-top:12px;">Save</button>
  `);

  queueMicrotask(() => {
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
  state.turn += 1;
  state.money += Math.max(0, (state.pricing.price * 50) - state.rd.spend);
  render();
});

$("btnClose").addEventListener("click", closePanel);
$("overlay").addEventListener("click", (e) => {
  if (e.target === $("overlay")) closePanel();
});

render();
