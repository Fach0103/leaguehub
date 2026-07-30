window.LH = window.LH || {};
LH.views = LH.views || {};

LH.views.stats = async function (root) {
  root.innerHTML = '<loading-state></loading-state>';

  const league = await LH.leagues.getActive();
  if (!league) {
    root.innerHTML = `
      <div class="view-empty">
        <h2>Estadísticas</h2>
        <p>No hay ninguna liga activa. Crea o activa una liga para ver estadísticas.</p>
        <a class="btn" href="#leagues">Ir a Ligas</a>
      </div>`;
    return;
  }

  const teams = await LH.teams.getByLeague(league.id);
  const matches = await LH.matches.getByLeague(league.id);
  const finished = matches.filter((m) => m.status === "finished").sort((a, b) => a.date - b.date);
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

    const bracketHtml = !isLeague
      ? `<div id="bracket-section"><h3>Bracket</h3>
         <bracket-view id="bracket-view"></bracket-view>
         ${matches.length === 0 ? '<p class="lh-card__meta">Genera el bracket desde la vista Ligas para ver la estructura del torneo.</p>' : ""}
         </div>`
      : "";

    root.innerHTML = `
      <div class="lh-stats">
        <h2>Estadísticas — ${esc(league.name)}</h2>
        <p class="lh-card__meta">${terms.icon} ${terms.label} · ${esc(league.season)}</p>

        <div id="standings-section">
          ${isLeague
            ? `<h3>Tabla de posiciones</h3><standings-table id="standings-table"></standings-table>`
            : ""
          }
        </div>

        ${bracketHtml}

        <ranking-table id="ranking-table"></ranking-table>

        <div class="lh-charts-grid lh-charts-grid--3">
          <chart-container id="chart-evolution" class="lh-chart-card"></chart-container>
          <chart-container id="chart-top-scorers" class="lh-chart-card"></chart-container>
          <chart-container id="chart-extra" class="lh-chart-card"></chart-container>
        </div>
      </div>
    `;

    const st = root.querySelector("#standings-table");
    if (st) { st.teams = teams; st.sport = league.sport; }

    const rt = root.querySelector("#ranking-table");
    if (rt) { rt.players = allPlayers; rt.sport = league.sport; }

    const bv = root.querySelector("#bracket-view");
    if (bv) {
      bv.matches = matches;
      bv.teamsById = teamsById;
      bv.sport = league.sport;
      bv.render();
    }

    renderCharts(isLeague);
  }

  function renderCharts(isLeague) {
    const sortedTeams = [...teams].sort((a, b) => {
      const ptsA = a.stats.pg * 3 + a.stats.pe;
      const ptsB = b.stats.pg * 3 + b.stats.pe;
      if (ptsB !== ptsA) return ptsB - ptsA;
      return b.stats.pf - a.stats.pf - (b.stats.pc - a.stats.pc);
    });
    const topTeams = sortedTeams.slice(0, 5);
    const terms = LH.getSportTerms(league.sport);

    const chartEvo = root.querySelector("#chart-evolution");
    if (chartEvo && isLeague && finished.length > 0 && topTeams.length > 0) {
      const sortedMatches = [...finished].sort((a, b) => a.date - b.date);
      const labels = sortedMatches.map((m) =>
        new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })
      );
      const datasets = topTeams.map((t) => {
        let pts = 0;
        const ptsTimeline = sortedMatches.map((m) => {
          const isHome = m.homeTeamId === t.id;
          const isAway = m.awayTeamId === t.id;
          if (isHome || isAway) {
            const scored = isHome ? m.homeScore : m.awayScore;
            const conceded = isHome ? m.awayScore : m.homeScore;
            if (scored > conceded) pts += 3;
            else if (scored === conceded) pts += 1;
          }
          return pts;
        });
        return { label: t.name, data: ptsTimeline, borderColor: t.colorPrimary || "#3e5c76", tension: 0.3, pointRadius: 2, fill: false };
      });
      chartEvo.render("line", { labels, datasets }, {
        plugins: { title: { display: true, text: "Evolución de puntos · Top 5", font: { family: "Arial Narrow" } } },
        scales: { y: { beginAtZero: true } },
        responsive: true,
        maintainAspectRatio: true,
      });
    } else if (chartEvo && !isLeague && finished.length > 0) {
      const sortedMatches = [...finished].sort((a, b) => a.date - b.date);
      const labels = sortedMatches.map((m) =>
        new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })
      );
      const roundLabels = sortedMatches.map((m) => m.roundLabel || "");
      const data = sortedMatches.map((m) => (m.homeScore || 0) + (m.awayScore || 0));
      chartEvo.render("bar", {
        labels: roundLabels,
        datasets: [{
          label: `${terms.scoringEventPlural} por ronda`,
          data,
          backgroundColor: "#ff4b2e",
          borderRadius: 2,
        }],
      }, {
        plugins: { title: { display: true, text: `${terms.scoringEventPlural} por ronda`, font: { family: "Arial Narrow" } } },
        scales: { y: { beginAtZero: true } },
        responsive: true,
        maintainAspectRatio: true,
      });
    }

    const chartScorers = root.querySelector("#chart-top-scorers");
    if (chartScorers) {
      const topScorers = [...allPlayers]
        .filter((p) => p.stats && p.stats.goals > 0)
        .sort((a, b) => b.stats.goals - a.stats.goals)
        .slice(0, 10);
      if (topScorers.length > 0) {
        chartScorers.render("bar", {
          labels: topScorers.map((p) => p.name),
          datasets: [{
            label: terms.scoringEventPlural,
            data: topScorers.map((p) => p.stats.goals),
            backgroundColor: "#ff4b2e",
            borderRadius: 2,
          }],
        }, {
          indexAxis: "y",
          plugins: { title: { display: true, text: `Top 10 ${terms.scorersLabel.toLowerCase()}`, font: { family: "Arial Narrow" } } },
          scales: { x: { beginAtZero: true, stepSize: 1 } },
          responsive: true,
          maintainAspectRatio: true,
        });
      }
    }

    const chartExtra = root.querySelector("#chart-extra");
    if (chartExtra && topTeams.length > 0) {
      const labels = topTeams.map((t) => t.name);
      chartExtra.render("bar", {
        labels,
        datasets: [
          { label: terms.forLabel, data: topTeams.map((t) => t.stats.pf), backgroundColor: "#2f8f5b", borderRadius: 2 },
          { label: terms.againstLabel, data: topTeams.map((t) => t.stats.pc), backgroundColor: "#c73e3e", borderRadius: 2 },
        ],
      }, {
        plugins: { title: { display: true, text: `${terms.forLabel} vs ${terms.againstLabel} · Top 5`, font: { family: "Arial Narrow" } } },
        scales: { y: { beginAtZero: true } },
        responsive: true,
        maintainAspectRatio: true,
      });
    }
  }

  paint();
};
