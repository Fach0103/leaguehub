/**
 * app.js — punto de entrada.
 * Debe cargarse DESPUÉS de router.js, los componentes y las vistas,
 * porque solo arranca el router (que a su vez espera DOMContentLoaded).
 */
(function () {
  "use strict";
  LH.router.init();

  // Fase 1: aquí se inicializará la conexión a IndexedDB y se
  // llamará a LH.footer.setDbStatus(true/false) según el resultado.
})();
