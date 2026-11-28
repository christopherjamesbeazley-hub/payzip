// ─────────────────────────────────────────────────────────────
// PRODUCT CATALOGUE — the only file you edit to sell something new.
//
// Prices live HERE, on the server. A visitor can never change a
// price by tampering with a link.
//
//   name        what the buyer sees at checkout
//   amount      price in CENTS (6800 = €68.00). Stripe's minimum is 50.
//   currency    "EUR", "USD", ...
//   successUrl  (optional) where the buyer lands after paying
//   cancelUrl   (optional) where the buyer lands if they back out
//   tikkieUrl   (optional) a Tikkie Business payment link for exactly
//               this amount. Adds a "Pay with Tikkie" button.
//   providers   (optional) limit the options, e.g. ["stripe"]
//   hidden      (optional) true = not listed for embed buttons, but a
//               direct /api/checkout link still works
//
// If successUrl / cancelUrl are left out, the gateway's own
// thanks.html / cancelled.html pages are used.
//
// One payzip can sell for several websites: give each site's products
// their own successUrl / cancelUrl pointing back to that site.
// ─────────────────────────────────────────────────────────────
const tarotHome = "https://parot-tarot-project.netlify.app/";
const tarot = (name, amount) => ({ name, amount, currency: "EUR", providers: ["stripe"], hidden: true,
  requiresTarotOrder: true, successUrl: tarotHome, cancelUrl: tarotHome });

export const products = {
  "parot-single": tarot("Single Card", 400),
  "parot-past-present-future": tarot("Past–Present–Future", 1000),
  "parot-crossroads": tarot("Crossroads", 1000),
  "parot-celtic-cross": tarot("Celtic Cross", 2500),
  // €1 product for checking a real payment end to end. Refund it in the
  // Stripe dashboard afterwards. Delete it once you've gone live.
  "live-test": {
    name: "Payment test",
    amount: 100,
    currency: "EUR",
    // tikkieUrl: "https://tikkie.me/pay/...",   // create a €1.00 Tikkie and paste it here
  },

  // ── Outside the Box Solutions ───────────────────────────────
  // "otbs-consult-60": {
  //   name: "AI strategy session — 60 min",
  //   amount: 15000,
  //   currency: "EUR",
  //   successUrl: "https://www.outside-the-box-solutions.com/thanks",
  //   cancelUrl: "https://www.outside-the-box-solutions.com/",
  //   tikkieUrl: "https://tikkie.me/pay/...",
  // },

  // ── Christopher-James.com ──────────────────────────────────
  // "massage-60": {
  //   name: "Swedish massage — 60 min",
  //   amount: 6800,
  //   currency: "EUR",
  //   successUrl: "https://christopher-james.com/thanks.html",
  //   cancelUrl: "https://christopher-james.com/",
  // },
};
