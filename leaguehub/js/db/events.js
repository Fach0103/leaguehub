window.LH = window.LH || {};

/**
 * EventService — solo lectura. Los eventos se ESCRIBEN exclusivamente
 * dentro de la transacción de MatchOperations.finalizeMatch(), nunca sueltos.
 */
class EventService {
  #store = "events";

  async getByMatch(matchId) {
    return LH.db.getAllByIndex(this.#store, "matchId", Number(matchId));
  }

  async getByPlayer(playerId) {
    return LH.db.getAllByIndex(this.#store, "playerId", Number(playerId));
  }

  /** Usado por PlayerService para bloquear el borrado de un jugador con anotaciones. */
  async hasEventsForPlayer(playerId) {
    const events = await this.getByPlayer(playerId);
    return events.length > 0;
  }
}

LH.events = new EventService();
LH.EventService = EventService;
