// ─────────────────────────────────────────────────────────────
// PRODUCT CATALOGUE — the only file you edit to sell something new.
//
// Prices live HERE, on the server. A visitor can never change a
// price by tampering with a link.
//
//   amount      price in CENTS (6800 = €68.00)
//   currency    "EUR", "USD", ...
//   successUrl  (optional) where the buyer lands after paying
//   cancelUrl   (optional) where the buyer lands if they back out
//
// If successUrl / cancelUrl are left out, the gateway's own
// thanks.html / cancelled.html pages are used.
// ─────────────────────────────────────────────────────────────
export const products = {
  "example-product": {
    name: "Example product",
    amount: 1000,
    currency: "EUR",
  },

  // "massage-60": {
  //   name: "Swedish massage — 60 min",
  //   amount: 6800,
  //   currency: "EUR",
  //   successUrl: "https://christopher-james.com/thanks.html",
  //   cancelUrl: "https://christopher-james.com/",
  // },
};
