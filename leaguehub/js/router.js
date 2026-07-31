window.LH = window.LH || {};

(function () {
  "use strict";

  const ROUTES = [
    { pattern: "#dashboard", view: "dashboard" },
    { pattern: "#leagues", view: "leagues" },
    { pattern: "#teams", view: "teams" },
    { pattern: "#team/:id", view: "teamDetail" },
    { pattern: "#players", view: "players" },
    { pattern: "#player/:id", view: "playerDetail" },
    { pattern: "#matches", view: "matches" },
    { pattern: "#match/:id", view: "matchDetail" },
    { pattern: "#stats", view: "stats" },
  ];

  const DEFAULT_ROUTE = "#dashboard";

  function matchRoute(hash) {
    const hashParts = hash.split("/");

    for (const route of ROUTES) {
      const patternParts = route.pattern.split("/");
      if (patternParts.length !== hashParts.length) continue;

      const params = {};
      let matched = true;

      for (let i = 0; i < patternParts.length; i++) {
        const p = patternParts[i];
        const h = hashParts[i];
        if (p.startsWith(":")) {
          params[p.slice(1)] = decodeURIComponent(h);
        } else if (p !== h) {
          matched = false;
          break;
        }
      }

      if (matched) return { view: route.view, params };
    }

    return null;
  }

  function renderCurrentRoute() {
    let hash = window.location.hash || DEFAULT_ROUTE;
    if (!window.location.hash) {
      window.location.hash = DEFAULT_ROUTE;
      return;
    }

    const root = document.getElementById("view-root");
    const match = matchRoute(hash);

    if (!match || typeof LH.views[match.view] !== "function") {
      root.innerHTML =
        '<div class="view-empty"><h2>Vista no encontrada</h2><p>La ruta "' +
        hash +
        '" no existe.</p></div>';
    } else {
      root.innerHTML = "";
      LH.views[match.view](root, match.params);
    }

    document.dispatchEvent(
      new CustomEvent("lh:navigate", { detail: { hash, view: match ? match.view : null } })
    );

    window.scrollTo({ top: 0 });
  }

  function init() {
    window.addEventListener("hashchange", renderCurrentRoute);
    window.addEventListener("DOMContentLoaded", renderCurrentRoute);
  }

  LH.router = { init, matchRoute };
})();
