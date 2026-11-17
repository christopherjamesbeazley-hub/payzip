import { verifySignature, toPaidEvent } from "../../lib/stripe.mjs";
import { fulfil } from "../../lib/fulfil.mjs";

export const config = { path: "/api/webhook/stripe" };

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const raw = await req.text();
  const ok = verifySignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("Bad signature", { status: 400 });

  try {
    const paid = toPaidEvent(JSON.parse(raw));
    if (paid) await fulfil(paid);
    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 }); // Stripe will retry
  }
};
