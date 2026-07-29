/**
 * Vista: Partidos (#matches)
 * Modalidad liga: creación manual + botón "Generar fixture".
 * Modalidad eliminación directa: solo lectura aquí (el bracket se genera
 * y gestiona desde #stats en la Fase 6); por ahora mostramos aviso.
 */
window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.matches = async function (root) {
  root.innerHTML = '<p class="lh-card__meta">Cargando…</p>';

  const league = await LH.leagues.getActive();
  if (!league) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>No hay liga activa</h2>
        <p>Crea o activa una liga para poder gestionar sus partidos.</p>
        <a class="btn" href="#leagues">Ir a Ligas</a>
      </div>`;
    return;
  }

  let editingMatch = null;
  let teams = [];
  let teamsById = {};
  let allMatches = [];
  let filters = { status: "", teamId: "", from: "", to: "" };

  async function loadData() {
    teams = await LH.teams.getByLeague(league.id);
    teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
    allMatches = await LH.matches.getByLeague(league.id);
  }

  function applyFilters() {
    return allMatches.filter((m) => {
      if (filters.status && m.status !== filters.status) return false;
      if (filters.teamId) {
        const tid = Number(filters.teamId);
        if (m.homeTeamId !== tid && m.awayTeamId !== tid) return false;
      }
      if (filters.from && m.date < new Date(filters.from).getTime()) return false;
      if (filters.to && m.date > new Date(filters.to).getTime() + 86399999) return false;
      return true;
    });
  }

  function paint() {
    const esc = LH.utils.escapeHtml;
    const isLeagueMode = league.mode === "league";

    const teamOptions = teams
      .map(
        (t) =>
          `<option value="${t.id}" ${filters.teamId === String(t.id) ? "selected" : ""}>${esc(t.name)}</option>`
      )
      .join("");

    root.innerHTML = `
      <div class="lh-toolbar">
        <h2>Partidos — ${esc(league.name)}</h2>
        <div style="display:flex; gap:8px;">
          ${
            isLeagueMode
              ? `<button class="btn btn-outline" id="btn-generate-fixture" type="button" ${
                  allMatches.length > 0 || teams.length < 2 ? "disabled" : ""
                }>Generar fixture</button>
                 <button class="btn" id="btn-new-match" type="button" ${teams.length < 2 ? "disabled" : ""}>+ Nuevo partido</button>`
              : ""
          }
        </div>
      </div>
      ${
        !isLeagueMode
          ? '<p class="lh-card__meta">Esta liga es de eliminación directa: el bracket se genera desde la vista Ligas y se administra en Estadísticas (disponible en una fase posterior).</p>'
          : ""
      }
      ${
        isLeagueMode && teams.length < 2
          ? '<p class="lh-card__meta">Necesitas al menos 2 equipos en <a href="#teams">Equipos</a> antes de programar partidos.</p>'
          : ""
      }
      <div class="lh-filters">
        <select id="f-status">
          <option value="">Todos los estados</option>
          <option value="scheduled" ${filters.status === "scheduled" ? "selected" : ""}>Programados</option>
          <option value="finished" ${filters.status === "finished" ? "selected" : ""}>Finalizados</option>
        </select>
        <select id="f-team"><option value="">Todos los equipos</option>${teamOptions}</select>
        <input type="date" id="f-from" value="${filters.from}" title="Desde" />
        <input type="date" id="f-to" value="${filters.to}" title="Hasta" />
        <button class="btn btn-outline" id="btn-clear-filters" type="button">Limpiar filtros</button>
      </div>
      <div id="match-form-container"></div>
      <div id="match-grid" class="lh-grid"></div>
    `;

    const grid = root.querySelector("#match-grid");
    const filtered = applyFilters();
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="view-empty">
          <h3>Sin partidos</h3>
          <p>${allMatches.length === 0 ? "Todavía no hay partidos en esta liga." : "Ningún partido coincide con los filtros."}</p>
        </div>`;
    } else {
      filtered.forEach((m) => {
        const card = document.createElement("match-card");
        card.homeTeam = teamsById[m.homeTeamId];
        card.awayTeam = teamsById[m.awayTeamId];
        card.match = m;
        card.addEventListener("lh:action", onCardAction);
        grid.appendChild(card);
      });
    }

    root.querySelector("#f-status").addEventListener("change", (e) => {
      filters.status = e.target.value;
      paint();
    });
    root.querySelector("#f-team").addEventListener("change", (e) => {
      filters.teamId = e.target.value;
      paint();
    });
    root.querySelector("#f-from").addEventListener("change", (e) => {
      filters.from = e.target.value;
      paint();
    });
    root.querySelector("#f-to").addEventListener("change", (e) => {
      filters.to = e.target.value;
      paint();
    });
    root.querySelector("#btn-clear-filters").addEventListener("click", () => {
      filters = { status: "", teamId: "", from: "", to: "" };
      paint();
    });

    if (isLeagueMode) {
      const newBtn = root.querySelector("#btn-new-match");
      if (newBtn) {
        newBtn.addEventListener("click", () => {
          editingMatch = null;
          renderForm();
        });
      }
      const fixtureBtn = root.querySelector("#btn-generate-fixture");
      if (fixtureBtn) {
        fixtureBtn.addEventListener("click", onGenerateFixture);
      }
    }
  }

  async function onGenerateFixture() {
    const legs = league.roundTrip ? "ida y vuelta" : "una vuelta";
    const ok = await LH.ui.confirm({
      title: "Generar fixture",
      message: `Se generarán automáticamente todos los partidos de la liga (${legs}) para los ${teams.length} equipos registrados.`,
      confirmLabel: "Generar",
    });
    if (!ok) return;
    try {
      const count = await LH.matches.generateFixture(league.id);
      LH.ui.toast(`Se generaron ${count} partidos`, "success");
      await loadData();
      paint();
    } catch (err) {
      LH.ui.toast(err.message || "No se pudo generar el fixture", "error");
    }
  }

  async function onCardAction(e) {
    const { action, match } = e.detail;

    if (action === "view") {
      window.location.hash = `#match/${match.id}`;
    } else if (action === "edit") {
      editingMatch = match;
      renderForm();
    } else if (action === "delete") {
      const ok = await LH.ui.confirm({
        title: "Eliminar partido",
        message: "Se eliminará este partido programado.",
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      try {
        await LH.matches.remove(match.id);
        LH.ui.toast("Partido eliminado", "success");
        await loadData();
        paint();
      } catch (err) {
        LH.ui.toast(err.message || "No se pudo eliminar el partido", "error");
      }
    }
  }

  function toDatetimeLocal(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function renderForm() {
    const container = root.querySelector("#match-form-container");
    const isEdit = !!editingMatch;
    const esc = LH.utils.escapeHtml;

    const teamOptionsFor = (selectedId) =>
      teams
        .map((t) => `<option value="${t.id}" ${selectedId === t.id ? "selected" : ""}>${esc(t.name)}</option>`)
        .join("");

    container.innerHTML = `
      <form class="lh-form-panel" id="match-form">
        <h3>${isEdit ? "Editar partido" : "Nuevo partido"}</h3>
        <div class="lh-form-grid">
          <div class="lh-field">
            <label for="f-home">Equipo local</label>
            <select id="f-home" name="homeTeamId" required>${teamOptionsFor(isEdit ? editingMatch.homeTeamId : null)}</select>
          </div>
          <div class="lh-field">
            <label for="f-away">Equipo visitante</label>
            <select id="f-away" name="awayTeamId" required>${teamOptionsFor(isEdit ? editingMatch.awayTeamId : null)}</select>
          </div>
          <div class="lh-field">
            <label for="f-date">Fecha y hora</label>
            <input id="f-date" name="date" type="datetime-local" required value="${isEdit ? toDatetimeLocal(editingMatch.date) : ""}" />
          </div>
        </div>
        <p class="lh-field-error" id="form-error" hidden></p>
        <div class="lh-form-actions">
          <button class="btn" type="submit">${isEdit ? "Guardar cambios" : "Programar partido"}</button>
          <button class="btn btn-outline" type="button" id="btn-cancel-form">Cancelar</button>
        </div>
      </form>
    `;

    container.querySelector("#btn-cancel-form").addEventListener("click", () => {
      container.innerHTML = "";
    });

    container.querySelector("#match-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errorEl = container.querySelector("#form-error");
      errorEl.hidden = true;

      try {
        const payload = {
          leagueId: league.id,
          homeTeamId: fd.get("homeTeamId"),
          awayTeamId: fd.get("awayTeamId"),
          date: fd.get("date"),
        };
        if (isEdit) {
          await LH.matches.update(editingMatch.id, payload);
          LH.ui.toast("Partido actualizado", "success");
        } else {
          await LH.matches.create(payload);
          LH.ui.toast("Partido programado", "success");
        }
        container.innerHTML = "";
        editingMatch = null;
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
