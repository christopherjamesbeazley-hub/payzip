import { products } from "../../products.mjs";
import { providers, availableProviders, defaultProvider } from "../../lib/providers.mjs";
import { notifyPending } from "../../lib/fulfil.mjs";

export const config = { path: "/api/checkout" };

const fail = (status, message) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function readParams(req) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  if (req.method === "POST") {
    const type = req.headers.get("content-type") || "";
    if (type.includes("application/json")) Object.assign(params, await req.json().catch(() => ({})));
    else if (type.includes("form")) Object.assign(params, Object.fromEntries(await req.formData()));
  }
  return params;
}

export default async (req) => {
  if (!["GET", "POST"].includes(req.method)) return fail(405, "Use GET or POST");

  const p = await readParams(req);
  const productId = String(p.product || "");
  const product = Object.hasOwn(products, productId) ? products[productId] : null;
  if (!product) return fail(400, `Unknown product "${productId}"`);

  const providerName = p.provider ? String(p.provider).toLowerCase() : defaultProvider(product);
  if (!providerName || !Object.hasOwn(providers, providerName)) {
    return fail(400, `Unknown provider "${p.provider || ""}"`);
  }
  if (!availableProviders(product).includes(providerName)) {
    return fail(400, `"${providerName}" is not set up for this product`);
  }
  const provider = providers[providerName];

  const quantity = Math.min(99, Math.max(1, parseInt(p.qty, 10) || 1));
  if (providerName === "tikkie" && quantity !== 1) {
    return fail(400, "Tikkie links sell one item at a time");
  }
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "") ? p.email : undefined;
  const ref = p.ref ? String(p.ref).slice(0, 100) : undefined;

  const base = (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");

  try {
    const result = await provider.createCheckout({
      product,
      productId,
      quantity,
      email,
      ref,
      successUrl: product.successUrl || `${base}/thanks.html`,
      cancelUrl: product.cancelUrl || `${base}/cancelled.html`,
      webhookUrl: `${base}/api/webhook/mollie`,
    });
    if (result.pending) await notifyPending(result.pending);
    return new Response(null, { status: 303, headers: { Location: result.url } });
  } catch (err) {
    console.error(err);
    return fail(502, "Could not start the payment. Please try again.");
  }
};
