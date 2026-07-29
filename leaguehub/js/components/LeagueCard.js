/**
 * <league-card>
 * No conoce IndexedDB ni el resto de la app: recibe datos por la
 * propiedad `.league` y emite un evento "lh:action" con lo que el
 * usuario quiso hacer. La vista que la usa decide qué hacer con eso.
 *
 * Uso:
 *   const card = document.createElement("league-card");
 *   card.league = leagueObj;
 *   card.addEventListener("lh:action", (e) => { e.detail.action, e.detail.league });
 *   container.appendChild(card);
 */
class LeagueCard extends HTMLElement {
  set league(value) {
    this._league = value;
    this.render();
  }
  get league() {
    return this._league;
  }

  render() {
    const l = this._league;
    if (!l) return;
    const esc = LH.utils.escapeHtml;
    const sport = LH.getSportTerms(l.sport);
    const modeLabel = l.mode === "league" ? "Liga (todos contra todos)" : "Eliminación directa";

    this.innerHTML = `
      <article class="lh-card lh-league-card ${l.isActive ? "is-active" : ""}">
        <header class="lh-league-card__header">
          <span class="lh-league-card__icon" aria-hidden="true">${sport.icon}</span>
          <div class="lh-league-card__title">
            <h3>${esc(l.name)}</h3>
            <p class="lh-card__meta">${esc(sport.label)} · ${esc(l.season || "Sin temporada")}</p>
          </div>
          ${l.isActive ? '<span class="lh-badge">Activa</span>' : ""}
        </header>
        <p class="lh-card__meta">${modeLabel}</p>
        <footer class="lh-card__actions">
          <button class="btn btn-outline" data-action="edit" type="button">Editar</button>
          ${!l.isActive ? '<button class="btn" data-action="activate" type="button">Activar</button>' : ""}
          <button class="btn btn-outline" data-action="export" type="button">Exportar</button>
          <button class="btn btn-danger" data-action="delete" type="button">Eliminar</button>
        </footer>
      </article>
    `;

    this.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("lh:action", {
            detail: { action: btn.dataset.action, league: l },
            bubbles: true,
          })
        );
      });
    });
  }
}

customElements.define("league-card", LeagueCard);
