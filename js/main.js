import { setupPricingUI } from "./pricing.js";
import { setupProductionUI } from "./production.js";
import { setupEndTurn } from "./endTurn.js";
import { renderMarket } from "./market.js";

export const COMPETITION_START_TURN = 5;
export const SECOND_COMPETITOR_TURN = 10;
export const THIRD_COMPETITOR_TURN = 20;

// Shared state (single source of truth)
export const state = {
  turn: 1,
  money: 10000,
  name: "YOUR NAME",
  pricing: {
    price: 5,
    supplyCapacity: 100  // NEW: starts at 100, +100 per upgrade
  },
  production: { budget: 100, comfort: 50, speed: 50 },
  history: { turns: [], price: [], sales: [] },
  buyers: [
  { id: "b1", name: "City Commuters", size: 120, maxPrice: 10, minComfort: 40, minSpeed: 60, focus:"speed",
    features: { accessibility: false, wifi: false, restauration: false } },

  { id: "b2", name: "Regional Operators", size: 80, maxPrice: 7, minComfort: 70, minSpeed: 45, focus:"comfort",
    features: { accessibility: false, wifi: false, restauration: false } },

  { id: "b3", name: "Freight & Heavy", size: 60, maxPrice: 5,  minComfort: 90, minSpeed: 30, focus:"price",
    features: { accessibility: false, wifi: false, restauration: false } },
],
  competitors: [
    { id:"c1", bubbleId:"c1Bubble", name:"Competitor A", price: 6, supplyCapacity: 200, comfort: 75, speed: 75, showFrom: COMPETITION_START_TURN },
    { id:"c2", bubbleId:"c2Bubble", name:"Competitor B", price: 4, supplyCapacity: 100, comfort: 100, speed: 55, showFrom: SECOND_COMPETITOR_TURN },
    { id:"c3", bubbleId:"c3Bubble", name:"Competitor C", price: 10, supplyCapacity: 50, comfort: 120, speed: 100, showFrom: THIRD_COMPETITOR_TURN }
    ],
  lastMarket: null,
};

export const MAX_TURNS = 10;

export const $ = (id) => document.getElementById(id);

export function renderTopBar() {
  const moneyRounded = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(state.money);
  $("playerName").textContent = state.name;
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

  renderTopBar();
  renderMarket();
}

init();
