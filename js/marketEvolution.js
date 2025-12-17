import { state } from "./main.js";

export function revealFeatureDemand(featureKey) {
  if (state.market.revealed[featureKey]) return; // only once
  state.market.revealed[featureKey] = true;
  state.market.revealedTurn[featureKey] = state.turn;
  // ✅ Decide which buyer segments start requiring the feature
  // You can tweak these mappings freely.
  const REQUIRE_MAP = {
    accessibility: ["b1", "b2"],      // 2 of 3 start requiring it
    wifi:          ["b1"],            // example
    restauration:  ["b2"]             // example
  };

  const ids = REQUIRE_MAP[featureKey] || [];
  for (const b of state.buyers) {
    if (ids.includes(b.id)) b.reqFeatures[featureKey] = true;
  }

  // ✅ Optional: spawn a new segment the first time the feature is introduced
  // (Example: accessibility creates a public procurement segment)
  if (!state.market.spawnedSegments[featureKey]) {
    state.market.spawnedSegments[featureKey] = true;

    if (featureKey === "accessibility") {
      state.buyers.push({
        id: "b4",
        name: "Public Authorities",
        size: 50,
        maxPrice: 9,
        minComfort: 60,
        minSpeed: 50,
        reqFeatures: { accessibility: true, wifi: false, restauration: false }
      });
    }
  }
}
