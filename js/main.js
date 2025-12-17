import { setupPricingUI } from "./pricing.js";
import { setupProductionUI } from "./production.js";
import { setupEndTurn } from "./endTurn.js";
import { renderMarket } from "./market.js";

export const COMPETITION_START_TURN = 5;
export const SECOND_COMPETITOR_TURN = 10;

// Shared state (single source of truth)
export const state = {
  turn: 1,
  money: 1000,
  name: "YOUR NAME",
  pricing: { price: 5 },
  production: { budget: 100, capacity: 50, speed: 50 },
  history: { turns: [], price: [], sales: [] },
  buyers: [
    { id: "b1", name: "City Commuters", size: 120, minCapacity: 40, minSpeed: 60 },
    { id: "b2", name: "Regional Operators", size: 80,  minCapacity: 70, minSpeed: 45 },
    { id: "b3", name: "Freight & Heavy",   size: 60,  minCapacity: 90, minSpeed: 30 },
    ],
  competitors: [
    { id: "c1", bubbleId: "c1Bubble", name: "Competitor A", capacity: 75, speed: 75, showFrom: COMPETITION_START_TURN },
    { id: "c2", bubbleId: "c2Bubble", name: "Competitor B", capacity: 100, speed: 55, showFrom: SECOND_COMPETITOR_TURN }
    ],
  lastMarket: null,
};

export const MAX_TURNS = 10;

export const $ = (id) => document.getElementById(id);

export function renderTopBar() {
  $("playerName").textContent = state.name;
  $("money").textContent = `$ ${state.money}  |  Turn ${state.turn}`;
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
