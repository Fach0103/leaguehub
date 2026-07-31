class LeagueFooter extends HTMLElement {
  connectedCallback() {
    this.render();
    LH.footer = { setDbStatus: (ok) => this.setDbStatus(ok) };
  }

  render() {
    const year = new Date().getFullYear();
    this.innerHTML = `
      <div class="lh-footer">
        <span>LeagueHub · [Nombre Integrante A] &amp; [Nombre Integrante B] · ${year}</span>
        <span class="lh-footer__status" id="lh-db-status">
          <span class="dot"></span> IndexedDB: conectando…
        </span>
      </div>
    `;
  }

  setDbStatus(ok) {
    const el = this.querySelector("#lh-db-status");
    if (!el) return;
    el.classList.toggle("is-error", !ok);
    el.innerHTML = `<span class="dot"></span> IndexedDB: ${ok ? "conectado" : "error"}`;
  }
}

customElements.define("league-footer", LeagueFooter);
