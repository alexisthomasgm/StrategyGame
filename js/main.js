import { setupPricingUI } from "./pricing.js";
import { setupProductionUI } from "./production.js";
import { setupEndTurn } from "./endTurn.js";
import { renderMarket } from "./market.js";
import { setupNewsUI } from "./news.js";

export const COMPETITION_START_TURN = 5;
export const SECOND_COMPETITOR_TURN = 10;
export const THIRD_COMPETITOR_TURN = 20;

// Shared state (single source of truth)
export const state = {
  turn: 1,
  money: 10000,
  name: "YOUR NAME",
  pricing: { price: 5.8, supplyCapacity: 200 },
  production: { budget: 140, comfort: 65, speed: 70 },
  history: { turns: [], price: [], sales: [] },
buyers: [
  {
    id:"b1",
    name:"Daily Commuters",
    size:250,          // biggest segment
    maxPrice:5.0,      // price sensitive
    minComfort:35,
    minSpeed:45,
    reqFeatures: { accessibility:false, wifi:false, restauration:false }
  },
  {
    id:"b2",
    name:"Intercity High-Speed",
    size:95,
    maxPrice:11.5,     // higher willingness to pay
    minComfort:70,
    minSpeed:85,       // speed is the product
    reqFeatures: { accessibility:false, wifi:false, restauration:false }
  },
  {
    id:"b3",
    name:"Low-Cost Leisure",
    size:120,
    maxPrice:6.5,      // very price sensitive
    minComfort:60,
    minSpeed:45,
    reqFeatures: { accessibility:false, wifi:false, restauration:false }
  }
],
competitors: [
  {
    id:"c1",
    bubbleId:"c1Bubble",
    name:"Trenitalia France",
    price:6.8,
    supplyCapacity:180,
    comfort:78,
    speed:88,
    features:{ accessibility:false, wifi:false, restauration:false },
    showFrom: COMPETITION_START_TURN
  },
  {
    id:"c2",
    bubbleId:"c2Bubble",
    name:"Ouigo",
    price:4.2,
    supplyCapacity:260,
    comfort:55,
    speed:70,
    features:{ accessibility:false, wifi:false, restauration:false },
    showFrom: SECOND_COMPETITOR_TURN
  },
],
    market: {
    revealed: { accessibility:false, wifi:false, restauration:false },
    revealedTurn: { accessibility:null, wifi:null, restauration:null }, // NEW
    spawnedSegments: { accessibility:false, wifi:false, restauration:false },
    pendingReveals: []
    },
    modifiers: { unitCostMultiplier: 1 },
    research: { newsLog: [], seenNewsIds: [] },
    lastMarket: null,
};

export const MAX_TURNS = 10;

export const $ = (id) => document.getElementById(id);

export function renderTopBar() {
  const moneyRounded = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(state.money);
  $("money").textContent = `$ ${moneyRounded} | Turn ${state.turn}`;
}

export function openPanel(title, html) {
  $("panelTitle").textContent = title;
  $("panelBody").innerHTML = html;
  $("overlay").classList.add("open");
  $("overlay").setAttribute("aria-hidden", "false");
}

export function closePanel() {
  $("overlay").classList.remove("open");
  $("overlay").setAttribute("aria-hidden", "true");
}

export function pushHistory(turn, price, sales) {
  state.history.turns.push(turn);
  state.history.price.push(price);
  state.history.sales.push(sales);

  if (state.history.turns.length > MAX_TURNS) {
    state.history.turns.shift();
    state.history.price.shift();
    state.history.sales.shift();
  }
}

function wireGlobalModalClose() {
  $("btnClose").addEventListener("click", closePanel);
  $("overlay").addEventListener("click", (e) => {
    if (e.target === $("overlay")) closePanel();
  });
}

function seedHistory() {
  // avoids empty chart on first open
  pushHistory(0, state.pricing.price, 0);
}

function init() {
  wireGlobalModalClose();
  seedHistory();

  setupPricingUI();
  setupProductionUI();
  setupEndTurn();

  setupNewsUI();

  renderTopBar();
  renderMarket();
}

init();
