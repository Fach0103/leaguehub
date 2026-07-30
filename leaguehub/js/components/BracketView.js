class BracketView extends HTMLElement {
  set matches(value) {
    this._matches = value;
  }
  set teamsById(value) {
    this._teamsById = value;
  }
  set sport(value) {
    this._sport = value;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    if (!this._matches || this._matches.length === 0) {
      this.innerHTML = '<p class="lh-card__meta">No hay partidos en el bracket.</p>';
      return;
    }

    const rounds = {};
    let maxRound = 0;
    this._matches.forEach((m) => {
      const r = m.round || 0;
      rounds[r] = rounds[r] || [];
      rounds[r].push(m);
      if (r > maxRound) maxRound = r;
    });

    const esc = LH.utils.escapeHtml;
    const teamsById = this._teamsById || {};

    const roundKeys = Object.keys(rounds)
      .map(Number)
      .sort((a, b) => a - b);

    let html = '<div class="lh-bracket">';

    roundKeys.forEach((roundKey) => {
      const roundLabel = rounds[roundKey][0].roundLabel || `Ronda ${roundKey}`;
      html += `<div class="lh-bracket__round"><h3 class="lh-bracket__round-title">${esc(roundLabel)}</h3>`;

      rounds[roundKey].forEach((m) => {
        const homeTeam = m.homeTeamId ? teamsById[m.homeTeamId] : null;
        const awayTeam = m.awayTeamId ? teamsById[m.awayTeamId] : null;
        const homeName = homeTeam ? homeTeam.name : "Por definir";
        const awayName = awayTeam ? awayTeam.name : "Por definir";

        const isFinished = m.status === "finished";
        const winnerId = isFinished
          ? (m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId)
          : null;

        const homeClass = winnerId !== null && m.homeTeamId === winnerId ? "is-winner" : "";
        const awayClass = winnerId !== null && m.awayTeamId === winnerId ? "is-winner" : "";

        const scoreHtml = isFinished
          ? `<span class="score lh-bracket__score">${m.homeScore} - ${m.awayScore}</span>`
          : '<span class="lh-match-card__vs">vs</span>';

        html += `
          <article class="lh-bracket__match" data-match-id="${m.id}" tabindex="0" role="button">
            <div class="lh-bracket__team ${homeClass}">
              <span class="lh-bracket__team-name">${esc(homeName)}</span>
            </div>
            ${scoreHtml}
            <div class="lh-bracket__team ${awayClass}">
              <span class="lh-bracket__team-name">${esc(awayName)}</span>
            </div>
            <div class="lh-bracket__status lh-match-card__status--${m.status}">
              ${isFinished ? "Finalizado" : "Programado"}
            </div>
          </article>`;
      });

      html += "</div>";
    });

    html += "</div>";
    this.innerHTML = html;

    this.querySelectorAll(".lh-bracket__match").forEach((el) => {
      el.addEventListener("click", () => {
        window.location.hash = `#match/${el.dataset.matchId}`;
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") window.location.hash = `#match/${el.dataset.matchId}`;
      });
    });
  }
}
customElements.define("bracket-view", BracketView);
