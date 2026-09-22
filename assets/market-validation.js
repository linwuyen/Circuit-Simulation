(() => {
  "use strict";

  const config = window.DIGITAL_BUCK_PRODUCT || {};
  const checkoutUrl = typeof config.checkoutUrl === "string" ? config.checkoutUrl.trim() : "";
  const analyticsEndpoint = typeof config.analyticsEndpoint === "string" ? config.analyticsEndpoint.trim() : "";

  function isHttpUrl(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch (_) {
      return false;
    }
  }

  function appendCampaignParams(value) {
    const target = new URL(value, window.location.href);
    const source = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => {
      const current = source.get(key);
      if (current && !target.searchParams.has(key)) target.searchParams.set(key, current);
    });
    return target.toString();
  }

  function record(eventName, detail) {
    const event = {
      event: eventName,
      path: window.location.pathname,
      ts: new Date().toISOString(),
      detail: detail || {}
    };

    window.dispatchEvent(new CustomEvent("market-validation:event", { detail: event }));

    try {
      const key = "digitalBuckMarketValidationEvents";
      const history = JSON.parse(window.localStorage.getItem(key) || "[]");
      history.push(event);
      window.localStorage.setItem(key, JSON.stringify(history.slice(-50)));
    } catch (_) {
      // Tracking must never block the product page.
    }

    if (isHttpUrl(analyticsEndpoint) && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          analyticsEndpoint,
          new Blob([JSON.stringify(event)], { type: "application/json" })
        );
      } catch (_) {
        // Optional analytics are best-effort only.
      }
    }
  }

  function configurePrice() {
    const price = Number(config.priceTwd);
    document.querySelectorAll("[data-product-price]").forEach((node) => {
      node.textContent = Number.isFinite(price) ? "NT$" + price.toLocaleString("zh-TW") : "Early Access";
    });
  }

  function configureCheckout() {
    const status = document.querySelector("[data-checkout-status]");
    const buttons = Array.from(document.querySelectorAll("[data-buy]"));

    if (!isHttpUrl(checkoutUrl)) {
      buttons.forEach((button) => {
        button.removeAttribute("href");
        button.setAttribute("aria-disabled", "true");
        button.classList.add("is-disabled");
        button.addEventListener("click", (event) => {
          event.preventDefault();
          record("checkout_unavailable_click");
          if (status) {
            status.hidden = false;
            status.textContent = "付款尚未啟用：請先在 assets/product-config.js 設定 Lemon Squeezy checkout URL。";
            status.focus({ preventScroll: true });
          }
        });
      });
      return;
    }

    const href = appendCampaignParams(checkoutUrl);
    buttons.forEach((button) => {
      button.href = href;
      button.target = "_blank";
      button.rel = "noopener noreferrer";
      button.removeAttribute("aria-disabled");
      button.classList.remove("is-disabled");
      button.addEventListener("click", () => record("checkout_click", { placement: button.dataset.placement || "unknown" }));
    });

    if (status) status.hidden = true;
  }

  function bindTracking() {
    document.querySelectorAll("[data-track]").forEach((node) => {
      node.addEventListener("click", () => record(node.dataset.track, { href: node.getAttribute("href") || "" }));
    });
    record("page_view", { referrer: document.referrer ? "present" : "direct_or_hidden" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    configurePrice();
    configureCheckout();
    bindTracking();
  });
})();
