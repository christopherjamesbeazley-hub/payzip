import crypto from "node:crypto";

const API = "https://api.stripe.com/v1";

// Stripe wants form-encoded bodies with bracket notation for nesting.
function flatten(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") flatten(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function createCheckout({ product, productId, quantity, email, ref, successUrl, cancelUrl }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  const body = flatten({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: email,
    client_reference_id: ref,
    line_items: {
      0: {
        quantity,
        price_data: {
          currency: product.currency.toLowerCase(),
          unit_amount: product.amount,
          product_data: { name: product.name },
        },
      },
    },
    metadata: { productId, quantity, ref },
  });

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${data?.error?.message || res.status}`);
  return { url: data.url, id: data.id };
}

// Verifies the Stripe-Signature header against the raw request body.
export function verifySignature(rawBody, header, secret, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const exp = Buffer.from(expected);
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

// Turns a Stripe event into the gateway's standard "paid" record, or null
// if the event isn't a completed payment.
export function toPaidEvent(event) {
  const paidTypes = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!paidTypes.includes(event.type)) return null;
  const s = event.data.object;
  if (s.payment_status !== "paid") return null; // e.g. bank transfer still pending
  return {
    provider: "stripe",
    paymentId: s.payment_intent || s.id,
    productId: s.metadata?.productId || null,
    quantity: Number(s.metadata?.quantity || 1),
    amount: s.amount_total,
    currency: (s.currency || "").toUpperCase(),
    email: s.customer_details?.email || s.customer_email || null,
    ref: s.metadata?.ref || s.client_reference_id || null,
    live: Boolean(event.livemode),
  };
}
