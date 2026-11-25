// Tikkie Business, without the Tikkie API.
//
// Each product can carry a `tikkieUrl`: a payment link you create once in
// the Tikkie Business portal for that product's exact amount. The gateway
// sends the buyer there and records the order as "awaiting_confirmation".
//
// Tikkie does not tell the gateway when the money arrives (that needs the
// Tikkie API, which needs an ABN AMRO business contract). So you confirm
// these orders yourself: check the Tikkie Business app, then deliver.
//
// When API access becomes available, this file is the only one that
// changes: createCheckout() would create a payment request per order and a
// webhook would confirm it, exactly like stripe.mjs.

const ALLOWED_HOSTS = new Set(["tikkie.me", "www.tikkie.me"]);

export function isValidTikkieUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export function isAvailableFor(product) {
  return isValidTikkieUrl(product?.tikkieUrl);
}

export async function createCheckout({ product, productId, quantity, email, ref }) {
  if (!isAvailableFor(product)) {
    throw new Error(`Product "${productId}" has no valid tikkieUrl`);
  }
  if (quantity !== 1) {
    // A Tikkie link has one fixed amount, so it can only sell one item.
    throw new Error("Tikkie links sell one item at a time (qty must be 1)");
  }
  return {
    url: product.tikkieUrl,
    id: null,
    pending: {
      provider: "tikkie",
      status: "awaiting_confirmation",
      paymentId: null,
      productId,
      quantity: 1,
      amount: product.amount,
      currency: product.currency.toUpperCase(),
      email: email || null,
      ref: ref || null,
      live: true,
    },
  };
}
