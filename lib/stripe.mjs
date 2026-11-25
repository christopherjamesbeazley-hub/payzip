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

// Stripe replaces {CHECKOUT_SESSION_ID} with the real id when it sends the
// buyer back, so the thank-you page can look the payment up.
export function withSessionId(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}session_id={CHECKOUT_SESSION_ID}`;
}

export async function createCheckout({ product, productId, quantity, email, ref, successUrl, cancelUrl, returnTo }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");

  const body = flatten({
    mode: "payment",
    success_url: withSessionId(successUrl),
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
    metadata: { productId, quantity, ref, returnTo },
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

// Looks up a Checkout Session for the thank-you page and returns only what
// that page shows. Asks for the receipt link too; a restricted key without
// "PaymentIntents: Read" and "Charges: Read" can't expand that, so we retry
// without it and simply show no receipt link.
export async function getSessionSummary(id) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id || "")) return null;

  const url = `${API}/checkout/sessions/${id}`;
  const headers = { Authorization: `Bearer ${key}` };
  let res = await fetch(`${url}?expand[]=payment_intent.latest_charge`, { headers });
  if (res.status === 403 || res.status === 401) res = await fetch(url, { headers });
  if (res.status === 404) return null;
  const s = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${s?.error?.message || res.status}`);

  const charge = s.payment_intent?.latest_charge;
  const brand = s.branding_settings || {};
  let state = "unpaid";
  if (s.payment_status === "paid" || s.payment_status === "no_payment_required") state = "paid";
  else if (s.status === "complete") state = "processing"; // e.g. bank payment still on its way
  else if (s.status === "expired") state = "expired";

  return {
    state,
    productId: s.metadata?.productId || null,
    amount: s.amount_total,
    currency: (s.currency || "").toUpperCase(),
    receiptUrl: typeof charge === "object" ? charge?.receipt_url || null : null,
    returnTo: s.metadata?.returnTo || null,
    brand: {
      name: brand.display_name || null,
      background: brand.background_color || null,
      accent: brand.button_color || null,
    },
  };
}

// Checks the Stripe-Signature header against the raw request body.
// Returns { ok: true } or { ok: false, reason, detail }.
// `reason` is safe to send back to whoever called the webhook.
// `detail` adds hints about the configured secret (length, last 4
// characters, never the secret itself) and belongs in the private log only.
export function checkSignature(rawBody, header, rawSecret, toleranceSec = 300, now = Date.now()) {
  // Strip spaces, line breaks and wrapping quotes that sneak in when pasting.
  const secret = String(rawSecret || "").trim().replace(/^["']|["']$/g, "");
  if (!secret) {
    return { ok: false, reason: "secret not configured", detail: "STRIPE_WEBHOOK_SECRET is empty for functions (check its scopes and deploy context)" };
  }
  if (!secret.startsWith("whsec_")) {
    return {
      ok: false,
      reason: "secret has the wrong format",
      detail: `STRIPE_WEBHOOK_SECRET does not start with whsec_ (starts with "${secret.slice(0, 3)}…", length ${secret.length})`,
    };
  }
  if (!header) return { ok: false, reason: "request has no Stripe-Signature header" };

  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0) return { ok: false, reason: "Stripe-Signature header is malformed" };
  const age = Math.abs(now / 1000 - Number(t));
  if (age > toleranceSec) return { ok: false, reason: `signature timestamp is ${Math.round(age)}s old` };

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const exp = Buffer.from(expected);
  const match = sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
  if (match) return { ok: true };
  return {
    ok: false,
    reason: "signature does not match",
    detail: `the secret in Netlify (length ${secret.length}, ends "…${secret.slice(-4)}") is not the signing secret of the destination that sent this`,
  };
}

export function verifySignature(...args) {
  return checkSignature(...args).ok;
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
