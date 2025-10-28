// src/tax.js
const { TaxAPI } = require('../apis/tax-api');

/** Convert TaxAPI outputs to a decimal fraction.
 * Supports: 0.08, 8, "8%", 800 (bps) → 0.08
 */
function normalizeRate(rate) {
  if (rate == null) return 0;

  if (typeof rate === 'string') {
    const trimmed = rate.trim();
    if (trimmed.endsWith('%')) {
      const n = parseFloat(trimmed.slice(0, -1));
      return isNaN(n) ? 0 : n / 100;
    }
    const n = parseFloat(trimmed);
    if (isNaN(n)) return 0;
    rate = n;
  }

  // numeric now
  if (rate <= 1) return rate;        // e.g., 0.08
  if (rate <= 100) return rate / 100; // e.g., 8  -> 0.08
  return rate / 10000;               // e.g., 800 (bps) -> 0.08
}

/**
 * Calculate tax for an order
 * @param {Object} order - The order object with items array
 * @param {Object} delivery - Delivery information (currently unused)
 * @returns {number} - Tax amount in cents
 */
function tax(order, delivery) {
  if (!order || !Array.isArray(order.items)) return 0;

  const hotRate = normalizeRate(TaxAPI.lookup('hot'));
  let totalTax = 0;

  for (const item of order.items) {
    const itemTotal = (item.unitPriceCents || 0) * (item.qty || 0);

    // Only hot items are taxable per current spec
    if (item.kind === 'hot' && itemTotal > 0) {
      totalTax += Math.floor(itemTotal * hotRate);
    }
  }

  return totalTax;
}

module.exports = { tax };
