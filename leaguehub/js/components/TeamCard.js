class TeamCard extends HTMLElement {
  set team(value) {
    this._team = value;
    this.render();
  }
  get team() {
    return this._team;
  }

  set playerCount(value) {
    this._playerCount = value;
    this.render();
  }

  set position(value) {
    this._position = value;
    this.render();
  }

  render() {
    const t = this._team;
    if (!t) return;
    const esc = LH.utils.escapeHtml;
    const initials = LH.utils.initials(t.name);
    const crestHtml = t.crest
      ? `<img src="${esc(t.crest)}" alt="Escudo de ${esc(t.name)}" class="lh-crest" />`
      : `<span class="lh-crest lh-crest--placeholder" style="background:${esc(
          t.colorPrimary
        )};color:${esc(t.colorSecondary)}">${esc(initials)}</span>`;

    this.innerHTML = `
      <article class="lh-card lh-team-card" tabindex="0" role="button">
        ${crestHtml}
        <div class="lh-team-card__body">
          <h3>${esc(t.name)}</h3>
          <p class="lh-card__meta">${esc(t.city || "Sin sede")}</p>
          <p class="lh-card__meta">
            ${this._playerCount !== undefined ? `${this._playerCount} jugadores` : ""}
            ${this._position !== undefined ? ` · Posición ${this._position}° en la tabla` : ""}
          </p>
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
      new CustomEvent("lh:action", { detail: { action, team: this._team }, bubbles: true })
    );
  }
}

customElements.define("team-card", TeamCard);
