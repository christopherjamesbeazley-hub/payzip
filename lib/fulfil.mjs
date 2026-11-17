import { products } from "../products.mjs";

// Called once a payment is CONFIRMED paid by the provider.
// Every payment, from either provider, arrives here in the same shape:
//
//   { provider, paymentId, productId, productName, quantity,
//     amount (cents), currency, email, ref, live, paidAt }
//
// If FULFILMENT_WEBHOOK_URL is set, the record is POSTed there as JSON
// (Make, Zapier, n8n, a Google Sheet script, your own app ...).
// Providers can notify more than once, so the receiver should treat
// `paymentId` as the unique key and ignore repeats.
export async function fulfil(paid) {
  const record = {
    ...paid,
    productName: products[paid.productId]?.name || null,
    paidAt: new Date().toISOString(),
  };
  console.log("PAID", JSON.stringify(record));

  const url = process.env.FULFILMENT_WEBHOOK_URL;
  if (!url) return;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  // Throwing makes our webhook answer 500, so the provider retries later.
  if (!res.ok) throw new Error(`Fulfilment webhook answered ${res.status}`);
}
