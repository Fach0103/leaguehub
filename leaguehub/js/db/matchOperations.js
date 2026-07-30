window.LH = window.LH || {};
LH.matchOperations = (function () {
  "use strict";

  function computeResult(scored, conceded) {
    if (scored > conceded) return "win";
    if (scored < conceded) return "loss";
    return "draw";
  }

  function applyTeamResult(teamsStore, teamId, scored, conceded, result) {
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

  function revertTeamResult(teamsStore, teamId, scored, conceded) {
    const getReq = teamsStore.get(Number(teamId));
    getReq.onsuccess = () => {
      const team = getReq.result;
      if (!team) return;
      team.stats.pj = Math.max(0, team.stats.pj - 1);
      team.stats.pf = Math.max(0, team.stats.pf - scored);
      team.stats.pc = Math.max(0, team.stats.pc - conceded);
      const result = computeResult(scored, conceded);
      if (result === "win") team.stats.pg = Math.max(0, team.stats.pg - 1);
      else if (result === "draw") team.stats.pe = Math.max(0, team.stats.pe - 1);
      else team.stats.pp = Math.max(0, team.stats.pp - 1);
      teamsStore.put(team);
    };
  }

  function advanceWinner(stores, match, homeScore, awayScore, winnerTeamId) {
    if (!match.nextMatchId) return;
    const nextMatchId = match.nextMatchId;
    const slot = match.nextMatchSlot;

    // En eliminación directa, si hay empate se usa winnerTeamId declarado
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

  function clearWinnerSlot(stores, match) {
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

  async function finalizeMatch(matchId, draftEvents, winnerTeamId) {
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

    const homeResult = computeResult(homeScore, awayScore);
    const awayResult = computeResult(awayScore, homeScore);

    await LH.db.transaction(["matches", "teams", "players", "events"], "readwrite", (stores) => {
      const matchGetReq = stores.matches.get(matchId);
      matchGetReq.onsuccess = () => {
        const m = matchGetReq.result;
        if (!m) return;
        m.status = "finished";
        m.homeScore = homeScore;
        m.awayScore = awayScore;
        stores.matches.put(m);
      };

      applyTeamResult(stores.teams, match.homeTeamId, homeScore, awayScore, homeResult);
      applyTeamResult(stores.teams, match.awayTeamId, awayScore, homeScore, awayResult);

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

      advanceWinner(stores, match, homeScore, awayScore, winnerTeamId);
    });
  }

  async function undoMatch(matchId) {
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
        stores.matches.put(m);
      };

      revertTeamResult(stores.teams, match.homeTeamId, match.homeScore, match.awayScore);
      revertTeamResult(stores.teams, match.awayTeamId, match.awayScore, match.homeScore);

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

      clearWinnerSlot(stores, match);
    });
  }

  return { finalizeMatch, undoMatch };
})();
