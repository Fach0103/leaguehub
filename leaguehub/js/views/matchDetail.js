window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.matchDetail = async function (root, params) {
  root.innerHTML = '<p class="lh-card__meta">Cargando…</p>';

  const matchId = Number(params.id);
  const match = await LH.matches.getById(matchId);
  if (!match) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>Partido no encontrado</h2>
        <a class="btn" href="#matches">← Volver a Partidos</a>
      </div>`;
    return;
  }

  const league = await LH.leagues.getById(match.leagueId);
  const isKnockout = league && league.mode === "knockout";
  let winnerTeamId = null;

  const [homeTeam, awayTeam] = await Promise.all([
    LH.teams.getById(match.homeTeamId),
    LH.teams.getById(match.awayTeamId),
  ]);
  const [homePlayers, awayPlayers] = await Promise.all([
    homeTeam ? LH.players.getByTeam(match.homeTeamId) : [],
    awayTeam ? LH.players.getByTeam(match.awayTeamId) : [],
  ]);
  const playersById = Object.fromEntries(
    [...homePlayers, ...awayPlayers].map((p) => [p.id, p])
  );

  const persisted = await LH.events.getByMatch(matchId);
  let draftEvents = persisted.map((ev) => ({
    teamId: ev.teamId,
    playerId: ev.playerId,
    minute: ev.minute,
  }));

  function paint() {
    const esc = LH.utils.escapeHtml;
    const isScheduled = match.status === "scheduled";
    const dateStr = new Date(match.date).toLocaleString("es", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const roundLabel = match.roundLabel ? `${match.roundLabel} · ` : "";
    const winnerSection = (isKnockout && isScheduled)
      ? `<div class="lh-field" id="winner-field">
          <label>Ganador (obligatorio si hay empate)</label>
          <select id="winner-select">
            <option value="">Seleccionar ganador…</option>
            ${homeTeam ? `<option value="${match.homeTeamId}">${esc(homeTeam.name)}</option>` : ""}
            ${awayTeam ? `<option value="${match.awayTeamId}">${esc(awayTeam.name)}</option>` : ""}
          </select>
        </div>`
      : "";

    root.innerHTML = `
      <a href="#matches" class="btn btn-outline lh-back-link">← Volver</a>

      <div class="lh-match-header">
        <div class="lh-match-header__team">${homeTeam ? esc(homeTeam.name) : "Por definir"}</div>
        <div class="lh-match-header__center">
          ${
            match.status === "finished"
              ? `<span class="score lh-match-header__score">${match.homeScore} - ${match.awayScore}</span>`
              : `<span class="lh-match-card__vs">vs</span>`
          }
          <p class="lh-card__meta">${roundLabel}${esc(dateStr)}</p>
          <p class="lh-match-card__status lh-match-card__status--${match.status}">
            ${match.status === "finished" ? "Finalizado" : "Programado"}
          </p>
        </div>
        <div class="lh-match-header__team">${awayTeam ? esc(awayTeam.name) : "Por definir"}</div>
      </div>
      ${winnerSection}

      <div class="lh-match-events">
        <div class="lh-match-events__col">
          <h3>${esc(homeTeam.name)}</h3>
          <ul id="events-home" class="lh-events-list"></ul>
        </div>
        <div class="lh-match-events__col">
          <h3>${esc(awayTeam.name)}</h3>
          <ul id="events-away" class="lh-events-list"></ul>
        </div>
      </div>

      ${isScheduled ? '<div id="event-form-slot"></div>' : ""}

      <div class="lh-form-actions">
        ${
          isScheduled
            ? '<button class="btn" id="btn-finalize" type="button">Finalizar partido</button>'
            : '<button class="btn btn-danger" id="btn-undo" type="button">Deshacer partido</button>'
        }
      </div>
      <p class="lh-field-error" id="op-error" hidden></p>
    `;

    paintEventsList();

    if (isScheduled) {
      const slot = root.querySelector("#event-form-slot");
      const form = document.createElement("event-form");
      form.homeTeam = homeTeam;
      form.awayTeam = awayTeam;
      form.homePlayers = homePlayers;
      form.awayPlayers = awayPlayers;
      form.addEventListener("lh:add-event", (e) => {
        draftEvents.push(e.detail);
        paintEventsList();
      });
      slot.appendChild(form);

      root.querySelector("#btn-finalize").addEventListener("click", onFinalize);
    } else {
      root.querySelector("#btn-undo").addEventListener("click", onUndo);
    }
  }

  function paintEventsList() {
    const esc = LH.utils.escapeHtml;
    const homeList = root.querySelector("#events-home");
    const awayList = root.querySelector("#events-away");
    if (!homeList || !awayList) return;

    const removable = match.status === "scheduled";

    function renderItem(ev, index) {
      const player = playersById[ev.playerId];
      const name = player ? player.name : "Jugador";
      const minuteStr =
        ev.minute !== null && ev.minute !== undefined && ev.minute !== "" ? ` (${ev.minute}')` : "";
      return `
        <li>
          <span>${esc(name)}${minuteStr}</span>
          ${removable ? `<button type="button" class="lh-event-remove" data-index="${index}" aria-label="Quitar anotación">✕</button>` : ""}
        </li>`;
    }

    const homeItems = [];
    const awayItems = [];
    draftEvents.forEach((ev, i) => {
      if (Number(ev.teamId) === Number(match.homeTeamId)) homeItems.push(renderItem(ev, i));
      else awayItems.push(renderItem(ev, i));
    });

    homeList.innerHTML = homeItems.length ? homeItems.join("") : '<li class="lh-card__meta">Sin anotaciones</li>';
    awayList.innerHTML = awayItems.length ? awayItems.join("") : '<li class="lh-card__meta">Sin anotaciones</li>';

    root.querySelectorAll(".lh-event-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        draftEvents.splice(Number(btn.dataset.index), 1);
        paintEventsList();
      });
    });
  }

  async function onFinalize() {
    const errorEl = root.querySelector("#op-error");
    errorEl.hidden = true;

    if (isKnockout) {
      const sel = root.querySelector("#winner-select");
      if (sel) winnerTeamId = sel.value ? Number(sel.value) : null;

      const homeScore = draftEvents.filter((ev) => Number(ev.teamId) === Number(match.homeTeamId)).length;
      const awayScore = draftEvents.filter((ev) => Number(ev.teamId) === Number(match.awayTeamId)).length;
      if (homeScore === awayScore && !winnerTeamId) {
        errorEl.textContent = "En eliminación directa debes declarar un ganador cuando hay empate.";
        errorEl.hidden = false;
        return;
      }
    }

    try {
      await LH.matchOperations.finalizeMatch(matchId, draftEvents, winnerTeamId);
      LH.ui.toast("Partido finalizado", "success");
      LH.views.matchDetail(root, params);
    } catch (err) {
      errorEl.textContent = err.message || "No se pudo finalizar el partido. Puedes reintentar.";
      errorEl.hidden = false;
      LH.ui.toast("Error al finalizar el partido", "error");
    }
  }

  async function onUndo() {
    const ok = await LH.ui.confirm({
      title: "Deshacer partido",
      message: "El partido vuelve a estado programado y se revierten las estadísticas de equipos y jugadores.",
      confirmLabel: "Deshacer",
      danger: true,
    });
    if (!ok) return;

    const errorEl = root.querySelector("#op-error");
    errorEl.hidden = true;
    try {
      await LH.matchOperations.undoMatch(matchId);
      LH.ui.toast("Partido deshecho", "success");
      LH.views.matchDetail(root, params);
    } catch (err) {
      errorEl.textContent = err.message || "No se pudo deshacer el partido.";
      errorEl.hidden = false;
      LH.ui.toast(err.message || "Error al deshacer el partido", "error");
    }
  }

  paint();
};
