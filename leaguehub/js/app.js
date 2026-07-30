/**
 * app.js — punto de entrada.
 * Debe cargarse DESPUÉS de router.js, los componentes y las vistas,
 * porque solo arranca el router (que a su vez espera DOMContentLoaded).
 */
(function () {
  "use strict";
  LH.router.init();

  async function updateSportTheme() {
    try {
      const league = await LH.leagues.getActive();
      if (league) {
        document.body.dataset.sport = league.sport;
      } else {
        delete document.body.dataset.sport;
      }
    } catch (e) {
      // ignorar
    }
  }

  LH.db
    .open()
    .then(() => {
      if (LH.footer) LH.footer.setDbStatus(true);
      const nav = document.querySelector("league-navbar");
      if (nav && typeof nav.updateActiveLeagueBadge === "function") {
        nav.updateActiveLeagueBadge();
      }
      updateSportTheme();
    })
    .catch((err) => {
      console.error("Error al abrir IndexedDB:", err);
      if (LH.footer) LH.footer.setDbStatus(false);
    });

  document.addEventListener("lh:navigate", updateSportTheme);
})();
