window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.dashboard = async function (root) {
  root.innerHTML = '<loading-state></loading-state>';

  const league = await LH.leagues.getActive();
  if (!league) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>Dashboard</h2>
        <p>No hay ninguna liga activa. Crea o activa una liga para ver el resumen.</p>
        <a class="btn" href="#leagues">Ir a Ligas</a>
      </div>`;
    return;
  }

  const teams = await LH.teams.getByLeague(league.id);
  const matches = await LH.matches.getByLeague(league.id);
  const finished = matches.filter((m) => m.status === "finished").sort((a, b) => b.date - a.date);
  const scheduled = matches.filter((m) => m.status === "scheduled").sort((a, b) => a.date - b.date);
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));

  let allPlayers = [];
  if (teams.length > 0) {
    const perTeam = await Promise.all(teams.map((t) => LH.players.getByTeam(t.id)));
    teams.forEach((t, i) => {
      perTeam[i].forEach((p) => allPlayers.push({ ...p, teamName: t.name }));
    });
  }

  function paint() {
    const esc = LH.utils.escapeHtml;
    const terms = LH.getSportTerms(league.sport);
    const isLeague = league.mode === "league";

    const nextMatch = scheduled[0] || null;
    const lastMatch = finished[0] || null;

    const nextMatchHtml = nextMatch
      ? `<article class="lh-dash-card">
          <h4 class="lh-card__meta">Próximo partido</h4>
          <div class="lh-dash-card__match">
            <span class="lh-dash-card__team">${esc(teamsById[nextMatch.homeTeamId]?.name || "?")}</span>
            <span class="lh-match-card__vs">vs</span>
            <span class="lh-dash-card__team">${esc(teamsById[nextMatch.awayTeamId]?.name || "?")}</span>
          </div>
          <p class="lh-card__meta">${new Date(nextMatch.date).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}</p>
        </article>`
      : `<article class="lh-dash-card">
          <h4 class="lh-card__meta">Próximo partido</h4>
          <p class="lh-card__meta">No hay partidos programados.</p>
        </article>`;

    const lastMatchHtml = lastMatch
      ? `<article class="lh-dash-card">
          <h4 class="lh-card__meta">Último resultado</h4>
          <div class="lh-dash-card__match">
            <span class="lh-dash-card__team">${esc(teamsById[lastMatch.homeTeamId]?.name || "?")}</span>
            <span class="score">${lastMatch.homeScore} - ${lastMatch.awayScore}</span>
            <span class="lh-dash-card__team">${esc(teamsById[lastMatch.awayTeamId]?.name || "?")}</span>
          </div>
          <a href="#match/${lastMatch.id}" class="lh-card__meta">Ver detalle →</a>
        </article>`
      : `<article class="lh-dash-card">
          <h4 class="lh-card__meta">Último resultado</h4>
          <p class="lh-card__meta">Aún no hay partidos finalizados.</p>
        </article>`;

    let top5Html = "";
    if (isLeague) {
      const sorted = [...teams].sort((a, b) => {
        const ptsA = a.stats.pg * 3 + a.stats.pe;
        const ptsB = b.stats.pg * 3 + b.stats.pe;
        if (ptsB !== ptsA) return ptsB - ptsA;
        return b.stats.pf - a.stats.pf - (b.stats.pc - a.stats.pc);
      });
      const top5 = sorted.slice(0, 5);
      top5Html = `
        <div class="lh-dash-standings">
          <h3>Tabla de posiciones · Top 5</h3>
          <table class="lh-dash-standings__table">
            <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>Pts</th></tr></thead>
            <tbody>
              ${top5.map((t, i) => {
                const pts = t.stats.pg * 3 + t.stats.pe;
                const initials = LH.utils.initials(t.name);
                const crestHtml = t.crest
                  ? `<img src="${esc(t.crest)}" alt="" class="lh-standings__crest" />`
                  : `<span class="lh-standings__crest lh-standings__crest--placeholder" style="background:${esc(t.colorPrimary)};color:${esc(t.colorSecondary)}">${esc(initials)}</span>`;
                return `<tr data-team-id="${t.id}" tabindex="0" role="link">
                  <td>${i + 1}°</td>
                  <td>${crestHtml} ${esc(t.name)}</td>
                  <td>${t.stats.pj}</td>
                  <td><strong>${pts}</strong></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
          <a href="#stats" class="lh-card__meta">Ver tabla completa →</a>
        </div>`;
    } else {
      top5Html = `
        <div class="lh-dash-standings">
          <h3>Bracket · Eliminación directa</h3>
          <div id="dash-bracket-mini"></div>
          <a href="#stats" class="lh-card__meta">Ver bracket completo →</a>
        </div>`;
    }

    root.innerHTML = `
      <div class="lh-dashboard">
        <header class="lh-dash-header">
          <div>
            <h2>${esc(league.name)}</h2>
            <p class="lh-card__meta">${terms.icon} ${terms.label} · ${esc(league.season)}</p>
          </div>
          <button class="btn btn-outline" id="btn-change-league" type="button">Cambiar liga</button>
        </header>

        <div class="lh-dash-cards">
          ${nextMatchHtml}
          ${lastMatchHtml}
        </div>

        ${top5Html}

        <div class="lh-charts-grid lh-charts-grid--3">
          <chart-container id="chart-pf" class="lh-chart-card"></chart-container>
          <chart-container id="chart-results" class="lh-chart-card"></chart-container>
          <chart-container id="chart-timeline" class="lh-chart-card"></chart-container>
        </div>
      </div>
    `;

    root.querySelector("#btn-change-league").addEventListener("click", () => {
      window.location.hash = "#leagues";
    });

    if (!isLeague && matches.length > 0) {
      const miniSlot = root.querySelector("#dash-bracket-mini");
      if (miniSlot) {
        const bv = document.createElement("bracket-view");
        bv.matches = matches;
        bv.teamsById = teamsById;
        bv.sport = league.sport;
        miniSlot.appendChild(bv);
      }
    }

    root.querySelectorAll(".lh-dash-standings__table tr[data-team-id]").forEach((row) => {
      row.addEventListener("click", () => window.location.hash = `#team/${row.dataset.teamId}`);
      row.addEventListener("keydown", (e) => { if (e.key === "Enter") window.location.hash = `#team/${row.dataset.teamId}`; });
    });

    renderCharts();
  }

  function renderCharts() {
    const chartPf = root.querySelector("#chart-pf");
    if (chartPf) {
      const labels = teams.map((t) => t.name);
      const pfData = teams.map((t) => t.stats.pf);
      chartPf.render("bar", {
        labels,
        datasets: [{
          label: terms.forLabel,
          data: pfData,
          backgroundColor: teams.map((t) => t.colorPrimary || "#3e5c76"),
          borderRadius: 2,
        }],
      }, {
        plugins: { title: { display: true, text: `${terms.forLabel} por equipo`, font: { family: "Arial Narrow" } } },
        scales: { y: { beginAtZero: true } },
        responsive: true,
        maintainAspectRatio: true,
      });
    }

    const chartResults = root.querySelector("#chart-results");
    if (chartResults) {
      const totalWins = teams.reduce((s, t) => s + t.stats.pg, 0);
      const totalDraws = teams.reduce((s, t) => s + t.stats.pe, 0);
      const totalLosses = teams.reduce((s, t) => s + t.stats.pp, 0);
      if (totalWins + totalDraws + totalLosses > 0) {
        chartResults.render("doughnut", {
          labels: ["Victorias", "Empates", "Derrotas"],
          datasets: [{
            data: [totalWins, totalDraws, totalLosses],
            backgroundColor: ["#2f8f5b", "#e8b93b", "#c73e3e"],
            borderWidth: 0,
          }],
        }, {
          plugins: { title: { display: true, text: "Distribución de resultados", font: { family: "Arial Narrow" } } },
          responsive: true,
          maintainAspectRatio: true,
        });
      }
    }

    const chartTimeline = root.querySelector("#chart-timeline");
    if (chartTimeline && finished.length > 0) {
      const sortedMatches = [...finished].sort((a, b) => a.date - b.date);
      const labels = sortedMatches.map((m) =>
        new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })
      );
      let cumulative = 0;
      const data = sortedMatches.map((m) => {
        cumulative += (m.homeScore || 0) + (m.awayScore || 0);
        return cumulative;
      });
      chartTimeline.render("line", {
        labels,
        datasets: [{
          label: `${terms.scoringEventPlural} acumulados`,
          data,
          borderColor: "#ff4b2e",
          backgroundColor: "#ff4b2e33",
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }],
      }, {
        plugins: { title: { display: true, text: `Evolución de ${terms.scoringEventPlural.toLowerCase()}`, font: { family: "Arial Narrow" } } },
        scales: { y: { beginAtZero: true } },
        responsive: true,
        maintainAspectRatio: true,
      });
    }
  }

  paint();
};
