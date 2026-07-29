/**
 * leagues.js
 * CRUD de la entidad League + activar liga + borrado en cascada.
 * Nadie fuera de este archivo debería tocar el store "leagues" directamente.
 */
window.LH = window.LH || {};
LH.leagues = (function () {
  "use strict";

  const STORE = "leagues";

  /**
   * @param {Object} data { name, sport, mode, season, description,
   *                         roundTrip?, bracketSize? }
   */
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

  /** Solo nombre, temporada y descripción son editables tras crear la liga. */
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

  /**
   * Elimina la liga y, en cascada, todos sus equipos, jugadores, partidos
   * y eventos — todo dentro de UNA sola transacción (sección 4.2.4).
   *
   * Importante: todo el trabajo se encadena con cursores dentro de los
   * callbacks onsuccess de la MISMA transacción. No se usa async/await
   * con operaciones ajenas a ella (fetch, setTimeout, etc.), porque eso
   * arriesgaría que IndexedDB cierre la transacción antes de tiempo.
   */
  async function removeCascade(id) {
    id = Number(id);
    await LH.db.transaction(
      ["leagues", "teams", "players", "matches", "events"],
      "readwrite",
      (stores) => deleteLeagueContents(stores, id)
    );
    // Si borramos la liga activa, limpiamos la referencia guardada.
    if (localStorage.getItem("lh:activeLeagueId") === String(id)) {
      localStorage.removeItem("lh:activeLeagueId");
    }
  }

  function deleteLeagueContents(stores, leagueId) {
    stores.leagues.delete(leagueId);

    // Equipos de la liga -> jugadores de cada equipo.
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

    // Partidos de la liga -> eventos de cada partido.
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

  /**
   * Activa una liga y desactiva cualquier otra, en una sola transacción
   * sobre el store "leagues" (operación de integridad de sección 4.2.3).
   */
  async function setActive(id) {
    id = Number(id);
    await LH.db.transaction([STORE], "readwrite", (stores) => {
      const store = stores.leagues;
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) return; // fin del recorrido
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
    // Fallback: buscar por índice isActive en la BD (por si localStorage
    // se perdió pero la BD sigue teniendo una liga marcada como activa).
    const all = await getAll();
    return all.find((l) => l.isActive) || null;
  }

  return { create, getAll, getById, update, removeCascade, setActive, getActive };
})();
