const API = "https://api.mollie.com/v2";

function key() {
  const k = process.env.MOLLIE_API_KEY;
  if (!k) throw new Error("MOLLIE_API_KEY is not set");
  return k;
}

export async function createCheckout({ product, productId, quantity, email, ref, successUrl, cancelUrl, webhookUrl }) {
  const res = await fetch(`${API}/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: {
        currency: product.currency.toUpperCase(),
        value: ((product.amount * quantity) / 100).toFixed(2), // Mollie wants "68.00"
      },
      description: quantity > 1 ? `${quantity} × ${product.name}` : product.name,
      redirectUrl: successUrl,
      cancelUrl,
      webhookUrl,
      metadata: { productId, quantity, ref: ref || null, email: email || null },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Mollie: ${data?.detail || data?.title || res.status}`);
  return { url: data._links.checkout.href, id: data.id };
}

// Mollie's classic webhook only sends a payment id. We never trust the
// request itself — we ask Mollie's API for the real status.
export async function fetchPayment(id) {
  if (!/^tr_[A-Za-z0-9]+$/.test(id || "")) return null;
  const res = await fetch(`${API}/payments/${id}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Mollie: ${res.status}`);
  return res.json();
}

export function toPaidEvent(p) {
  if (!p || p.status !== "paid") return null;
  return {
    provider: "mollie",
    paymentId: p.id,
    productId: p.metadata?.productId || null,
    quantity: Number(p.metadata?.quantity || 1),
    amount: Math.round(Number(p.amount.value) * 100),
    currency: p.amount.currency,
    email: p.metadata?.email || p.billingAddress?.email || null,
    ref: p.metadata?.ref || null,
    live: p.mode === "live",
  };
}
