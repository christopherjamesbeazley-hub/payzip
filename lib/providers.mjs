import * as stripe from "./stripe.mjs";
import * as mollie from "./mollie.mjs";
import * as tikkie from "./tikkie.mjs";

export const providers = { stripe, mollie, tikkie };

// Which providers can actually take a payment for this product right now.
// Stripe and Mollie need their key set in Netlify; Tikkie needs a tikkieUrl
// on the product. A product can also limit itself with `providers: [...]`.
export function availableProviders(product, env = process.env) {
  const on = [];
  if (env.STRIPE_SECRET_KEY) on.push("stripe");
  if (env.MOLLIE_API_KEY) on.push("mollie");
  if (tikkie.isAvailableFor(product)) on.push("tikkie");
  return Array.isArray(product?.providers) ? on.filter((p) => product.providers.includes(p)) : on;
}

export function defaultProvider(product, env = process.env) {
  const on = availableProviders(product, env);
  const wanted = String(env.DEFAULT_PROVIDER || "stripe").toLowerCase();
  return on.includes(wanted) ? wanted : on[0] || null;
}
