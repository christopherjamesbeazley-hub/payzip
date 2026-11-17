import { products } from "../../products.mjs";
import * as stripe from "../../lib/stripe.mjs";
import * as mollie from "../../lib/mollie.mjs";

export const config = { path: "/api/checkout" };

const providers = { stripe, mollie };

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

  const providerName = String(p.provider || process.env.DEFAULT_PROVIDER || "mollie").toLowerCase();
  const provider = Object.hasOwn(providers, providerName) ? providers[providerName] : null;
  if (!provider) return fail(400, `Unknown provider "${providerName}"`);

  const quantity = Math.min(99, Math.max(1, parseInt(p.qty, 10) || 1));
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "") ? p.email : undefined;
  const ref = p.ref ? String(p.ref).slice(0, 100) : undefined;

  const base = (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");

  try {
    const { url } = await provider.createCheckout({
      product,
      productId,
      quantity,
      email,
      ref,
      successUrl: product.successUrl || `${base}/thanks.html`,
      cancelUrl: product.cancelUrl || `${base}/cancelled.html`,
      webhookUrl: `${base}/api/webhook/mollie`,
    });
    return new Response(null, { status: 303, headers: { Location: url } });
  } catch (err) {
    console.error(err);
    return fail(502, "Could not start the payment. Please try again.");
  }
};
