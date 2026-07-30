window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.playerDetail = async function (root, params) {
  root.innerHTML = '<loading-state></loading-state>';

  const playerId = Number(params.id);
  const player = await LH.players.getById(playerId);
  if (!player) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>Jugador no encontrado</h2>
        <a class="btn" href="#players">← Volver a Jugadores</a>
      </div>`;
    return;
  }

  const [team, league] = await Promise.all([
    LH.teams.getById(player.teamId),
    LH.leagues.getActive(),
  ]);

  let teamsById = {};
  if (league) {
    const allTeams = await LH.teams.getByLeague(league.id);
    teamsById = Object.fromEntries(allTeams.map((t) => [t.id, t]));
  }

  const events = await LH.events.getByPlayer(playerId);
  const matchIds = [...new Set(events.map((ev) => ev.matchId))];
  const matches = (await Promise.all(matchIds.map((id) => LH.matches.getById(id)))).filter(Boolean);
  const finishedMatches = matches.filter((m) => m.status === "finished").sort((a, b) => b.date - a.date);

  const gamesPlayed = new Set(events.map((ev) => ev.matchId)).size;
  const totalGoals = player.stats.goals;

  function paint() {
    const esc = LH.utils.escapeHtml;
    const terms = LH.getSportTerms(league ? league.sport : "futbol");

    const photoHtml = player.photo
      ? `<img src="${esc(player.photo)}" alt="" class="lh-player-detail__photo" />`
      : `<span class="lh-player-detail__photo lh-player-detail__photo--placeholder">${esc(LH.utils.initials(player.name))}</span>`;

    const avg = gamesPlayed > 0 ? (totalGoals / gamesPlayed).toFixed(2) : "0";

    const historyHtml = finishedMatches.length === 0
      ? '<p class="lh-card__meta">Sin anotaciones registradas en partidos.</p>'
      : finishedMatches.map((m) => {
          const evCount = events.filter((ev) => ev.matchId === m.id).length;
          const isHome = m.homeTeamId === player.teamId;
      const rivalId = isHome ? m.awayTeamId : m.homeTeamId;
      const rivalName = teamsById[rivalId] ? teamsById[rivalId].name : "?";
          return `
            <div class="lh-player-detail__match-row" data-match-id="${m.id}" tabindex="0" role="link">
              <span>${esc(rivalName)}</span>
              <span class="score">${m.homeScore} - ${m.awayScore}</span>
              <span>${evCount} ${esc(terms.scoringEvent)}${evCount !== 1 ? "s" : ""}</span>
              <span class="lh-card__meta">${new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })}</span>
            </div>`;
        }).join("");

    root.innerHTML = `
      <a href="#players" class="btn btn-outline lh-back-link">← Volver</a>

      <div class="lh-player-detail">
        <header class="lh-player-detail__header">
          ${photoHtml}
          <div>
            <h2>#${player.number} ${esc(player.name)}</h2>
            <p class="lh-card__meta">${esc(player.position || "Sin posición")} · ${team ? esc(team.name) : "Sin equipo"}</p>
          </div>
          <div class="lh-player-detail__stats">
            <div class="lh-team-detail__stat"><span class="lh-card__meta">PJ</span><strong>${gamesPlayed}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">${esc(terms.scoringEventPlural)}</span><strong>${totalGoals}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">Prom.</span><strong>${avg}</strong></div>
          </div>
        </header>

        <h3>${terms.scorersLabel} en partidos</h3>
        <div class="lh-player-detail__history">${historyHtml}</div>

        <div class="lh-charts-grid" style="grid-template-columns:1fr;">
          <chart-container id="chart-player-goals" class="lh-chart-card"></chart-container>
        </div>
      </div>
    `;

    root.querySelectorAll("[data-match-id]").forEach((el) => {
      el.addEventListener("click", () => window.location.hash = `#match/${el.dataset.matchId}`);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") window.location.hash = `#match/${el.dataset.matchId}`; });
    });

    renderChart();
  }

  function renderChart() {
    const chart = root.querySelector("#chart-player-goals");
    if (!chart || finishedMatches.length === 0) return;

    const sortedMatches = [...finishedMatches].sort((a, b) => a.date - b.date);
    const labels = sortedMatches.map((m) =>
      new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })
    );
    const goalsPerMatch = sortedMatches.map((m) => {
      return events.filter((ev) => ev.matchId === m.id).length;
    });

    chart.render("bar", {
      labels,
      datasets: [{
        label: "Anotaciones",
        data: goalsPerMatch,
        backgroundColor: "#ff4b2e",
        borderRadius: 2,
      }],
    }, {
      plugins: { title: { display: true, text: "Anotaciones por partido", font: { family: "Arial Narrow" } } },
      scales: { y: { beginAtZero: true, stepSize: 1 } },
      responsive: true,
      maintainAspectRatio: true,
    });
  }

  paint();
};
