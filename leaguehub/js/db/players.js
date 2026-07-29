/**
 * players.js
 * CRUD de la entidad Player. Siempre asociada a un teamId.
 */
window.LH = window.LH || {};
LH.players = (function () {
  "use strict";

  const STORE = "players";

  function emptyStats() {
    return { pj: 0, goals: 0 };
  }

  async function create(data) {
    if (!data.name || !data.name.trim()) {
      throw new Error("El nombre del jugador es obligatorio.");
    }
    if (!data.teamId) {
      throw new Error("El jugador debe pertenecer a un equipo.");
    }
    if (data.number === undefined || data.number === null || data.number === "") {
      throw new Error("El número del jugador es obligatorio.");
    }

    const teammates = await getByTeam(data.teamId);
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
      stats: emptyStats(),
    };

    const id = await LH.db.add(STORE, player);
    return { ...player, id };
  }

  async function getByTeam(teamId) {
    const players = await LH.db.getAllByIndex(STORE, "teamId", Number(teamId));
    return players.sort((a, b) => a.number - b.number);
  }

  async function getAll() {
    const players = await LH.db.getAll(STORE);
    return players.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function getById(id) {
    return LH.db.get(STORE, Number(id));
  }

  async function update(id, changes) {
    const player = await getById(id);
    if (!player) throw new Error("Jugador no encontrado.");

    const targetTeamId = changes.teamId !== undefined ? Number(changes.teamId) : player.teamId;
    if (changes.number !== undefined) {
      const teammates = await getByTeam(targetTeamId);
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

    await LH.db.put(STORE, player);
    return player;
  }

  /**
   * Bloquea la eliminación si el jugador tiene eventos registrados
   * (sección 4.5.4). Se completa en Fase 4 cuando exista events.js.
   */
  async function remove(id) {
    return LH.db.delete(STORE, Number(id));
  }

  return { create, getByTeam, getAll, getById, update, remove, emptyStats };
})();
