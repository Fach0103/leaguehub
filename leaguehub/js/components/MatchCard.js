/**
 * <match-card>
 * Recibe `.match`, `.homeTeam`, `.awayTeam` (objetos Team completos,
 * porque Match solo guarda sus IDs). Emite "lh:action" con
 * action: "view" | "edit" | "delete".
 */
class MatchCard extends HTMLElement {
  set match(value) {
    this._match = value;
    this.render();
  }
  get match() {
    return this._match;
  }

  set homeTeam(value) {
    this._homeTeam = value;
    this.render();
  }

  set awayTeam(value) {
    this._awayTeam = value;
    this.render();
  }

  render() {
    const m = this._match;
    if (!m || !this._homeTeam || !this._awayTeam) return;
    const esc = LH.utils.escapeHtml;

    const scoreHtml =
      m.status === "finished"
        ? `<span class="score">${m.homeScore} - ${m.awayScore}</span>`
        : `<span class="lh-match-card__vs">vs</span>`;

    const dateStr = new Date(m.date).toLocaleString("es", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const statusLabel = m.status === "finished" ? "Finalizado" : "Programado";

    this.innerHTML = `
      <article class="lh-card lh-match-card" tabindex="0" role="button">
        <div class="lh-match-card__teams">
          <span class="lh-match-card__team">${esc(this._homeTeam.name)}</span>
          ${scoreHtml}
          <span class="lh-match-card__team">${esc(this._awayTeam.name)}</span>
        </div>
        <div class="lh-match-card__meta">
          <span>${esc(dateStr)}</span>
          <span class="lh-match-card__status lh-match-card__status--${m.status}">${statusLabel}</span>
        </div>
        <footer class="lh-card__actions">
          ${
            m.status === "scheduled"
              ? '<button class="btn btn-outline" data-action="edit" type="button">Editar</button><button class="btn btn-danger" data-action="delete" type="button">Eliminar</button>'
              : ""
          }
        </footer>
      </article>
    `;

    const article = this.querySelector("article");
    article.addEventListener("click", (e) => {
      if (e.target.closest("[data-action]")) return;
      this.emit("view");
    });
    article.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.emit("view");
    });
    this.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => this.emit(btn.dataset.action));
    });
  }

  emit(action) {
    this.dispatchEvent(
      new CustomEvent("lh:action", { detail: { action, match: this._match }, bubbles: true })
    );
  }
}

customElements.define("match-card", MatchCard);
