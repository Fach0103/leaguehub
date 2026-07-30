/**
 * events.js
 * Solo lectura. Los eventos se ESCRIBEN exclusivamente dentro de la
 * transacción de finalizeMatch() (matchOperations.js) — nunca sueltos.
 */
window.LH = window.LH || {};
LH.events = (function () {
  "use strict";

  const STORE = "events";

  async function getByMatch(matchId) {
    return LH.db.getAllByIndex(STORE, "matchId", Number(matchId));
  }

  /** Usado por players.js (vista) para bloquear el borrado de un jugador. */
  async function hasEventsForPlayer(playerId) {
    const events = await LH.db.getAllByIndex(STORE, "playerId", Number(playerId));
    return events.length > 0;
  }

  async function getByPlayer(playerId) {
    return LH.db.getAllByIndex(STORE, "playerId", Number(playerId));
  }

  return { getByMatch, hasEventsForPlayer, getByPlayer };
})();
