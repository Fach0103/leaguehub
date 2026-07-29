/**
 * Vista: Jugadores (#players)
 * CRUD de jugadores de todos los equipos de la liga activa, con filtros
 * por nombre (debounce), equipo y posición.
 */
window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.players = async function (root) {
  root.innerHTML = '<p class="lh-card__meta">Cargando…</p>';

  const league = await LH.leagues.getActive();
  if (!league) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>No hay liga activa</h2>
        <p>Crea o activa una liga para poder gestionar sus jugadores.</p>
        <a class="btn" href="#leagues">Ir a Ligas</a>
      </div>`;
    return;
  }

  let editingPlayer = null;
  let filters = { search: "", teamId: "", position: "" };
  let teams = [];
  let allPlayers = []; // jugadores de la liga activa, con su equipo adjunto

  async function loadData() {
    teams = await LH.teams.getByLeague(league.id);
    const perTeam = await Promise.all(teams.map((t) => LH.players.getByTeam(t.id)));
    allPlayers = [];
    teams.forEach((t, i) => {
      perTeam[i].forEach((p) => allPlayers.push({ ...p, team: t }));
    });
  }

  function distinctPositions() {
    return Array.from(new Set(allPlayers.map((p) => p.position).filter(Boolean))).sort();
  }

  function applyFilters() {
    return allPlayers.filter((p) => {
      if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.teamId && p.teamId !== Number(filters.teamId)) return false;
      if (filters.position && p.position !== filters.position) return false;
      return true;
    });
  }

  function paint() {
    const esc = LH.utils.escapeHtml;
    const teamOptions = teams
      .map(
        (t) =>
          `<option value="${t.id}" ${filters.teamId === String(t.id) ? "selected" : ""}>${esc(t.name)}</option>`
      )
      .join("");
    const positionOptions = distinctPositions()
      .map((pos) => `<option value="${esc(pos)}" ${filters.position === pos ? "selected" : ""}>${esc(pos)}</option>`)
      .join("");

    root.innerHTML = `
      <div class="lh-toolbar">
        <h2>Jugadores — ${esc(league.name)}</h2>
        <button class="btn" id="btn-new-player" type="button" ${teams.length === 0 ? "disabled" : ""}>+ Nuevo jugador</button>
      </div>
      ${teams.length === 0 ? '<p class="lh-card__meta">Primero crea al menos un equipo en <a href="#teams">Equipos</a>.</p>' : ""}
      <div class="lh-filters">
        <input type="search" id="f-search" placeholder="Buscar por nombre…" value="${esc(filters.search)}" />
        <select id="f-team"><option value="">Todos los equipos</option>${teamOptions}</select>
        <select id="f-position"><option value="">Todas las posiciones</option>${positionOptions}</select>
        <button class="btn btn-outline" id="btn-clear-filters" type="button">Limpiar filtros</button>
      </div>
      <div id="player-form-container"></div>
      <div id="player-grid" class="lh-grid"></div>
    `;

    const grid = root.querySelector("#player-grid");
    const filtered = applyFilters();
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="view-empty">
          <h3>Sin resultados</h3>
          <p>No hay jugadores que coincidan con los filtros aplicados.</p>
        </div>`;
    } else {
      filtered.forEach((p) => {
        const card = document.createElement("player-card");
        card.player = p;
        card.team = p.team;
        card.addEventListener("lh:action", onCardAction);
        grid.appendChild(card);
      });
    }

    root.querySelector("#f-search").addEventListener(
      "input",
      LH.utils.debounce((e) => {
        filters.search = e.target.value;
        paint();
      }, 350)
    );
    root.querySelector("#f-team").addEventListener("change", (e) => {
      filters.teamId = e.target.value;
      paint();
    });
    root.querySelector("#f-position").addEventListener("change", (e) => {
      filters.position = e.target.value;
      paint();
    });
    root.querySelector("#btn-clear-filters").addEventListener("click", () => {
      filters = { search: "", teamId: "", position: "" };
      paint();
    });

    if (teams.length > 0) {
      root.querySelector("#btn-new-player").addEventListener("click", () => {
        editingPlayer = null;
        renderForm();
      });
    }
  }

  async function onCardAction(e) {
    const { action, player } = e.detail;

    if (action === "view") {
      window.location.hash = `#player/${player.id}`;
    } else if (action === "edit") {
      editingPlayer = player;
      renderForm();
    } else if (action === "delete") {
      const ok = await LH.ui.confirm({
        title: "Eliminar jugador",
        message: `Se eliminará a "${player.name}". Esta acción no se puede deshacer.`,
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      try {
        await LH.players.remove(player.id);
        LH.ui.toast("Jugador eliminado", "success");
        await loadData();
        paint();
      } catch (err) {
        LH.ui.toast(err.message || "No se pudo eliminar el jugador", "error");
      }
    }
  }

  function renderForm() {
    const container = root.querySelector("#player-form-container");
    const isEdit = !!editingPlayer;
    const esc = LH.utils.escapeHtml;
    const teamOptions = teams
      .map(
        (t) =>
          `<option value="${t.id}" ${isEdit && editingPlayer.teamId === t.id ? "selected" : ""}>${esc(t.name)}</option>`
      )
      .join("");

    container.innerHTML = `
      <form class="lh-form-panel" id="player-form">
        <h3>${isEdit ? "Editar jugador" : "Nuevo jugador"}</h3>
        <div class="lh-form-grid">
          <div class="lh-field">
            <label for="f-name">Nombre</label>
            <input id="f-name" name="name" required value="${isEdit ? esc(editingPlayer.name) : ""}" />
          </div>
          <div class="lh-field">
            <label for="f-team">Equipo</label>
            <select id="f-team" name="teamId" required>${teamOptions}</select>
          </div>
          <div class="lh-field">
            <label for="f-number">Número</label>
            <input id="f-number" name="number" type="number" min="0" required value="${isEdit ? editingPlayer.number : ""}" />
          </div>
          <div class="lh-field">
            <label for="f-position">Posición</label>
            <input id="f-position" name="position" value="${isEdit ? esc(editingPlayer.position) : ""}" placeholder="Ej: Delantero" />
          </div>
          <div class="lh-field lh-field--full">
            <label for="f-photo">Foto (URL, opcional)</label>
            <input id="f-photo" name="photo" value="${isEdit ? esc(editingPlayer.photo) : ""}" placeholder="https://…" />
          </div>
        </div>
        <p class="lh-field-error" id="form-error" hidden></p>
        <div class="lh-form-actions">
          <button class="btn" type="submit">${isEdit ? "Guardar cambios" : "Crear jugador"}</button>
          <button class="btn btn-outline" type="button" id="btn-cancel-form">Cancelar</button>
        </div>
      </form>
    `;

    container.querySelector("#btn-cancel-form").addEventListener("click", () => {
      container.innerHTML = "";
    });

    container.querySelector("#player-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errorEl = container.querySelector("#form-error");
      errorEl.hidden = true;

      try {
        const payload = {
          name: fd.get("name"),
          teamId: fd.get("teamId"),
          number: fd.get("number"),
          position: fd.get("position"),
          photo: fd.get("photo"),
        };
        if (isEdit) {
          await LH.players.update(editingPlayer.id, payload);
          LH.ui.toast("Jugador actualizado", "success");
        } else {
          await LH.players.create(payload);
          LH.ui.toast("Jugador creado", "success");
        }
        container.innerHTML = "";
        editingPlayer = null;
        await loadData();
        paint();
      } catch (err) {
        errorEl.textContent = err.message || "Ocurrió un error al guardar.";
        errorEl.hidden = false;
      }
    });
  }

  await loadData();
  paint();
};
