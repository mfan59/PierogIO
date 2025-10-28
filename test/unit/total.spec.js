// tests/order.calculations.test.js

const { total } = require('../../src/total');
const { subtotal } = require('../../src/subtotal');
const { discounts } = require('../../src/discounts');
const { deliveryFee } = require('../../src/delivery');
const { tax } = require('../../src/tax');

/**
 * Helpers
 * All prices are in integer cents.
 */
const makeItem = (overrides = {}) => ({
  sku: 'TEST',
  title: 'Item',
  kind: 'hot',
  filling: 'potato',
  qty: 1,
  unitPriceCents: 100,
  addOns: [],
  ...overrides,
});

const makeOrder = (items = []) => ({ items });

const guestProfile = { tier: 'guest' };
const localDelivery = { zone: 'local', rush: false };

describe('Order Calculations', () => {
  describe('subtotal', () => {
    it('calculates add-ons per pack correctly', () => {
      const order = makeOrder([
        makeItem({
          sku: 'P2-TEST',
          title: 'Test Pack',
          kind: 'hot',
          filling: 'potato',
          qty: 2,
          unitPriceCents: 699,
          addOns: ['sour-cream', 'fried-onion'],
        }),
      ]);

      // base = 699 * 2 = 1398
      // sour-cream = 99 * 2 = 198
      // fried-onion = 149 * 2 = 298
      // subtotal = 1398 + 198 + 298 = 1894
      expect(subtotal(order)).toBe(1894);
    });
  });

  describe('discounts', () => {
    it('applies 12-pack volume discount for guest tier (5%)', () => {
      const order = makeOrder([
        makeItem({
          sku: 'P12-TEST',
          title: '12-pack',
          kind: 'frozen',
          filling: 'cheese',
          qty: 12,
          unitPriceCents: 500,
          addOns: [],
        }),
      ]);

      // item subtotal = 500 * 12 = 6000
      // 5% of 6000 = 300
      expect(discounts(order, guestProfile)).toBe(300);
    });

    it('applies PIEROGI-BOGO (second 6-pack 50% off)', () => {
      const order = makeOrder([
        makeItem({
          sku: 'P6-A',
          title: '6-pack A',
          kind: 'hot',
          filling: 'potato',
          qty: 6,
          unitPriceCents: 700,
          addOns: [],
        }),
        makeItem({
          sku: 'P6-B',
          title: '6-pack B',
          kind: 'hot',
          filling: 'potato',
          qty: 6,
          unitPriceCents: 700,
          addOns: [],
        }),
      ]);

      // discount = 50% of second pack: floor(700 * 6 * 0.5) = 2100
      expect(discounts(order, guestProfile, 'PIEROGI-BOGO')).toBe(2100);
    });

    it('applies FIRST10 coupon as 10% off order subtotal (intended behavior)', () => {
      const order = makeOrder([
        makeItem({ unitPriceCents: 1250, qty: 2 }), // subtotal = 2500
      ]);

      // intended discount = floor(2500 * 0.10) = 250
      // NOTE: current implementation reportedly returns a negative number (bug); test asserts intended behavior.
      expect(discounts(order, guestProfile, 'FIRST10')).toBe(250);
    });
  });

  describe('deliveryFee', () => {
    it('returns 0 when discounted subtotal is above free-delivery threshold for tier', () => {
      const order = makeOrder([makeItem({ unitPriceCents: 5100, qty: 1 })]);
      const delivery = { zone: 'local', rush: false };

      // discountedSubtotal = 5100 > guest threshold 5000 => free delivery
      expect(deliveryFee(order, delivery, guestProfile)).toBe(0);
    });

    it('charges only rush fee when free delivery but rush is true', () => {
      const order = makeOrder([makeItem({ unitPriceCents: 5100, qty: 1 })]);
      const delivery = { zone: 'local', rush: true };

      // rush fee when delivery is otherwise free should be 299
      expect(deliveryFee(order, delivery, guestProfile)).toBe(299);
    });

    describe('per-item base delivery fees by zone', () => {
      const order = makeOrder([
        makeItem({ unitPriceCents: 100, qty: 1 }),
        makeItem({ unitPriceCents: 200, qty: 1 }),
      ]);

      test.each([
        ['local', 399, 2, 399 * 2],
        ['outer', 699, 2, 699 * 2],
      ])(
        'charges %i per item for %s zone (2 items)',
        (zone, perItemFee, itemCount, expected) => {
          const delivery = { zone, rush: false };
          expect(deliveryFee(order, delivery, guestProfile)).toBe(expected);
        }
      );
    });
  });

  describe('tax', () => {
    it('charges tax on hot items (8%) and not on frozen', () => {
      const order = makeOrder([
        makeItem({ unitPriceCents: 1000, qty: 1, kind: 'hot' }), // tax 80
        makeItem({ unitPriceCents: 2000, qty: 1, kind: 'frozen' }), // tax 0
      ]);

      // intended total tax = floor(1000 * 0.08) = 80
      expect(tax(order, localDelivery)).toBe(80);
    });
  });

  describe('total', () => {
    it('calculates a complete order total for a single hot item (manual calc)', () => {
      const order = makeOrder([
        makeItem({
          sku: 'P6-POTATO',
          title: '6-pack Potato',
          kind: 'hot',
          filling: 'potato',
          qty: 6,
          unitPriceCents: 699,
          addOns: [],
        }),
      ]);

      const context = {
        profile: guestProfile,
        delivery: { zone: 'local', rush: false },
        coupon: null,
      };

      // Manual:
      // subtotal = 699 * 6 = 4194
      // discounts = 0
      // delivery = 399 (per-item logic for one item group)
      // tax = floor(4194 * 0.08) = 335
      // total = 4194 - 0 + 399 + 335 = 4928
      expect(total(order, context)).toBe(4928);
    });

    it('returns integer cents and > 0 for a sample order (sanity)', () => {
      const order = makeOrder([
        makeItem({
          sku: 'P6-POTATO',
          title: '6-pack Potato',
          kind: 'hot',
          filling: 'potato',
          qty: 6,
          unitPriceCents: 699,
          addOns: [],
        }),
      ]);

      const context = {
        profile: guestProfile,
        delivery: { zone: 'local', rush: false },
      };

      const orderTotal = total(order, context);
      expect(orderTotal).toBeGreaterThan(0);
      expect(Number.isInteger(orderTotal)).toBe(true);
    });
  });
});
