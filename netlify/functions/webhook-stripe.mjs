import { checkSignature, toPaidEvent } from "../../lib/stripe.mjs";
import { fulfil } from "../../lib/fulfil.mjs";

export const config = { path: "/api/webhook/stripe" };

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const raw = await req.text();
  const check = checkSignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!check.ok) {
    console.error("STRIPE WEBHOOK REJECTED:", check.reason, check.detail ? `— ${check.detail}` : "");
    return new Response(`Bad signature: ${check.reason}`, { status: 400 });
  }

  try {
    const event = JSON.parse(raw);
    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      console.log(JSON.stringify({
        provider: "stripe",
        eventType: event.type,
        status: event.type === "checkout.session.expired" ? "expired" : "failed",
        eventId: event.id,
        checkoutSessionId: event.data.object.id,
      }));
      return new Response("ok");
    }

    const paid = toPaidEvent(event);
    if (paid) await fulfil(paid);
    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 }); // Stripe will retry
  }
};
