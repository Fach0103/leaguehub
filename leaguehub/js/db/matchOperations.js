window.LH = window.LH || {};

/**
 * MatchOperationsService
 * La operación de integridad central del proyecto: finalizar y deshacer
 * un partido, dentro de una sola transacción cada una.
 */
class MatchOperationsService {
  #computeResult(scored, conceded) {
    if (scored > conceded) return "win";
    if (scored < conceded) return "loss";
    return "draw";
  }

  #applyTeamResult(teamsStore, teamId, scored, conceded, result) {
    const getReq = teamsStore.get(Number(teamId));
    getReq.onsuccess = () => {
      const team = getReq.result;
      if (!team) return;
      team.stats.pj += 1;
      team.stats.pf += scored;
      team.stats.pc += conceded;
      if (result === "win") team.stats.pg += 1;
      else if (result === "draw") team.stats.pe += 1;
      else team.stats.pp += 1;
      teamsStore.put(team);
    };
  }

  #revertTeamResult(teamsStore, teamId, scored, conceded) {
    const getReq = teamsStore.get(Number(teamId));
    getReq.onsuccess = () => {
      const team = getReq.result;
      if (!team) return;
      team.stats.pj = Math.max(0, team.stats.pj - 1);
      team.stats.pf = Math.max(0, team.stats.pf - scored);
      team.stats.pc = Math.max(0, team.stats.pc - conceded);
      const result = this.#computeResult(scored, conceded);
      if (result === "win") team.stats.pg = Math.max(0, team.stats.pg - 1);
      else if (result === "draw") team.stats.pe = Math.max(0, team.stats.pe - 1);
      else team.stats.pp = Math.max(0, team.stats.pp - 1);
      teamsStore.put(team);
    };
  }

  #advanceWinner(stores, match, homeScore, awayScore, winnerTeamId) {
    if (!match.nextMatchId) return;
    const nextMatchId = match.nextMatchId;
    const slot = match.nextMatchSlot;

    let winnerId;
    if (homeScore !== awayScore) {
      winnerId = homeScore > awayScore ? match.homeTeamId : match.awayTeamId;
    } else {
      winnerId = winnerTeamId || match.homeTeamId;
    }

    const getReq = stores.matches.get(nextMatchId);
    getReq.onsuccess = () => {
      const nextMatch = getReq.result;
      if (!nextMatch) return;
      if (slot === "home") nextMatch.homeTeamId = winnerId;
      else nextMatch.awayTeamId = winnerId;
      stores.matches.put(nextMatch);
    };
  }

  #clearWinnerSlot(stores, match) {
    if (!match.nextMatchId) return;
    const getReq = stores.matches.get(match.nextMatchId);
    getReq.onsuccess = () => {
      const nextMatch = getReq.result;
      if (!nextMatch) return;
      if (nextMatch.status === "finished") return;
      if (match.nextMatchSlot === "home") nextMatch.homeTeamId = null;
      else nextMatch.awayTeamId = null;
      stores.matches.put(nextMatch);
    };
  }

  /**
   * @param {number} matchId
   * @param {Array<{teamId:number, playerId:number, minute:?number}>} draftEvents
   * @param {number|null} winnerTeamId - obligatorio si el marcador queda
   *        empatado en eliminación directa (desempate manual, ej. penales).
   */
  async finalizeMatch(matchId, draftEvents, winnerTeamId) {
    matchId = Number(matchId);
    draftEvents = draftEvents || [];

    const match = await LH.matches.getById(matchId);
    if (!match) throw new Error("Partido no encontrado.");
    if (match.status === "finished") throw new Error("El partido ya está finalizado.");

    const homeScore = draftEvents.filter(
      (ev) => Number(ev.teamId) === Number(match.homeTeamId)
    ).length;
    const awayScore = draftEvents.filter(
      (ev) => Number(ev.teamId) === Number(match.awayTeamId)
    ).length;

    const homeResult = this.#computeResult(homeScore, awayScore);
    const awayResult = this.#computeResult(awayScore, homeScore);

    await LH.db.transaction(["matches", "teams", "players", "events"], "readwrite", (stores) => {
      const matchGetReq = stores.matches.get(matchId);
      matchGetReq.onsuccess = () => {
        const m = matchGetReq.result;
        if (!m) return;
        m.status = "finished";
        m.homeScore = homeScore;
        m.awayScore = awayScore;
        // Se guarda explícitamente el ganador: si el marcador queda empatado
        // (eliminación directa, decidido "por penales" u otro criterio
        // manual), no hay forma de saberlo solo comparando homeScore/awayScore.
        // BracketView lo usa para resaltar al equipo correcto.
        m.winnerTeamId =
          homeScore !== awayScore
            ? (homeScore > awayScore ? m.homeTeamId : m.awayTeamId)
            : winnerTeamId || null;
        stores.matches.put(m);
      };

      this.#applyTeamResult(stores.teams, match.homeTeamId, homeScore, awayScore, homeResult);
      this.#applyTeamResult(stores.teams, match.awayTeamId, awayScore, homeScore, awayResult);

      // Se reemplazan los eventos del partido (se borran los previos y se
      // insertan los actuales), así se puede re-finalizar tras un "deshacer"
      // sin duplicar ni dejar eventos huérfanos.
      const oldEventsCursorReq = stores.events
        .index("matchId")
        .openCursor(IDBKeyRange.only(matchId));
      oldEventsCursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };

      draftEvents.forEach((ev) => {
        stores.events.add({
          matchId,
          teamId: Number(ev.teamId),
          playerId: Number(ev.playerId),
          minute:
            ev.minute !== undefined && ev.minute !== null && ev.minute !== ""
              ? Number(ev.minute)
              : null,
        });
      });

      const countsByPlayer = {};
      draftEvents.forEach((ev) => {
        const pid = Number(ev.playerId);
        countsByPlayer[pid] = (countsByPlayer[pid] || 0) + 1;
      });
      Object.entries(countsByPlayer).forEach(([playerId, count]) => {
        const getPlayerReq = stores.players.get(Number(playerId));
        getPlayerReq.onsuccess = () => {
          const player = getPlayerReq.result;
          if (!player) return;
          player.stats.pj += 1;
          player.stats.goals += count;
          stores.players.put(player);
        };
      });

      this.#advanceWinner(stores, match, homeScore, awayScore, winnerTeamId);
    });
  }

  /** Operación inversa. Los eventos NO se borran: quedan para re-finalizar. */
  async undoMatch(matchId) {
    matchId = Number(matchId);

    const match = await LH.matches.getById(matchId);
    if (!match) throw new Error("Partido no encontrado.");
    if (match.status !== "finished") throw new Error("El partido no está finalizado.");

    if (match.nextMatchId) {
      const nextMatch = await LH.matches.getById(match.nextMatchId);
      if (nextMatch && nextMatch.status === "finished") {
        throw new Error(
          "No se puede deshacer: el partido de la siguiente ronda ya está finalizado. Deshaz primero ese partido."
        );
      }
    }

    const events = await LH.events.getByMatch(matchId);
    const countsByPlayer = {};
    events.forEach((ev) => {
      countsByPlayer[ev.playerId] = (countsByPlayer[ev.playerId] || 0) + 1;
    });

    await LH.db.transaction(["matches", "teams", "players", "events"], "readwrite", (stores) => {
      const matchGetReq = stores.matches.get(matchId);
      matchGetReq.onsuccess = () => {
        const m = matchGetReq.result;
        if (!m) return;
        m.status = "scheduled";
        m.homeScore = null;
        m.awayScore = null;
        m.winnerTeamId = null;
        stores.matches.put(m);
      };

      this.#revertTeamResult(stores.teams, match.homeTeamId, match.homeScore, match.awayScore);
      this.#revertTeamResult(stores.teams, match.awayTeamId, match.awayScore, match.homeScore);

      Object.entries(countsByPlayer).forEach(([playerId, count]) => {
        const getPlayerReq = stores.players.get(Number(playerId));
        getPlayerReq.onsuccess = () => {
          const player = getPlayerReq.result;
          if (!player) return;
          player.stats.pj = Math.max(0, player.stats.pj - 1);
          player.stats.goals = Math.max(0, player.stats.goals - count);
          stores.players.put(player);
        };
      });

      this.#clearWinnerSlot(stores, match);
    });
  }
}

LH.matchOperations = new MatchOperationsService();
LH.MatchOperationsService = MatchOperationsService;
