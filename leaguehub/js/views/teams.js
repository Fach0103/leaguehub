/**
 * Vista: Equipos (#teams)
 * CRUD de equipos de la liga activa. Requiere que haya una liga activa.
 */
window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.teams = async function (root) {
  root.innerHTML = '<p class="lh-card__meta">Cargando…</p>';

  const league = await LH.leagues.getActive();
  if (!league) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>No hay liga activa</h2>
        <p>Crea o activa una liga para poder gestionar sus equipos.</p>
        <a class="btn" href="#leagues">Ir a Ligas</a>
      </div>`;
    return;
  }

  let editingTeam = null;

  async function refresh() {
    const teams = await LH.teams.getByLeague(league.id);
    paint(teams);
  }

  function paint(teams) {
    const esc = LH.utils.escapeHtml;
    root.innerHTML = `
      <div class="lh-toolbar">
        <h2>Equipos — ${esc(league.name)}</h2>
        <button class="btn" id="btn-new-team" type="button">+ Nuevo equipo</button>
      </div>
      <div id="team-form-container"></div>
      <div id="team-grid" class="lh-grid"></div>
    `;

    const grid = root.querySelector("#team-grid");
    if (teams.length === 0) {
      grid.innerHTML = `
        <div class="view-empty">
          <h3>Todavía no hay equipos</h3>
          <p>Agrega el primero con el botón de arriba.</p>
        </div>`;
    } else {
      teams.forEach((t) => {
        const card = document.createElement("team-card");
        card.team = t;
        card.addEventListener("lh:action", onCardAction);
        grid.appendChild(card);
      });
    }

    root.querySelector("#btn-new-team").addEventListener("click", () => {
      editingTeam = null;
      renderForm();
    });
  }

  async function onCardAction(e) {
    const { action, team } = e.detail;

    if (action === "view") {
      window.location.hash = `#team/${team.id}`;
    } else if (action === "edit") {
      editingTeam = team;
      renderForm();
    } else if (action === "delete") {
      const hasMatches = await LH.matches.hasMatchesForTeam(team.id);
      if (hasMatches) {
        LH.ui.toast(
          "No se puede eliminar: el equipo tiene partidos programados o jugados.",
          "error"
        );
        return;
      }
      const ok = await LH.ui.confirm({
        title: "Eliminar equipo",
        message: `Se eliminará "${team.name}" y todos sus jugadores. Esta acción no se puede deshacer.`,
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      try {
        await LH.teams.removeCascade(team.id);
        LH.ui.toast("Equipo eliminado", "success");
        refresh();
      } catch (err) {
        LH.ui.toast(err.message || "No se pudo eliminar el equipo", "error");
      }
    }
  }

  function renderForm() {
    const container = root.querySelector("#team-form-container");
    const isEdit = !!editingTeam;
    const esc = LH.utils.escapeHtml;

    container.innerHTML = `
      <form class="lh-form-panel" id="team-form">
        <h3>${isEdit ? "Editar equipo" : "Nuevo equipo"}</h3>
        <div class="lh-form-grid">
          <div class="lh-field">
            <label for="f-name">Nombre</label>
            <input id="f-name" name="name" required value="${isEdit ? esc(editingTeam.name) : ""}" />
          </div>
          <div class="lh-field">
            <label for="f-city">Ciudad / Sede</label>
            <input id="f-city" name="city" value="${isEdit ? esc(editingTeam.city) : ""}" />
          </div>
          <div class="lh-field lh-field--full">
            <label for="f-crest">Escudo (URL, opcional)</label>
            <input id="f-crest" name="crest" value="${isEdit ? esc(editingTeam.crest) : ""}" placeholder="https://…" />
          </div>
          <div class="lh-field">
            <label for="f-colorPrimary">Color principal</label>
            <input id="f-colorPrimary" name="colorPrimary" type="color" value="${isEdit ? editingTeam.colorPrimary : "#333333"}" />
          </div>
          <div class="lh-field">
            <label for="f-colorSecondary">Color secundario</label>
            <input id="f-colorSecondary" name="colorSecondary" type="color" value="${isEdit ? editingTeam.colorSecondary : "#ffffff"}" />
          </div>
        </div>
        <p class="lh-field-error" id="form-error" hidden></p>
        <div class="lh-form-actions">
          <button class="btn" type="submit">${isEdit ? "Guardar cambios" : "Crear equipo"}</button>
          <button class="btn btn-outline" type="button" id="btn-cancel-form">Cancelar</button>
        </div>
      </form>
    `;

    container.querySelector("#btn-cancel-form").addEventListener("click", () => {
      container.innerHTML = "";
    });

    container.querySelector("#team-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errorEl = container.querySelector("#form-error");
      errorEl.hidden = true;

      try {
        const payload = {
          name: fd.get("name"),
          city: fd.get("city"),
          crest: fd.get("crest"),
          colorPrimary: fd.get("colorPrimary"),
          colorSecondary: fd.get("colorSecondary"),
          leagueId: league.id,
        };
        if (isEdit) {
          await LH.teams.update(editingTeam.id, payload);
          LH.ui.toast("Equipo actualizado", "success");
        } else {
          await LH.teams.create(payload);
          LH.ui.toast("Equipo creado", "success");
        }
        container.innerHTML = "";
        editingTeam = null;
        refresh();
      } catch (err) {
        errorEl.textContent = err.message || "Ocurrió un error al guardar.";
        errorEl.hidden = false;
      }
    });
  }

  refresh();
};
