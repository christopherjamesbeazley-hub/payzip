import { fetchPayment, toPaidEvent } from "../../lib/mollie.mjs";
import { fulfil } from "../../lib/fulfil.mjs";

export const config = { path: "/api/webhook/mollie" };

export default async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  try {
    const form = await req.formData();
    const payment = await fetchPayment(String(form.get("id") || ""));
    // Unknown ids still get a 200, so nobody can probe which ids exist.
    const paid = toPaidEvent(payment);
    if (paid) await fulfil(paid);
    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 }); // Mollie will retry
  }
};
