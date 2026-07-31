window.LH = window.LH || {};
LH.events = (function () {
  "use strict";

  const STORE = "events";

  async function getByMatch(matchId) {
    return LH.db.getAllByIndex(STORE, "matchId", Number(matchId));
  }

  async function hasEventsForPlayer(playerId) {
    const events = await LH.db.getAllByIndex(STORE, "playerId", Number(playerId));
    return events.length > 0;
  }

  async function getByPlayer(playerId) {
    return LH.db.getAllByIndex(STORE, "playerId", Number(playerId));
  }

  return { getByMatch, hasEventsForPlayer, getByPlayer };
})();
