window.LH = window.LH || {};

/** TeamService — CRUD de Team. Siempre filtrado por leagueId. */
class TeamService {
  #store = "teams";

  emptyStats() {
    return { pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0 };
  }

  async create(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre del equipo es obligatorio.");
    }
    if (!data.leagueId) {
      throw new Error("El equipo debe pertenecer a una liga.");
    }

    const existing = await this.getByLeague(data.leagueId);
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
      stats: this.emptyStats(),
    };

    const id = await LH.db.add(this.#store, team);
    return { ...team, id };
  }

  async getByLeague(leagueId) {
    const teams = await LH.db.getAllByIndex(this.#store, "leagueId", Number(leagueId));
    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id) {
    return LH.db.get(this.#store, Number(id));
  }

  async update(id, changes) {
    const team = await this.getById(id);
    if (!team) throw new Error("Equipo no encontrado.");

    if (changes.name !== undefined) {
      const newName = changes.name.trim();
      const siblings = await this.getByLeague(team.leagueId);
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

    await LH.db.put(this.#store, team);
    return team;
  }

  /**
   * Elimina el equipo. Si tiene jugadores, se eliminan en cascada dentro
   * de la misma transacción. El bloqueo por "tiene partidos" vive en la
   * vista (consulta LH.matches.hasMatchesForTeam antes de llamar a esto).
   */
  async removeCascade(id) {
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
}

LH.teams = new TeamService();
LH.TeamService = TeamService;
