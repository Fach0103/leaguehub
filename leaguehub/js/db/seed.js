window.LH = window.LH || {};
LH.seed = (function () {
  "use strict";

  async function insertSampleData() {
    const existing = await LH.leagues.getAll();
    if (existing.length > 0) {
      throw new Error("Ya hay ligas creadas. Elimínalas primero o usa una base de datos limpia.");
    }

    const ligaData = {
      name: "Liga de Prueba",
      sport: "futbol",
      mode: "league",
      season: "2026-I",
      description: "Liga de prueba con datos de ejemplo",
      roundTrip: false,
    };
    const ligaId = (await LH.leagues.create(ligaData)).id;

    const equipos = [
      { name: "Los Halcones", city: "Buenos Aires", colorPrimary: "#c0392b", colorSecondary: "#ffffff" },
      { name: "Tiburones FC", city: "Mar del Plata", colorPrimary: "#2980b9", colorSecondary: "#ffffff" },
      { name: "Águilas Negras", city: "Córdoba", colorPrimary: "#2c3e50", colorSecondary: "#f1c40f" },
      { name: "Club Estrella", city: "Rosario", colorPrimary: "#27ae60", colorSecondary: "#ffffff" },
    ];

    const teamIds = [];
    for (const e of equipos) {
      const t = await LH.teams.create({ ...e, leagueId: ligaId });
      teamIds.push(t.id);
    }

    const jugadores = [
      { name: "Carlos López", number: 9, position: "Delantero" },
      { name: "Luis Martínez", number: 10, position: "Mediocampista" },
      { name: "Jorge Díaz", number: 1, position: "Arquero" },
      { name: "Pedro Gómez", number: 7, position: "Delantero" },
      { name: "Ana Torres", number: 8, position: "Mediocampista" },
      { name: "Sofía Ruiz", number: 5, position: "Defensora" },
    ];

    const playerIds = [];
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = 0; j < 2; j++) {
        const p = jugadores[(i * 2 + j) % jugadores.length];
        const created = await LH.players.create({ ...p, teamId: teamIds[i] });
        playerIds.push(created);
      }
    }

    await LH.matches.generateFixture(ligaId);

    const matches = await LH.matches.getByLeague(ligaId);
    if (matches.length >= 2) {
      const ev1 = [
        { teamId: matches[0].homeTeamId, playerId: playerIds[0], minute: 23 },
        { teamId: matches[0].homeTeamId, playerId: playerIds[1], minute: 45 },
        { teamId: matches[0].awayTeamId, playerId: playerIds[2], minute: 67 },
      ];
      await LH.matchOperations.finalizeMatch(matches[0].id, ev1);

      const ev2 = [
        { teamId: matches[1].homeTeamId, playerId: playerIds[3], minute: 12 },
        { teamId: matches[1].awayTeamId, playerId: playerIds[4], minute: 78 },
        { teamId: matches[1].awayTeamId, playerId: playerIds[5], minute: 90 },
      ];
      await LH.matchOperations.finalizeMatch(matches[1].id, ev2);
    }

    await LH.leagues.setActive(ligaId);

    const baskData = {
      name: "Torneo de Básquet",
      sport: "basquet",
      mode: "knockout",
      season: "2026",
      description: "Torneo de eliminación directa de básquet",
      bracketSize: 4,
    };
    const baskId = (await LH.leagues.create(baskData)).id;

    const baskTeams = [
      { name: "Dragones", colorPrimary: "#e65100", colorSecondary: "#ffffff" },
      { name: "Leones", colorPrimary: "#1565c0", colorSecondary: "#ffffff" },
      { name: "Panteras", colorPrimary: "#2e7d32", colorSecondary: "#ffffff" },
      { name: "Zorros", colorPrimary: "#6a1b9a", colorSecondary: "#ffffff" },
    ];

    const baskTeamIds = [];
    for (const t of baskTeams) {
      const bt = await LH.teams.create({ ...t, leagueId: baskId, city: "" });
      baskTeamIds.push(bt.id);
    }

    await LH.bracket.generate(baskId);

    return { ligaId, baskId, teamIds, playerIds };
  }

  return { insertSampleData };
})();
