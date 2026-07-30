class RankingTable extends HTMLElement {
  set players(value) {
    this._players = value;
    this.render();
  }
  set sport(value) {
    this._sport = value;
    this.render();
  }
  set label(value) {
    this._label = value;
    this.render();
  }

  render() {
    if (!this._players) return;
    const esc = LH.utils.escapeHtml;
    const terms = LH.getSportTerms(this._sport);
    const customLabel = this._label || terms.scorersLabel;

    const sorted = [...this._players]
      .filter((p) => p.stats && p.stats.goals > 0)
      .sort((a, b) => b.stats.goals - a.stats.goals)
      .slice(0, 10);

    if (sorted.length === 0) {
      this.innerHTML = `<div class="lh-ranking"><p class="lh-card__meta">Sin anotaciones registradas.</p></div>`;
      return;
    }

    const rows = sorted.map((p, i) => {
      const photoHtml = p.photo
        ? `<img src="${esc(p.photo)}" alt="" class="lh-ranking__avatar" />`
        : `<span class="lh-ranking__avatar lh-ranking__avatar--placeholder">${esc(LH.utils.initials(p.name))}</span>`;
      const teamName = p.teamName || "";
      const avg = p.stats.pj > 0 ? (p.stats.goals / p.stats.pj).toFixed(2) : "0";
      return `
        <tr class="lh-ranking__row" data-player-id="${p.id}" tabindex="0" role="link">
          <td class="lh-ranking__pos">${i + 1}°</td>
          <td>${photoHtml}</td>
          <td class="lh-ranking__name">${esc(p.name)}</td>
          <td class="lh-ranking__team">${esc(teamName)}</td>
          <td class="lh-ranking__num">${p.stats.goals}</td>
          <td class="lh-ranking__num">${p.stats.pj}</td>
          <td class="lh-ranking__num">${avg}</td>
        </tr>`;
    }).join("");

    this.innerHTML = `
      <div class="lh-ranking">
        <h3>${esc(customLabel)}</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Jugador</th>
              <th>Equipo</th>
              <th>${esc(terms.scoringEventPlural)}</th>
              <th>PJ</th>
              <th>Prom.</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    this.querySelectorAll(".lh-ranking__row").forEach((row) => {
      row.addEventListener("click", () => {
        window.location.hash = `#player/${row.dataset.playerId}`;
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter") window.location.hash = `#player/${row.dataset.playerId}`;
      });
    });
  }
}
customElements.define("ranking-table", RankingTable);
