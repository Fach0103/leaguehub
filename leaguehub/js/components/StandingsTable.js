class StandingsTable extends HTMLElement {
  set teams(value) {
    this._teams = value;
    this.render();
  }
  set sport(value) {
    this._sport = value;
    this.render();
  }

  render() {
    if (!this._teams) return;
    const esc = LH.utils.escapeHtml;
    const terms = LH.getSportTerms(this._sport);

    const sorted = [...this._teams].sort((a, b) => {
      const ptsA = a.stats.pg * 3 + a.stats.pe;
      const ptsB = b.stats.pg * 3 + b.stats.pe;
      if (ptsB !== ptsA) return ptsB - ptsA;
      const gdA = a.stats.pf - a.stats.pc;
      const gdB = b.stats.pf - b.stats.pc;
      if (gdB !== gdA) return gdB - gdA;
      return b.stats.pf - a.stats.pf;
    });

    const rows = sorted.map((t, i) => {
      const pts = t.stats.pg * 3 + t.stats.pe;
      const gd = t.stats.pf - t.stats.pc;
      const gdClass = gd > 0 ? "gd-positive" : gd < 0 ? "gd-negative" : "";
      const initials = LH.utils.initials(t.name);
      const crestHtml = t.crest
        ? `<img src="${esc(t.crest)}" alt="" class="lh-standings__crest" />`
        : `<span class="lh-standings__crest lh-standings__crest--placeholder" style="background:${esc(t.colorPrimary)};color:${esc(t.colorSecondary)}">${esc(initials)}</span>`;
      return `
        <tr class="lh-standings__row" data-team-id="${t.id}" tabindex="0" role="link">
          <td class="lh-standings__pos">${i + 1}°</td>
          <td>${crestHtml}</td>
          <td class="lh-standings__name">${esc(t.name)}</td>
          <td>${t.stats.pj}</td>
          <td>${t.stats.pg}</td>
          <td>${t.stats.pe}</td>
          <td>${t.stats.pp}</td>
          <td>${t.stats.pf}</td>
          <td>${t.stats.pc}</td>
          <td class="${gdClass}">${gd > 0 ? "+" : ""}${gd}</td>
          <td class="lh-standings__pts"><strong>${pts}</strong></td>
        </tr>`;
    }).join("");

    this.innerHTML = `
      <div class="lh-standings">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Equipo</th>
              <th>PJ</th>
              <th>PG</th>
              <th>PE</th>
              <th>PP</th>
              <th>${esc(terms.forLabel)}</th>
              <th>${esc(terms.againstLabel)}</th>
              <th>DIF</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    this.querySelectorAll(".lh-standings__row").forEach((row) => {
      row.addEventListener("click", () => {
        window.location.hash = `#team/${row.dataset.teamId}`;
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter") window.location.hash = `#team/${row.dataset.teamId}`;
      });
    });
  }
}
customElements.define("standings-table", StandingsTable);
