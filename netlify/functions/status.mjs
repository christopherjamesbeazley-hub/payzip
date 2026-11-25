import { products } from "../../products.mjs";
import { getSessionSummary } from "../../lib/stripe.mjs";

export const config = { path: "/api/status" };

// Used by thanks.html: "did this Stripe payment really go through?"
// Answers only what the thank-you page shows — no email, name or address.
const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default async (req) => {
  if (req.method !== "GET") return json(405, { error: "GET only" });
  const id = new URL(req.url).searchParams.get("session_id") || "";

  try {
    const summary = await getSessionSummary(id);
    if (!summary) return json(404, { state: "unknown" });
    return json(200, {
      ...summary,
      productName: products[summary.productId]?.name || null,
    });
  } catch (err) {
    console.error(err);
    return json(502, { state: "unknown" });
  }
};
