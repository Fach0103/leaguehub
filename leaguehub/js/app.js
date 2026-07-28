/**
 * app.js — punto de entrada.
 * Debe cargarse DESPUÉS de router.js, los componentes y las vistas,
 * porque solo arranca el router (que a su vez espera DOMContentLoaded).
 */
(function () {
  "use strict";
  LH.router.init();

  LH.db
    .open()
    .then(() => {
      if (LH.footer) LH.footer.setDbStatus(true);
      // El navbar puede haberse conectado antes de que la BD abriera;
      // le pedimos que refresque el badge de liga activa ahora que sí hay datos.
      const nav = document.querySelector("league-navbar");
      if (nav && typeof nav.updateActiveLeagueBadge === "function") {
        nav.updateActiveLeagueBadge();
      }
    })
    .catch((err) => {
      console.error("Error al abrir IndexedDB:", err);
      if (LH.footer) LH.footer.setDbStatus(false);
    });
})();
