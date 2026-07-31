window.LH = window.LH || {};
LH.matches = (function () {
  "use strict";

  const STORE = "matches";
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  async function create(data) {
    const league = await LH.leagues.getById(data.leagueId);
    if (!league) throw new Error("Liga no encontrada.");
    if (league.mode !== "league") {
      throw new Error(
        "En eliminación directa los partidos se generan con el bracket, no se crean manualmente."
      );
    }
    if (!data.homeTeamId || !data.awayTeamId) {
      throw new Error("Selecciona ambos equipos.");
    }
    if (Number(data.homeTeamId) === Number(data.awayTeamId)) {
      throw new Error("Un equipo no puede enfrentarse a sí mismo.");
    }
    if (!data.date) throw new Error("La fecha y hora son obligatorias.");

    const [homeTeam, awayTeam] = await Promise.all([
      LH.teams.getById(data.homeTeamId),
      LH.teams.getById(data.awayTeamId),
    ]);
    if (!homeTeam || homeTeam.leagueId !== Number(data.leagueId)) {
      throw new Error("El equipo local no pertenece a esta liga.");
    }
    if (!awayTeam || awayTeam.leagueId !== Number(data.leagueId)) {
      throw new Error("El equipo visitante no pertenece a esta liga.");
    }

    const dateKey = new Date(data.date).getTime();
    const existing = await getByLeague(data.leagueId);
    const duplicate = existing.some((m) => {
      const sameDate = new Date(m.date).getTime() === dateKey;
      const sameTeams =
        (Number(m.homeTeamId) === Number(data.homeTeamId) &&
          Number(m.awayTeamId) === Number(data.awayTeamId)) ||
        (Number(m.homeTeamId) === Number(data.awayTeamId) &&
          Number(m.awayTeamId) === Number(data.homeTeamId));
      return sameDate && sameTeams;
    });
    if (duplicate) {
      throw new Error("Ya existe un partido con estos equipos en esa misma fecha.");
    }

    const match = {
      leagueId: Number(data.leagueId),
      homeTeamId: Number(data.homeTeamId),
      awayTeamId: Number(data.awayTeamId),
      date: dateKey,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      round: null,
      nextMatchId: null,
      nextMatchSlot: null,
    };

    const id = await LH.db.add(STORE, match);
    return { ...match, id };
  }

  async function getByLeague(leagueId) {
    const matches = await LH.db.getAllByIndex(STORE, "leagueId", Number(leagueId));
    return matches.sort((a, b) => b.date - a.date);
  }

  async function getById(id) {
    return LH.db.get(STORE, Number(id));
  }

  async function update(id, changes) {
    const match = await getById(id);
    if (!match) throw new Error("Partido no encontrado.");
    if (match.status === "finished") {
      throw new Error("No se puede editar un partido finalizado.");
    }
    if (changes.date !== undefined) match.date = new Date(changes.date).getTime();
    if (changes.homeTeamId !== undefined) match.homeTeamId = Number(changes.homeTeamId);
    if (changes.awayTeamId !== undefined) match.awayTeamId = Number(changes.awayTeamId);

    await LH.db.put(STORE, match);
    return match;
  }

  async function remove(id) {
    const match = await getById(id);
    if (!match) throw new Error("Partido no encontrado.");
    if (match.status === "finished") {
      throw new Error("No se puede eliminar un partido finalizado. Primero debes deshacerlo.");
    }
    return LH.db.delete(STORE, Number(id));
  }

  async function hasMatchesForTeam(teamId) {
    teamId = Number(teamId);
    const [asHome, asAway] = await Promise.all([
      LH.db.getAllByIndex(STORE, "homeTeamId", teamId),
      LH.db.getAllByIndex(STORE, "awayTeamId", teamId),
    ]);
    return asHome.length > 0 || asAway.length > 0;
  }

  function buildRoundRobinRounds(teamIds) {
    const arr = teamIds.slice();
    if (arr.length % 2 !== 0) arr.push(null);
    const n = arr.length;
    const half = n / 2;
    const rounds = [];
    let current = arr.slice();

    for (let r = 0; r < n - 1; r++) {
      const roundPairs = [];
      for (let i = 0; i < half; i++) {
        const home = current[i];
        const away = current[n - 1 - i];
        if (home !== null && away !== null) roundPairs.push([home, away]);
      }
      rounds.push(roundPairs);

      const fixed = current[0];
      const rest = current.slice(1);
      rest.unshift(rest.pop());
      current = [fixed, ...rest];
    }
    return rounds;
  }

  async function generateFixture(leagueId) {
    const league = await LH.leagues.getById(leagueId);
    if (!league) throw new Error("Liga no encontrada.");
    if (league.mode !== "league") {
      throw new Error("El fixture automático solo aplica a la modalidad liga.");
    }

    const teams = await LH.teams.getByLeague(leagueId);
    if (teams.length < 2) {
      throw new Error("Se necesitan al menos 2 equipos para generar el fixture.");
    }

    const existing = await getByLeague(leagueId);
    if (existing.length > 0) {
      throw new Error("Esta liga ya tiene partidos generados.");
    }

    const teamIds = teams.map((t) => t.id);
    let rounds = buildRoundRobinRounds(teamIds);

    if (league.roundTrip) {
      const secondLeg = rounds.map((round) => round.map(([h, a]) => [a, h]));
      rounds = rounds.concat(secondLeg);
    }

    const baseDate = Date.now() + WEEK_MS;
    const toCreate = [];
    rounds.forEach((round, roundIndex) => {
      const roundDate = baseDate + roundIndex * WEEK_MS;
      round.forEach(([homeTeamId, awayTeamId]) => {
        toCreate.push({
          leagueId: Number(leagueId),
          homeTeamId,
          awayTeamId,
          date: roundDate,
          status: "scheduled",
          homeScore: null,
          awayScore: null,
          round: null,
          nextMatchId: null,
          nextMatchSlot: null,
        });
      });
    });

    await LH.db.transaction(["matches"], "readwrite", (stores) => {
      toCreate.forEach((m) => stores.matches.add(m));
    });

    return toCreate.length;
  }

  return {
    create,
    getByLeague,
    getById,
    update,
    remove,
    hasMatchesForTeam,
    generateFixture,
  };
})();
