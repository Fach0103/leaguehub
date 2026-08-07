window.LH = window.LH || {};

/** PlayerService — CRUD de Player. Siempre asociado a un teamId. */
class PlayerService {
  #store = "players";

  emptyStats() {
    return { pj: 0, goals: 0 };
  }

  async create(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre del jugador es obligatorio.");
    }
    if (!data.teamId) {
      throw new Error("El jugador debe pertenecer a un equipo.");
    }
    if (data.number === undefined || data.number === null || data.number === "") {
      throw new Error("El número del jugador es obligatorio.");
    }

    const teammates = await this.getByTeam(data.teamId);
    const numberTaken = teammates.some((p) => p.number === Number(data.number));
    if (numberTaken) {
      throw new Error("Ese número ya está asignado a otro jugador del equipo.");
    }

    const player = {
      teamId: Number(data.teamId),
      name: data.name.trim(),
      photo: data.photo || "",
      position: data.position || "",
      number: Number(data.number),
      stats: this.emptyStats(),
    };

    const id = await LH.db.add(this.#store, player);
    return { ...player, id };
  }

  async getByTeam(teamId) {
    const players = await LH.db.getAllByIndex(this.#store, "teamId", Number(teamId));
    return players.sort((a, b) => a.number - b.number);
  }

  async getAll() {
    const players = await LH.db.getAll(this.#store);
    return players.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getById(id) {
    return LH.db.get(this.#store, Number(id));
  }

  async update(id, changes) {
    const player = await this.getById(id);
    if (!player) throw new Error("Jugador no encontrado.");

    const targetTeamId = changes.teamId !== undefined ? Number(changes.teamId) : player.teamId;
    if (changes.number !== undefined) {
      const teammates = await this.getByTeam(targetTeamId);
      const numberTaken = teammates.some(
        (p) => p.id !== player.id && p.number === Number(changes.number)
      );
      if (numberTaken) {
        throw new Error("Ese número ya está asignado a otro jugador del equipo.");
      }
      player.number = Number(changes.number);
    }

    if (changes.name !== undefined) player.name = changes.name.trim();
    if (changes.photo !== undefined) player.photo = changes.photo;
    if (changes.position !== undefined) player.position = changes.position;
    if (changes.teamId !== undefined) player.teamId = targetTeamId;

    await LH.db.put(this.#store, player);
    return player;
  }

  /** Bloquea el borrado si el jugador tiene eventos registrados (sección 4.5.4). */
  async remove(id) {
    const hasEvents = await LH.events.hasEventsForPlayer(id);
    if (hasEvents) {
      throw new Error("No se puede eliminar: el jugador tiene anotaciones registradas en partidos.");
    }
    return LH.db.delete(this.#store, Number(id));
  }
}

LH.players = new PlayerService();
LH.PlayerService = PlayerService;
