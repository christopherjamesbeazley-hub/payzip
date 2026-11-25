/*!
 * payzip embed — pay buttons for any website.
 *
 *   <script src="https://YOUR-PAYZIP-SITE/embed.js" defer></script>
 *   <div data-payzip="product-id"></div>
 *
 * Optional attributes on the div:
 *   data-payzip-providers="stripe,tikkie"   which buttons to show (default: all that are set up)
 *   data-payzip-lang="nl"                   Dutch button text (default: English)
 *   data-payzip-ref="booking-123"           your own reference, returned in the order record
 *   data-payzip-price="off"                 hide the price line
 *
 * Restyle with CSS variables on the div or any parent:
 *   --payzip-bg, --payzip-fg, --payzip-radius, --payzip-tikkie-bg
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var BASE = script ? new URL(script.src).origin : "";

  var TEXT = {
    en: { stripe: "Pay with iDEAL or card", mollie: "Pay with Mollie", tikkie: "Pay with Tikkie",
          tikkieNote: "Tikkie payments are confirmed by hand, usually within a day.",
          unavailable: "Online payment is not available right now." },
    nl: { stripe: "Betaal met iDEAL of kaart", mollie: "Betaal met Mollie", tikkie: "Betaal met Tikkie",
          tikkieNote: "Tikkie-betalingen worden handmatig bevestigd, meestal binnen een dag.",
          unavailable: "Online betalen is op dit moment niet beschikbaar." },
  };

  var css =
    ".payzip{font:inherit;display:flex;flex-direction:column;gap:.5rem;max-width:22rem;margin:0 0 1.25rem}" +
    ".payzip-price{font-weight:600}" +
    ".payzip-btn{display:block;text-align:center;padding:.75rem 1rem;border-radius:var(--payzip-radius,.5rem);" +
    "background:var(--payzip-bg,#1f1f1f);color:var(--payzip-fg,#fff);text-decoration:none;font-weight:600}" +
    ".payzip-btn:hover{opacity:.9}" +
    ".payzip-btn.tikkie{background:var(--payzip-tikkie-bg,#4a3aff)}" +
    ".payzip-note{font-size:.8em;opacity:.7;margin:0}";

  function addStyle() {
    if (document.getElementById("payzip-style")) return;
    var s = document.createElement("style");
    s.id = "payzip-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  function money(cents, currency, lang) {
    try {
      return new Intl.NumberFormat(lang === "nl" ? "nl-NL" : "en-IE", { style: "currency", currency: currency })
        .format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(2) + " " + currency;
    }
  }

  function render(el, product, id) {
    var lang = el.getAttribute("data-payzip-lang") === "nl" ? "nl" : "en";
    var t = TEXT[lang];
    var wanted = (el.getAttribute("data-payzip-providers") || "").split(",")
      .map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var providers = product.providers.filter(function (p) { return !wanted.length || wanted.indexOf(p) !== -1; });
    var ref = el.getAttribute("data-payzip-ref");

    var box = document.createElement("div");
    box.className = "payzip";

    if (el.getAttribute("data-payzip-price") !== "off") {
      var price = document.createElement("div");
      price.className = "payzip-price";
      price.textContent = product.name + " · " + money(product.amount, product.currency, lang);
      box.appendChild(price);
    }

    if (!providers.length) {
      var none = document.createElement("p");
      none.className = "payzip-note";
      none.textContent = t.unavailable;
      box.appendChild(none);
    }

    providers.forEach(function (p) {
      var a = document.createElement("a");
      a.className = "payzip-btn " + p;
      var q = "product=" + encodeURIComponent(id) + "&provider=" + p;
      if (ref) q += "&ref=" + encodeURIComponent(ref);
      a.href = BASE + "/api/checkout?" + q;
      a.textContent = t[p] || p;
      box.appendChild(a);
    });

    if (providers.indexOf("tikkie") !== -1) {
      var note = document.createElement("p");
      note.className = "payzip-note";
      note.textContent = t.tikkieNote;
      box.appendChild(note);
    }

    el.innerHTML = "";
    el.appendChild(box);
  }

  function init() {
    var els = document.querySelectorAll("[data-payzip]");
    if (!els.length) return;
    addStyle();
    fetch(BASE + "/api/products")
      .then(function (r) { return r.json(); })
      .then(function (list) {
        els.forEach(function (el) {
          var id = el.getAttribute("data-payzip");
          if (list[id]) render(el, list[id], id);
          else console.warn("payzip: unknown product", id);
        });
      })
      .catch(function (e) { console.error("payzip: could not load products", e); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
