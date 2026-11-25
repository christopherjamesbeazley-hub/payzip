import { products } from "../../products.mjs";
import { availableProviders } from "../../lib/providers.mjs";

export const config = { path: "/api/products" };

// Public, read-only list used by embed.js to draw buttons on any website.
// It only exposes what a buyer would see anyway: name, price, and which
// payment options are live. Hidden products (hidden: true) are left out.
export default async (req) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=60",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET") return new Response("GET only", { status: 405, headers });

  const list = {};
  for (const [id, prod] of Object.entries(products)) {
    if (prod.hidden) continue;
    list[id] = {
      name: prod.name,
      amount: prod.amount,
      currency: prod.currency.toUpperCase(),
      providers: availableProviders(prod),
    };
  }
  return new Response(JSON.stringify(list), { headers });
};
