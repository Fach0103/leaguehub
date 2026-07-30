window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.teamDetail = async function (root, params) {
  root.innerHTML = '<loading-state></loading-state>';

  const teamId = Number(params.id);
  const team = await LH.teams.getById(teamId);
  if (!team) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>Equipo no encontrado</h2>
        <a class="btn" href="#teams">← Volver a Equipos</a>
      </div>`;
    return;
  }

  const league = await LH.leagues.getById(team.leagueId);
  const players = await LH.players.getByTeam(teamId);
  const matches = await LH.matches.getByLeague(team.leagueId);
  const teamsInLeague = await LH.teams.getByLeague(team.leagueId);
  const teamsById = Object.fromEntries(teamsInLeague.map((t) => [t.id, t]));

  const teamMatches = matches.filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .sort((a, b) => b.date - a.date);
  const scheduled = teamMatches.filter((m) => m.status === "scheduled");
  const finished = teamMatches.filter((m) => m.status === "finished");

  const sorted = [...teamsInLeague].sort((a, b) => {
    const ptsA = a.stats.pg * 3 + a.stats.pe;
    const ptsB = b.stats.pg * 3 + b.stats.pe;
    if (ptsB !== ptsA) return ptsB - ptsA;
    return (b.stats.pf - b.stats.pc) - (a.stats.pf - a.stats.pc);
  });
  const position = sorted.findIndex((t) => t.id === teamId) + 1;

  function paint() {
    const esc = LH.utils.escapeHtml;
    const terms = LH.getSportTerms(league.sport);
    const gd = team.stats.pf - team.stats.pc;
    const pts = team.stats.pg * 3 + team.stats.pe;
    const initials = LH.utils.initials(team.name);

    const crestHtml = team.crest
      ? `<img src="${esc(team.crest)}" alt="" class="lh-team-detail__crest" />`
      : `<span class="lh-team-detail__crest lh-team-detail__crest--placeholder" style="background:${esc(team.colorPrimary)};color:${esc(team.colorSecondary)}">${esc(initials)}</span>`;

    const scheduledHtml = scheduled.length === 0
      ? '<p class="lh-card__meta">No hay partidos programados.</p>'
      : scheduled.slice(0, 5).map((m) => {
          const rival = m.homeTeamId === teamId ? teamsById[m.awayTeamId] : teamsById[m.homeTeamId];
          const loc = m.homeTeamId === teamId ? "Local" : "Visitante";
          return `
            <div class="lh-team-detail__match-row" data-match-id="${m.id}" tabindex="0" role="link">
              <span class="lh-card__meta">${esc(loc)} vs ${rival ? esc(rival.name) : "?"}</span>
              <span class="lh-card__meta">${new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>`;
        }).join("");

    const finishedHtml = finished.length === 0
      ? '<p class="lh-card__meta">No hay partidos finalizados.</p>'
      : finished.map((m) => {
          const isHome = m.homeTeamId === teamId;
          const rival = isHome ? teamsById[m.awayTeamId] : teamsById[m.homeTeamId];
          const scored = isHome ? m.homeScore : m.awayScore;
          const conceded = isHome ? m.awayScore : m.homeScore;
          const resultClass = scored > conceded ? "result-win" : (scored < conceded ? "result-loss" : "result-draw");
          return `
            <div class="lh-team-detail__match-row ${resultClass}" data-match-id="${m.id}" tabindex="0" role="link">
              <span>${rival ? esc(rival.name) : "?"}</span>
              <span class="score">${scored} - ${conceded}</span>
              <span class="lh-card__meta">${new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })}</span>
            </div>`;
        }).join("");

    root.innerHTML = `
      <a href="#teams" class="btn btn-outline lh-back-link">← Volver</a>

      <div class="lh-team-detail">
        <header class="lh-team-detail__header">
          ${crestHtml}
          <div>
            <h2>${esc(team.name)}</h2>
            <p class="lh-card__meta">${esc(team.city || "Sin sede")} · ${esc(league.name)}</p>
          </div>
          <div class="lh-team-detail__stats-summary">
            <div class="lh-team-detail__stat"><span class="lh-card__meta">Posición</span><strong>${position}°</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">Pts</span><strong>${pts}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">PJ</span><strong>${team.stats.pj}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">PG</span><strong>${team.stats.pg}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">PE</span><strong>${team.stats.pe}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">PP</span><strong>${team.stats.pp}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">${esc(terms.forLabel)}</span><strong>${team.stats.pf}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">${esc(terms.againstLabel)}</span><strong>${team.stats.pc}</strong></div>
            <div class="lh-team-detail__stat"><span class="lh-card__meta">DIF</span><strong class="${gd > 0 ? "gd-positive" : gd < 0 ? "gd-negative" : ""}">${gd > 0 ? "+" : ""}${gd}</strong></div>
          </div>
        </header>

        <h3>Plantilla (${players.length})</h3>
        <div id="player-list" class="lh-grid"></div>

        <h3>Próximos partidos</h3>
        <div class="lh-team-detail__matches">${scheduledHtml}</div>

        <h3>Partidos jugados</h3>
        <div class="lh-team-detail__matches">${finishedHtml}</div>

        <div class="lh-charts-grid" style="grid-template-columns:1fr;">
          <chart-container id="chart-team-evolution" class="lh-chart-card"></chart-container>
        </div>
      </div>
    `;

    const playerGrid = root.querySelector("#player-list");
    players.forEach((p) => {
      const card = document.createElement("player-card");
      card.player = p;
      card.addEventListener("lh:action", (e) => {
        if (e.detail.action === "view") window.location.hash = `#player/${p.id}`;
      });
      playerGrid.appendChild(card);
    });

    root.querySelectorAll("[data-match-id]").forEach((el) => {
      el.addEventListener("click", () => window.location.hash = `#match/${el.dataset.matchId}`);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") window.location.hash = `#match/${el.dataset.matchId}`; });
    });

    renderChart();
  }

  function renderChart() {
    const chart = root.querySelector("#chart-team-evolution");
    if (!chart || finished.length < 2) return;

    const sortedFinished = [...finished].sort((a, b) => a.date - b.date);
    const labels = sortedFinished.map((m) =>
      new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })
    );
    let pts = 0;
    const ptsTimeline = sortedFinished.map((m) => {
      const isHome = m.homeTeamId === teamId;
      const scored = isHome ? m.homeScore : m.awayScore;
      const conceded = isHome ? m.awayScore : m.homeScore;
      if (scored > conceded) pts += 3;
      else if (scored === conceded) pts += 1;
      return pts;
    });

    chart.render("line", {
      labels,
      datasets: [{
        label: "Puntos acumulados",
        data: ptsTimeline,
        borderColor: team.colorPrimary || "#3e5c76",
        backgroundColor: (team.colorPrimary || "#3e5c76") + "33",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
      }],
    }, {
      plugins: { title: { display: true, text: "Evolución de puntos", font: { family: "Arial Narrow" } } },
      scales: { y: { beginAtZero: true } },
      responsive: true,
      maintainAspectRatio: true,
    });
  }

  paint();
};
