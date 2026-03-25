(() => {
  const CONSENT_KEY = "updaze_cookie_consent";
  const ADSENSE_CLIENT = "ca-pub-5731928992880799";
  const ALLOW = "allow";
  const DECLINE = "decline";

  function getConsent() {
    return window.localStorage.getItem(CONSENT_KEY);
  }

  function setConsent(value) {
    window.localStorage.setItem(CONSENT_KEY, value);
  }

  function clearNonNecessaryCookies() {
    const cookieNames = ["_ga", "_gid", "_gat", "_gcl_au", "__gads", "__gpi"];
    cookieNames.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; path=/; domain=.${window.location.hostname}; SameSite=Lax`;
    });
  }

  function loadAdsenseScript() {
    if (document.querySelector("script[data-adsense-loader='true']")) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.crossOrigin = "anonymous";
    script.dataset.adsenseLoader = "true";
    document.head.appendChild(script);
  }

  function applyConsent(consent) {
    if (consent === ALLOW) {
      loadAdsenseScript();
      return;
    }

    if (consent === DECLINE) {
      clearNonNecessaryCookies();
    }
  }

  function hideBanner() {
    const banner = document.getElementById("cookieConsentBanner");
    if (banner) banner.remove();
  }

  function showBanner() {
    if (document.getElementById("cookieConsentBanner")) return;

    const banner = document.createElement("div");
    banner.id = "cookieConsentBanner";
    banner.className = "cookie-consent-banner";
    banner.innerHTML = `
      <div class="cookie-consent-content">
        <p class="mb-2 mb-md-0">
          We use necessary cookies to keep the website working. You can allow optional cookies for ads and analytics.
          See our <a href="https://jobs.updaze.co.za/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>
          and <a href="https://jobs.updaze.co.za/term.html" target="_blank" rel="noopener">Terms & Conditions</a>.
        </p>
        <div class="d-flex gap-2 flex-shrink-0">
          <button type="button" class="btn btn-sm btn-outline-secondary" id="cookieDeclineBtn">Decline</button>
          <button type="button" class="btn btn-sm btn-primary" id="cookieAllowBtn">Allow</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById("cookieDeclineBtn")?.addEventListener("click", () => {
      setConsent(DECLINE);
      applyConsent(DECLINE);
      hideBanner();
    });

    document.getElementById("cookieAllowBtn")?.addEventListener("click", () => {
      setConsent(ALLOW);
      applyConsent(ALLOW);
      hideBanner();
    });
  }

  const consent = getConsent();
  if (consent) {
    applyConsent(consent);
  } else {
    showBanner();
  }
})();
