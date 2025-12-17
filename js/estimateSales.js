/**
 * Market allocation model (requirements gating + equal split)
 *
 * buyers: [{ id, name, size, minCapacity, minSpeed }, ...]
 * offers: [{ id, name, capacity, speed }, ...]  // includes "player" + competitors
 *
 * Returns:
 * {
 *   totalSalesByFirm: { [firmId]: number },
 *   playerSales: number,
 *   allocations: [
 *     { buyerId, qualifyingFirmIds: string[], split: number, allocated: { [firmId]: number } }
 *   ]
 * }
 */
export function estimateSales({ buyers, offers, playerId = "player" }) {
  const totalSalesByFirm = {};
  const allocations = [];

  for (const offer of offers) totalSalesByFirm[offer.id] = 0;

  for (const buyer of buyers) {
    const qualifying = offers.filter(o =>
      o.capacity >= buyer.minCapacity && o.speed >= buyer.minSpeed
    );

    if (qualifying.length === 0) {
      allocations.push({
        buyerId: buyer.id,
        qualifyingFirmIds: [],
        split: 0,
        allocated: {}
      });
      continue;
    }

    const split = buyer.size / qualifying.length;
    const allocated = {};

    for (const firm of qualifying) {
      totalSalesByFirm[firm.id] += split;
      allocated[firm.id] = split;
    }

    allocations.push({
      buyerId: buyer.id,
      qualifyingFirmIds: qualifying.map(q => q.id),
      split,
      allocated
    });
  }

  return {
    totalSalesByFirm,
    playerSales: totalSalesByFirm[playerId] ?? 0,
    allocations
  };
}
