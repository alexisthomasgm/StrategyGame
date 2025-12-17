import { state, $, openPanel } from "./main.js";

/**
 * Hard-coded PESTEL / news events.
 * Each event:
 * - shows a newspaper popup
 * - applies an effect to state (optional)
 * - is archived in Research
 */
const NEWS_EVENTS = [
  {
    id: "turn5_competitor_enters",
    turn: 5,
    headline: "A NEW COMPETITOR ENTERS THE MARKET",
    body: "A well-funded challenger announces aggressive expansion plans. Expect tougher competition for contracts.",
    apply: (s) => {
      // This is already how your competitors “appear” (showFrom=5).
      // If you want a *brand new* competitor, you can push a new one here.
      // Example (optional):
      // s.competitors.push({
      //   id:"c3", bubbleId:"c3Bubble", name:"Competitor C", price:5, supplyCapacity:150, comfort:65, speed:80,
      //   features:{ accessibility:false, wifi:false, restauration:false }, showFrom: 5
      // });
    }
  },
  {
    id: "turn7_tech_breakthrough",
    turn: 7,
    headline: "A NEW TECHNOLOGY IS DISCOVERED",
    body: "A manufacturing breakthrough reduces production waste. Efficient operators will see costs fall.",
    apply: (s) => {
      // Global modifier used by unit cost function
      s.modifiers.unitCostMultiplier *= 0.9; // 10% cheaper unit cost
    }
  },
  {
    id: "turn9_regulations_loosen",
    turn: 9,
    headline: "MARKET REGULATIONS LOOSEN ON AIRPLANES",
    body: "Regulators relax constraints, enabling faster certification and broader adoption across segments.",
    apply: (s) => {
      // Example impact: increase market size +20% across all buyers
      for (const b of s.buyers) {
        b.size = Math.round(b.size * 1.2);
      }
    }
  },

  // Example “bad news” event (keep or delete)
  {
    id: "turn6_recession_hit",
    turn: 6,
    headline: "ECONOMIC SHOCK HITS DEMAND",
    body: "A sudden downturn causes buyers to cut spending. Total market demand drops sharply.",
    apply: (s) => {
      for (const b of s.buyers) {
        b.size = Math.max(0, Math.round(b.size * 0.8)); // -20%
      }
    }
  }
];

let queue = [];
let showing = false;

function ensureResearchState() {
  if (!state.research) state.research = {};
  if (!Array.isArray(state.research.newsLog)) state.research.newsLog = [];
  if (!Array.isArray(state.research.seenNewsIds)) state.research.seenNewsIds = [];
  if (!state.modifiers) state.modifiers = {};
  if (typeof state.modifiers.unitCostMultiplier !== "number") state.modifiers.unitCostMultiplier = 1;
}

function markSeen(id) {
  if (!state.research.seenNewsIds.includes(id)) state.research.seenNewsIds.push(id);
}

function isSeen(id) {
  return state.research.seenNewsIds.includes(id);
}

function archiveEvent(ev) {
  state.research.newsLog.push({
    id: ev.id,
    turn: ev.turn,
    headline: ev.headline,
    body: ev.body
  });
}

function showNextFromQueue() {
  if (showing) return;
  const next = queue.shift();
  if (!next) return;

  showing = true;

  $("newsHeadline").textContent = next.headline;
  $("newsSubhead").textContent = `Turn ${next.turn}`;
  $("newsBody").textContent = next.body;

  $("newsOverlay").classList.add("open");
  $("newsOverlay").setAttribute("aria-hidden", "false");
}

function hideNews() {
  $("newsOverlay").classList.remove("open");
  $("newsOverlay").setAttribute("aria-hidden", "true");
  showing = false;

  // If multiple events triggered same turn, keep rolling.
  showNextFromQueue();
}

export function setupNewsUI() {
  ensureResearchState();

  // Click ANYWHERE to dismiss (overlay OR card)
  $("newsOverlay").addEventListener("click", hideNews);
  $("newsCard").addEventListener("click", hideNews);

  // Research tab
  $("btnResearch").addEventListener("click", () => {
    ensureResearchState();

    const log = [...state.research.newsLog].reverse();
    const html = `
      <div class="research-wrap">
        <div class="research-title">Research Archive</div>
        <div class="research-sub">News & market events recorded so far.</div>
        <div class="research-list">
          ${
            log.length
              ? log.map(item => `
                <div class="research-item">
                  <div class="research-item-head">
                    <span class="research-turn">Turn ${item.turn}</span>
                    <span class="research-headline">${item.headline}</span>
                  </div>
                  <div class="research-body">${item.body}</div>
                </div>
              `).join("")
              : `<div class="research-empty">No reports yet. Markets are boring… for now.</div>`
          }
        </div>
      </div>
    `;
    openPanel("RESEARCH", html);
  });
}

/**
 * Call this after a Next Turn resolves (when you know which turn you’re now in).
 */
export function triggerNewsForTurn(turn) {
  ensureResearchState();

  const todays = NEWS_EVENTS.filter(e => e.turn === turn && !isSeen(e.id));
  if (!todays.length) return;

  for (const ev of todays) {
    // Apply effect first (state changes), then archive, then show
    if (typeof ev.apply === "function") ev.apply(state);
    archiveEvent(ev);
    markSeen(ev.id);
    queue.push(ev);
  }

  showNextFromQueue();
}
