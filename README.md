# payzip — one payment gateway for all your websites

A small Netlify site that takes payments through **Stripe** (iDEAL, cards, Apple Pay …), **Tikkie Business** and, optionally, **Mollie**. Deploy it once; any website then gets pay buttons by pasting two lines.

No npm packages, no database, no build step.

## Add pay buttons to any website

```html
<script src="https://payzip.netlify.app/embed.js" defer></script>
<div data-payzip="otbs-consult-60" data-payzip-lang="nl"></div>
```

The div turns into the product name, its price and one button per payment option that's set up. Works on any site builder that lets you paste HTML (Netlify, WordPress, Webflow, Wix custom code …).

| Attribute | Meaning |
|---|---|
| `data-payzip` | Product id from `products.mjs` (required) |
| `data-payzip-lang` | `nl` for Dutch buttons, default English |
| `data-payzip-providers` | Show only some buttons, e.g. `stripe` or `stripe,tikkie` |
| `data-payzip-ref` | Your own reference (booking id, client name), returned in the order record |
| `data-payzip-price` | `off` hides the price line |

Restyle with CSS variables on the div or a parent: `--payzip-bg`, `--payzip-fg`, `--payzip-radius`, `--payzip-tikkie-bg`.

Prefer a plain link? `https://payzip.netlify.app/api/checkout?product=ID&provider=stripe` (also `qty`, `email`, `ref`).

## Products

Everything you sell lives in `products.mjs`: name, price in cents, and optionally where the buyer returns to and a Tikkie link. Prices never come from the link, so nobody can change them. One payzip can sell for several sites; give each site's products their own `successUrl` / `cancelUrl`.

## How each payment option works

**Stripe** — buyer goes to Stripe's checkout page, pays with whatever methods are switched on in your Stripe dashboard (iDEAL, card, Apple Pay …). Stripe tells payzip when the money is in, and payzip records the order as `paid`. Fully automatic.

**Tikkie** — buyer goes to a Tikkie Business link you made for that product. Tikkie does not report back to payzip without the Tikkie API (which needs an ABN AMRO business contract), so payzip records the order as `awaiting_confirmation`. Check the Tikkie Business app, then deliver. When API access is available, only `lib/tikkie.mjs` changes.

**Mollie** — optional, same flow as Stripe. Its button only appears once `MOLLIE_API_KEY` is set.

## Order records

Every order event is written to Netlify → Logs → Functions, and POSTed to `FULFILMENT_WEBHOOK_URL` if you set one (Make, Zapier, n8n, a Google Sheet …):

```json
{
  "status": "paid",
  "provider": "stripe",
  "paymentId": "pi_xxx",
  "productId": "otbs-consult-60",
  "productName": "AI strategy session — 60 min",
  "quantity": 1,
  "amount": 15000,
  "currency": "EUR",
  "email": "buyer@example.com",
  "ref": "booking-123",
  "live": true,
  "at": "2026-11-25T10:00:00.000Z"
}
```

`status` is `paid` (Stripe, Mollie) or `awaiting_confirmation` (Tikkie). The buyer reaching the thank-you page is **not** proof of payment; only a `paid` record is. Providers can notify more than once, so treat `paymentId` as the unique key.

## Going live with Stripe

1. **Payment methods.** Stripe dashboard (live) → Settings → Payment methods → turn on **iDEAL | Wero** and anything else you want. Checkout shows whatever is on.
2. **Live key.** Developers → API keys. Best: *Create restricted key* with only **Checkout Sessions: Write**, and use that `rk_live_…`. A standard `sk_live_…` also works.
3. **Live webhook.** Workbench → Webhooks, in **live** mode → *Create an event destination* → Your account → Snapshot → events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` → endpoint `https://payzip.netlify.app/api/webhook/stripe`. Reveal its `whsec_…` secret.
4. **Netlify.** Site configuration → Environment variables: put the live key in `STRIPE_SECRET_KEY` and the live `whsec_…` in `STRIPE_WEBHOOK_SECRET`. Deploys → Trigger deploy.
5. **Real test.** Open payzip's home page, pay the €1 `live-test` product with iDEAL, check Stripe → Transactions and Netlify → Logs → Functions for a `PAID` line with `"live":true`. Refund it in Stripe, then remove `live-test` from `products.mjs`.

Test and live keys/secrets are different. Keep the sandbox ones for a separate test deploy if you want one.

## Setting up Tikkie for a product

1. In the Tikkie Business portal, create a payment request for **exactly** the product's price, open to multiple payers, with the longest validity it offers.
2. Copy its `https://tikkie.me/pay/…` link into that product's `tikkieUrl` in `products.mjs`.
3. Note the link's expiry date. When it expires, make a new one and replace the link.

A Tikkie link has one fixed amount, so Tikkie orders are always for one item.

## Install on a new website

1. Add the site's products to `products.mjs` with that site's `successUrl` / `cancelUrl`.
2. Commit to `main`; Netlify redeploys.
3. Paste the two-line snippet into the site.

## Hand over to a new owner

Each owner needs their **own** Stripe account (and Tikkie Business / Mollie if used). To transfer: fork or copy this repo, import it into the new owner's Netlify, put their keys and their own webhook secret in their environment variables, replace every `tikkieUrl` with their links, then run the €1 live test. Never hand over your own keys.

## Not in this version

- Subscriptions and instalment plans
- Refunds (do them in the Stripe / Mollie dashboard, Tikkie app)
- Invoices and VAT handling
- Automatic Tikkie confirmation (needs the Tikkie API)
- A database: the fulfilment receiver must store orders and ignore repeats

## Deploy notes

Netlify imports `christopherjamesbeazley-hub/payzip`, branch `main`. Leave base directory and build command empty; `netlify.toml` sets `public` and `netlify/functions`. Drag-and-drop deploys don't include functions, so always deploy from GitHub.
