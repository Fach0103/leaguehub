/**
 * teams.js
 * CRUD de la entidad Team. Siempre filtrada por leagueId.
 */
window.LH = window.LH || {};
LH.teams = (function () {
  "use strict";

  const STORE = "teams";

  /**
   * stats agregadas del equipo. Empiezan en cero y las va tocando
   * matchOperations.js (Fase 4), nunca se calculan "a mano" desde la UI.
   */
  function emptyStats() {
    return { pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0 };
  }

  async function create(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre del equipo es obligatorio.");
    }
    if (!data.leagueId) {
      throw new Error("El equipo debe pertenecer a una liga.");
    }

    const existing = await getByLeague(data.leagueId);
    const nameTaken = existing.some(
      (t) => t.name.toLowerCase() === data.name.trim().toLowerCase()
    );
    if (nameTaken) {
      throw new Error("Ya existe un equipo con ese nombre en esta liga.");
    }

    const team = {
      leagueId: Number(data.leagueId),
      name: data.name.trim(),
      crest: data.crest || "",
      colorPrimary: data.colorPrimary || "#333333",
      colorSecondary: data.colorSecondary || "#ffffff",
      city: data.city || "",
      stats: emptyStats(),
    };

    const id = await LH.db.add(STORE, team);
    return { ...team, id };
  }

  async function getByLeague(leagueId) {
    const teams = await LH.db.getAllByIndex(STORE, "leagueId", Number(leagueId));
    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function getById(id) {
    return LH.db.get(STORE, Number(id));
  }

  async function update(id, changes) {
    const team = await getById(id);
    if (!team) throw new Error("Equipo no encontrado.");

    if (changes.name !== undefined) {
      const newName = changes.name.trim();
      const siblings = await getByLeague(team.leagueId);
      const nameTaken = siblings.some(
        (t) => t.id !== team.id && t.name.toLowerCase() === newName.toLowerCase()
      );
      if (nameTaken) throw new Error("Ya existe un equipo con ese nombre en esta liga.");
      team.name = newName;
    }
    if (changes.crest !== undefined) team.crest = changes.crest;
    if (changes.colorPrimary !== undefined) team.colorPrimary = changes.colorPrimary;
    if (changes.colorSecondary !== undefined) team.colorSecondary = changes.colorSecondary;
    if (changes.city !== undefined) team.city = changes.city;

    await LH.db.put(STORE, team);
    return team;
  }

  /**
   * Elimina el equipo. Si tiene jugadores, se eliminan en cascada dentro
   * de la misma transacción (sección 4.3.3). El bloqueo por "tiene partidos
   * jugados o programados" se agrega en Fase 3, cuando exista matches.js
   * y por lo tanto algo que consultar.
   */
  async function removeCascade(id) {
    id = Number(id);
    await LH.db.transaction(["teams", "players"], "readwrite", (stores) => {
      stores.teams.delete(id);
      const cursorReq = stores.players.index("teamId").openCursor(IDBKeyRange.only(id));
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };
    });
  }

  return { create, getByLeague, getById, update, removeCascade, emptyStats };
})();
