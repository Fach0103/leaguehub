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
    this._onNavigate = () => {
      this.updateActiveLink();
      this.updateActiveLeagueBadge();
    };
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
          <span class="name">Cargando…</span>
          <span class="sport" id="lh-active-league-sport"></span>
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
   * Lee la liga activa desde IndexedDB (vía LH.leagues, Fase 1) y actualiza
   * el badge. Es async porque IndexedDB lo es; por eso no se hace en el
   * mismo render() síncrono sino aparte.
   */
  async updateActiveLeagueBadge() {
    const nameEl = this.querySelector("#lh-active-league .name");
    const sportEl = this.querySelector("#lh-active-league-sport");
    if (!nameEl || !window.LH || !LH.leagues) return;

    try {
      const league = await LH.leagues.getActive();
      if (league) {
        nameEl.textContent = league.name;
        sportEl.textContent = LH.getSportTerms(league.sport).label;
      } else {
        nameEl.textContent = "Sin liga activa";
        sportEl.textContent = "";
      }
    } catch (err) {
      nameEl.textContent = "Sin liga activa";
      sportEl.textContent = "";
    }
  }
}

customElements.define("league-navbar", LeagueNavbar);
