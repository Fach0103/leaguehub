class LoadingState extends HTMLElement {
  connectedCallback() {
    const text = this.getAttribute("text") || "Cargando…";
    this.innerHTML = `
      <div class="lh-loading">
        <span class="lh-loading__spinner"></span>
        <span class="lh-loading__text">${text}</span>
      </div>
    `;
  }
}
customElements.define("loading-state", LoadingState);
