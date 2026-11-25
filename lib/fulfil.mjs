import { products } from "../products.mjs";

// Every order event, from any provider, leaves the gateway in one shape:
//
//   { status, provider, paymentId, productId, productName, quantity,
//     amount (cents), currency, email, ref, live, at }
//
// status is one of:
//   "paid"                   money confirmed by Stripe or Mollie → deliver
//   "awaiting_confirmation"  buyer was sent to a Tikkie link; check the
//                            Tikkie Business app before delivering
//
// Each event is written to the function log (Netlify → Logs → Functions)
// and, if FULFILMENT_WEBHOOK_URL is set, POSTed there as JSON (Make,
// Zapier, n8n, a Google Sheet script, your own app ...).
// Providers can notify more than once, so the receiver should treat
// `paymentId` as the unique key and ignore repeats.

function build(event, status) {
  return {
    status,
    ...event,
    productName: products[event.productId]?.name || null,
    at: new Date().toISOString(),
  };
}

async function send(record) {
  console.log(record.status.toUpperCase(), JSON.stringify(record));
  const url = process.env.FULFILMENT_WEBHOOK_URL;
  if (!url) return;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) throw new Error(`Fulfilment webhook answered ${res.status}`);
}

// Called once a payment is CONFIRMED paid by the provider.
// Throwing makes our webhook answer 500, so the provider retries later.
export async function fulfil(paid) {
  await send(build(paid, "paid"));
}

// Called when a buyer is sent to a payment we can't confirm automatically
// (Tikkie without API). Never throws: the buyer must still reach Tikkie.
export async function notifyPending(pending) {
  try {
    await send(build(pending, pending.status || "awaiting_confirmation"));
  } catch (err) {
    console.error("Could not send pending order", err);
  }
}
