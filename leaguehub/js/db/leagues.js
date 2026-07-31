window.LH = window.LH || {};
LH.leagues = (function () {
  "use strict";

  const STORE = "leagues";

  async function create(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre de la liga es obligatorio.");
    }
    if (!LH.SPORTS[data.sport]) {
      throw new Error("Deporte inválido.");
    }
    if (data.mode !== "league" && data.mode !== "knockout") {
      throw new Error("Modalidad inválida.");
    }
    if (data.mode === "knockout" && ![4, 8, 16].includes(Number(data.bracketSize))) {
      throw new Error("En eliminación directa el número de equipos debe ser 4, 8 o 16.");
    }

    const league = {
      name: data.name.trim(),
      sport: data.sport,
      mode: data.mode,
      season: data.season || "",
      description: data.description || "",
      roundTrip: data.mode === "league" ? !!data.roundTrip : null,
      bracketSize: data.mode === "knockout" ? Number(data.bracketSize) : null,
      isActive: false,
      createdAt: Date.now(),
    };

    try {
      const id = await LH.db.add(STORE, league);
      return { ...league, id };
    } catch (err) {
      if (err && err.name === "ConstraintError") {
        throw new Error("Ya existe una liga con ese nombre.");
      }
      throw err;
    }
  }

  async function getAll() {
    const leagues = await LH.db.getAll(STORE);
    return leagues.sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getById(id) {
    return LH.db.get(STORE, Number(id));
  }

  async function update(id, changes) {
    const league = await getById(id);
    if (!league) throw new Error("Liga no encontrada.");

    if (changes.name !== undefined) league.name = changes.name.trim();
    if (changes.season !== undefined) league.season = changes.season;
    if (changes.description !== undefined) league.description = changes.description;

    try {
      await LH.db.put(STORE, league);
      return league;
    } catch (err) {
      if (err && err.name === "ConstraintError") {
        throw new Error("Ya existe una liga con ese nombre.");
      }
      throw err;
    }
  }

  async function removeCascade(id) {
    id = Number(id);
    await LH.db.transaction(
      ["leagues", "teams", "players", "matches", "events"],
      "readwrite",
      (stores) => deleteLeagueContents(stores, id)
    );

    if (localStorage.getItem("lh:activeLeagueId") === String(id)) {
      localStorage.removeItem("lh:activeLeagueId");
    }
  }

  function deleteLeagueContents(stores, leagueId) {
    stores.leagues.delete(leagueId);

    const teamsCursorReq = stores.teams
      .index("leagueId")
      .openCursor(IDBKeyRange.only(leagueId));
    teamsCursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      const teamId = cursor.value.id;
      cursor.delete();

      const playersCursorReq = stores.players
        .index("teamId")
        .openCursor(IDBKeyRange.only(teamId));
      playersCursorReq.onsuccess = (ev) => {
        const pCursor = ev.target.result;
        if (!pCursor) return;
        pCursor.delete();
        pCursor.continue();
      };

      cursor.continue();
    };

    const matchesCursorReq = stores.matches
      .index("leagueId")
      .openCursor(IDBKeyRange.only(leagueId));
    matchesCursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      const matchId = cursor.value.id;
      cursor.delete();

      const eventsCursorReq = stores.events
        .index("matchId")
        .openCursor(IDBKeyRange.only(matchId));
      eventsCursorReq.onsuccess = (ev) => {
        const eCursor = ev.target.result;
        if (!eCursor) return;
        eCursor.delete();
        eCursor.continue();
      };

      cursor.continue();
    };
  }

  async function setActive(id) {
    id = Number(id);
    await LH.db.transaction([STORE], "readwrite", (stores) => {
      const store = stores.leagues;
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return;
        const record = cursor.value;
        const shouldBeActive = record.id === id;
        if (record.isActive !== shouldBeActive) {
          record.isActive = shouldBeActive;
          cursor.update(record);
        }
        cursor.continue();
      };
    });

    localStorage.setItem("lh:activeLeagueId", String(id));
  }

  async function getActive() {
    const storedId = localStorage.getItem("lh:activeLeagueId");
    if (storedId) {
      const league = await getById(Number(storedId));
      if (league && league.isActive) return league;
    }

    const all = await getAll();
    return all.find((l) => l.isActive) || null;
  }

  async function exportLeague(id) {
    id = Number(id);
    const league = await getById(id);
    if (!league) throw new Error("Liga no encontrada.");

    const [teams, matches] = await Promise.all([
      LH.teams.getByLeague(id),
      LH.matches.getByLeague(id),
    ]);

    const teamIds = teams.map((t) => t.id);
    const matchIds = matches.map((m) => m.id);
    const players = (await Promise.all(teamIds.map((tid) => LH.players.getByTeam(tid)))).flat();
    const events = (await Promise.all(matchIds.map((mid) => LH.events.getByMatch(mid)))).flat();

    return JSON.stringify({ league, teams, players, matches, events }, null, 2);
  }

  async function importLeague(jsonStr) {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error("El archivo JSON no es válido.");
    }

    if (!data.league || !data.league.name || !data.league.sport) {
      throw new Error("Estructura JSON inválida: falta la liga o sus campos obligatorios.");
    }

    const allLeagues = await getAll();
    const nameExists = allLeagues.some((l) => l.name.toLowerCase() === data.league.name.toLowerCase());
    if (nameExists) {
      throw new Error(`Ya existe una liga con el nombre "${data.league.name}". Renómbrala o cancela la importación.`);
    }

    delete data.league.id;
    data.league.isActive = false;
    data.league.createdAt = Date.now();

    await LH.db.transaction(
      ["leagues", "teams", "players", "matches", "events"],
      "readwrite",
      (stores) => {
        const leagueReq = stores.leagues.add(data.league);

        leagueReq.onsuccess = () => {
          const leagueId = leagueReq.result;
          const oldToNewTeam = {};
          const oldToNewPlayer = {};
          const oldToNewMatch = {};

          const teamsToImport = data.teams || [];
          const playersToImport = data.players || [];
          const matchesToImport = data.matches || [];
          const eventsToImport = data.events || [];

          function insertEvents() {
            eventsToImport.forEach((ev) => {
              delete ev.id;
              const newMatchId = oldToNewMatch[ev.matchId];
              const newPlayerId = oldToNewPlayer[ev.playerId];
              const newTeamId = oldToNewTeam[ev.teamId];

              if (!newMatchId || !newPlayerId || !newTeamId) return;
              stores.events.add({
                matchId: newMatchId,
                playerId: newPlayerId,
                teamId: newTeamId,
                minute: ev.minute !== undefined ? ev.minute : null,
              });
            });
          }

          function afterTeamsInserted() {
            let pendingPlayers = playersToImport.length;
            let pendingMatches = matchesToImport.length;

            function maybeInsertEvents() {
              if (pendingPlayers === 0 && pendingMatches === 0) insertEvents();
            }

            if (pendingPlayers === 0 && pendingMatches === 0) {
              insertEvents();
              return;
            }

            playersToImport.forEach((p) => {
              const oldId = p.id;
              delete p.id;
              p.teamId = p.teamId ? oldToNewTeam[p.teamId] || null : null;
              const req = stores.players.add(p);
              req.onsuccess = () => {
                oldToNewPlayer[oldId] = req.result;
                pendingPlayers--;
                maybeInsertEvents();
              };
            });

            matchesToImport.forEach((m) => {
              const oldId = m.id;
              delete m.id;
              m.leagueId = leagueId;
              m.homeTeamId = m.homeTeamId ? oldToNewTeam[m.homeTeamId] || null : null;
              m.awayTeamId = m.awayTeamId ? oldToNewTeam[m.awayTeamId] || null : null;
              m.nextMatchId = null;
              const req = stores.matches.add(m);
              req.onsuccess = () => {
                oldToNewMatch[oldId] = req.result;
                pendingMatches--;
                maybeInsertEvents();
              };
            });
          }

          let pendingTeams = teamsToImport.length;
          if (pendingTeams === 0) {
            afterTeamsInserted();
            return;
          }

          teamsToImport.forEach((t) => {
            const oldId = t.id;
            delete t.id;
            t.leagueId = leagueId;
            const req = stores.teams.add(t);
            req.onsuccess = () => {
              oldToNewTeam[oldId] = req.result;
              pendingTeams--;
              if (pendingTeams === 0) afterTeamsInserted();
            };
          });
        };
      }
    );
  }

  return { create, getAll, getById, update, removeCascade, setActive, getActive, exportLeague, importLeague };
})();
