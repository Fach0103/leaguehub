/**
 * <player-card>
 * Recibe `.player` y opcionalmente `.team` (para mostrar escudo/nombre
 * de equipo en el listado general de jugadores, sección 4.5.2).
 */
class PlayerCard extends HTMLElement {
  set player(value) {
    this._player = value;
    this.render();
  }
  get player() {
    return this._player;
  }

  set team(value) {
    this._team = value;
    this.render();
  }

  render() {
    const p = this._player;
    if (!p) return;
    const esc = LH.utils.escapeHtml;
    const photoHtml = p.photo
      ? `<img src="${esc(p.photo)}" alt="Foto de ${esc(p.name)}" class="lh-avatar" />`
      : `<span class="lh-avatar lh-avatar--placeholder">${esc(LH.utils.initials(p.name))}</span>`;

    const teamLine = this._team
      ? `<p class="lh-card__meta">${esc(this._team.name)}</p>`
      : "";

    this.innerHTML = `
      <article class="lh-card lh-player-card" tabindex="0" role="button">
        ${photoHtml}
        <div class="lh-player-card__body">
          <h3>#${p.number} ${esc(p.name)}</h3>
          <p class="lh-card__meta">${esc(p.position || "Sin posición")}</p>
          ${teamLine}
        </div>
        <footer class="lh-card__actions">
          <button class="btn btn-outline" data-action="edit" type="button">Editar</button>
          <button class="btn btn-danger" data-action="delete" type="button">Eliminar</button>
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
      new CustomEvent("lh:action", { detail: { action, player: this._player }, bubbles: true })
    );
  }
}

customElements.define("player-card", PlayerCard);
