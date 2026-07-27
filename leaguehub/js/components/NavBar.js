/**
 * <league-navbar>
 * Barra de navegación global. No conoce el detalle de cada vista,
 * solo la lista de rutas y (más adelante) el nombre/deporte de la
 * liga activa, que se le inyecta vía LH.state.getActiveLeague().
 */
class LeagueNavbar extends HTMLElement {
  static LINKS = [
    { hash: "#dashboard", label: "Inicio" },
    { hash: "#leagues", label: "Ligas" },
    { hash: "#teams", label: "Equipos" },
    { hash: "#players", label: "Jugadores" },
    { hash: "#matches", label: "Partidos" },
    { hash: "#stats", label: "Estadísticas" },
  ];

  connectedCallback() {
    this.render();
    this._onNavigate = () => this.updateActiveLink();
    document.addEventListener("lh:navigate", this._onNavigate);
  }

  disconnectedCallback() {
    document.removeEventListener("lh:navigate", this._onNavigate);
  }

  render() {
    const links = LeagueNavbar.LINKS.map(
      (l) => `<a href="${l.hash}" data-hash="${l.hash}">${l.label}</a>`
    ).join("");

    this.innerHTML = `
      <div class="lh-nav">
        <a class="lh-nav__brand" href="#dashboard">League<span>Hub</span></a>
        <div class="lh-nav__active-league" id="lh-active-league">
          <span class="dot"></span>
          <span class="name">Sin liga activa</span>
        </div>
        <nav class="lh-nav__links">${links}</nav>
      </div>
    `;

    this.updateActiveLink();
    this.updateActiveLeagueBadge();
  }

  updateActiveLink() {
    const current = window.location.hash || "#dashboard";
    this.querySelectorAll(".lh-nav__links a").forEach((a) => {
      a.classList.toggle("is-active", a.dataset.hash === current);
    });
  }

  /**
   * Se completa en la Fase 1/2 cuando exista LH.state con la liga activa
   * leída desde IndexedDB. Por ahora deja el placeholder.
   */
  updateActiveLeagueBadge() {
    const badge = this.querySelector("#lh-active-league .name");
    if (window.LH && LH.state && typeof LH.state.getActiveLeague === "function") {
      const league = LH.state.getActiveLeague();
      badge.textContent = league ? league.name : "Sin liga activa";
    }
  }
}

customElements.define("league-navbar", LeagueNavbar);
