/**
 * Vista: Ligas (#leagues)
 * CRUD de ligas + activar liga. Export/Import JSON queda para Fase 8.
 */
window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.leagues = async function (root) {
  root.innerHTML = '<p class="lh-card__meta">Cargando ligas…</p>';

  let editingLeague = null; // null = modo creación

  async function refresh() {
    const leagues = await LH.leagues.getAll();
    paint(leagues);
  }

  function paint(leagues) {
    root.innerHTML = `
      <div class="lh-toolbar">
        <h2>Ligas</h2>
        <button class="btn" id="btn-new-league" type="button">+ Nueva liga</button>
      </div>
      <div id="league-form-container"></div>
      <div id="league-grid" class="lh-grid"></div>
    `;

    const grid = root.querySelector("#league-grid");
    if (leagues.length === 0) {
      grid.innerHTML = `
        <div class="view-empty">
          <h3>Todavía no creaste ninguna liga</h3>
          <p>Usa el botón "Nueva liga" para empezar.</p>
        </div>`;
    } else {
      leagues.forEach((l) => {
        const card = document.createElement("league-card");
        card.league = l;
        card.addEventListener("lh:action", onCardAction);
        grid.appendChild(card);
      });
    }

    root.querySelector("#btn-new-league").addEventListener("click", () => {
      editingLeague = null;
      renderForm();
    });
  }

  async function onCardAction(e) {
    const { action, league } = e.detail;

    if (action === "edit") {
      editingLeague = league;
      renderForm();
    } else if (action === "activate") {
      try {
        await LH.leagues.setActive(league.id);
        LH.ui.toast(`"${league.name}" ahora es la liga activa`, "success");
        window.location.hash = "#dashboard";
      } catch (err) {
        LH.ui.toast(err.message || "No se pudo activar la liga", "error");
      }
    } else if (action === "export") {
      // Fase 8: exportar liga completa a JSON.
      LH.ui.toast("La exportación se agrega en una fase posterior", "success");
    } else if (action === "delete") {
      const ok = await LH.ui.confirm({
        title: "Eliminar liga",
        message: `Se eliminará "${league.name}" junto con todos sus equipos, jugadores y partidos. Esta acción no se puede deshacer.`,
        confirmLabel: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      try {
        await LH.leagues.removeCascade(league.id);
        LH.ui.toast("Liga eliminada", "success");
        refresh();
      } catch (err) {
        LH.ui.toast(err.message || "No se pudo eliminar la liga", "error");
      }
    }
  }

  function renderForm() {
    const container = root.querySelector("#league-form-container");
    const isEdit = !!editingLeague;
    const esc = LH.utils.escapeHtml;

    const sportsOptions = Object.values(LH.SPORTS)
      .map(
        (s) =>
          `<option value="${s.key}" ${isEdit && editingLeague.sport === s.key ? "selected" : ""}>${s.icon} ${s.label}</option>`
      )
      .join("");

    container.innerHTML = `
      <form class="lh-form-panel" id="league-form">
        <h3>${isEdit ? "Editar liga" : "Nueva liga"}</h3>
        <div class="lh-form-grid">
          <div class="lh-field">
            <label for="f-name">Nombre</label>
            <input id="f-name" name="name" required value="${isEdit ? esc(editingLeague.name) : ""}" />
          </div>
          <div class="lh-field">
            <label for="f-sport">Deporte</label>
            <select id="f-sport" name="sport" ${isEdit ? "disabled" : ""} required>${sportsOptions}</select>
          </div>
          <div class="lh-field">
            <label for="f-mode">Modalidad</label>
            <select id="f-mode" name="mode" ${isEdit ? "disabled" : ""} required>
              <option value="league" ${isEdit && editingLeague.mode === "league" ? "selected" : ""}>Liga (todos contra todos)</option>
              <option value="knockout" ${isEdit && editingLeague.mode === "knockout" ? "selected" : ""}>Eliminación directa</option>
            </select>
          </div>
          <div class="lh-field" id="field-roundtrip">
            <label for="f-roundtrip">Vueltas</label>
            <select id="f-roundtrip" name="roundTrip" ${isEdit ? "disabled" : ""}>
              <option value="false" ${isEdit && !editingLeague.roundTrip ? "selected" : ""}>Una vuelta</option>
              <option value="true" ${isEdit && editingLeague.roundTrip ? "selected" : ""}>Ida y vuelta</option>
            </select>
          </div>
          <div class="lh-field" id="field-bracketsize" style="display:none">
            <label for="f-bracketsize">N° de equipos</label>
            <select id="f-bracketsize" name="bracketSize" ${isEdit ? "disabled" : ""}>
              <option value="4" ${isEdit && editingLeague.bracketSize === 4 ? "selected" : ""}>4</option>
              <option value="8" ${isEdit && editingLeague.bracketSize === 8 ? "selected" : ""}>8</option>
              <option value="16" ${isEdit && editingLeague.bracketSize === 16 ? "selected" : ""}>16</option>
            </select>
          </div>
          <div class="lh-field">
            <label for="f-season">Temporada</label>
            <input id="f-season" name="season" required value="${isEdit ? esc(editingLeague.season) : ""}" placeholder="2026-I" />
          </div>
          <div class="lh-field lh-field--full">
            <label for="f-description">Descripción</label>
            <textarea id="f-description" name="description" rows="2">${isEdit ? esc(editingLeague.description) : ""}</textarea>
          </div>
        </div>
        ${isEdit ? '<p class="lh-card__meta">El deporte y la modalidad no se pueden cambiar una vez creada la liga.</p>' : ""}
        <p class="lh-field-error" id="form-error" hidden></p>
        <div class="lh-form-actions">
          <button class="btn" type="submit">${isEdit ? "Guardar cambios" : "Crear liga"}</button>
          <button class="btn btn-outline" type="button" id="btn-cancel-form">Cancelar</button>
        </div>
      </form>
    `;

    const modeSelect = container.querySelector("#f-mode");
    const roundtripField = container.querySelector("#field-roundtrip");
    const bracketField = container.querySelector("#field-bracketsize");

    function syncModeFields() {
      const mode = modeSelect.value;
      roundtripField.style.display = mode === "league" ? "" : "none";
      bracketField.style.display = mode === "knockout" ? "" : "none";
    }
    syncModeFields();
    modeSelect.addEventListener("change", syncModeFields);

    container.querySelector("#btn-cancel-form").addEventListener("click", () => {
      container.innerHTML = "";
    });

    container.querySelector("#league-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errorEl = container.querySelector("#form-error");
      errorEl.hidden = true;

      try {
        if (isEdit) {
          await LH.leagues.update(editingLeague.id, {
            name: fd.get("name"),
            season: fd.get("season"),
            description: fd.get("description"),
          });
          LH.ui.toast("Liga actualizada", "success");
        } else {
          await LH.leagues.create({
            name: fd.get("name"),
            sport: fd.get("sport"),
            mode: fd.get("mode"),
            roundTrip: fd.get("roundTrip") === "true",
            bracketSize: fd.get("bracketSize"),
            season: fd.get("season"),
            description: fd.get("description"),
          });
          LH.ui.toast("Liga creada", "success");
        }
        container.innerHTML = "";
        editingLeague = null;
        refresh();
      } catch (err) {
        errorEl.textContent = err.message || "Ocurrió un error al guardar.";
        errorEl.hidden = false;
      }
    });
  }

  refresh();
};
