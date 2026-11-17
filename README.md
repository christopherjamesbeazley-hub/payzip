# paygate — one payment gateway for all your sites

A small Netlify site that takes payments through **Stripe** or **Mollie** behind a single link format. Deploy it once (e.g. `pay.yourdomain.com`); every other site just links to it.

```
https://pay.yourdomain.com/api/checkout?product=massage-60
https://pay.yourdomain.com/api/checkout?product=massage-60&provider=stripe
```

No npm packages, no database, no build step.

## How it works

1. A button on any of your sites links to `/api/checkout?product=...`.
2. The gateway looks the price up in `products.mjs` (never from the link), creates a hosted checkout at the chosen provider, and redirects the buyer there.
3. The provider tells the gateway when the money is really in (`/api/webhook/stripe`, `/api/webhook/mollie`).
4. The gateway turns that into one standard "paid" record, writes it to the function log, and — if you set `FULFILMENT_WEBHOOK_URL` — POSTs it to your automation tool.

The buyer landing on the thank-you page is **not** proof of payment. Only the "paid" record is.

## Link options

| Parameter  | Required | Meaning |
|------------|----------|---------|
| `product`  | yes      | An id from `products.mjs` |
| `provider` | no       | `mollie` or `stripe`. Defaults to `DEFAULT_PROVIDER` |
| `qty`      | no       | 1–99, default 1 |
| `email`    | no       | Pre-fills / records the buyer's email |
| `ref`      | no       | Your own reference (booking id, client name), returned in the paid record |

## Setup

### 1. Deploy
Netlify drag-and-drop does **not** deploy functions, so this one goes through GitHub:
put this folder in a new GitHub repo → Netlify → *Add new site → Import an existing project* → pick the repo. No build settings needed.

### 2. Stripe
- Dashboard → Developers → API keys → copy the **test** secret key → `STRIPE_SECRET_KEY`.
- Developers → Webhooks → add endpoint `https://YOUR-SITE/api/webhook/stripe`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded` → copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
- Settings → Payment methods: switch on iDEAL | Wero, cards, etc. The checkout shows whatever is enabled there.

### 3. Mollie
- Create the account and website profile at mollie.com (live payments need their business verification; test mode works straight away).
- Developers → API keys → copy the **test** key → `MOLLIE_API_KEY`.
- No webhook to register: the gateway passes its webhook address with every payment.

### 4. Environment variables
Netlify → Site configuration → Environment variables. See `.env.example`. Redeploy after changing them.

### 5. Test
Open the site's home page and use both test buttons. Then check Netlify → Logs → Functions for a line starting with `PAID`. When both work, swap in live keys (and the live Stripe webhook secret) and delete the test buttons from `public/index.html`.

## The paid record

```json
{
  "provider": "mollie",
  "paymentId": "tr_xxx",
  "productId": "massage-60",
  "productName": "Swedish massage — 60 min",
  "quantity": 1,
  "amount": 6800,
  "currency": "EUR",
  "email": "buyer@example.com",
  "ref": "booking-123",
  "live": true,
  "paidAt": "2026-11-17T07:00:00.000Z"
}
```

Providers may notify more than once. Treat `paymentId` as the unique key and ignore repeats.

## Not in this version

- Subscriptions and instalment plans
- Refunds (do them in the Stripe / Mollie dashboard)
- Invoices and VAT handling
- Mollie's newer signed "next-gen" webhooks (beta) — this uses the classic id-then-verify flow

## Deploy this repository

Import `christopherjamesbeazley-hub/payzip` into Netlify using branch `main`.
Leave the base directory and build command empty. The repository-root
`netlify.toml` sets the publish directory to `public` and functions directory
to `netlify/functions`. Do not use GitHub Pages for this server-side gateway.

Set your chosen provider's test credentials in Netlify environment variables
(never commit actual keys). Set `DEFAULT_PROVIDER` to that provider.
For Stripe, register both webhook events listed above using your deployed URL.
Redeploy, then test checkout and confirm the provider webhook reaches fulfilment.

Only `example-product` (€10) is active. Configure your real products before
launch. There is no database, automatic email confirmation, or duplicate-event
storage in this version. The optional fulfilment receiver must persist orders
and deduplicate events using provider plus paymentId.
