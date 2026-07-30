class ChartContainer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="chart-wrapper">
        <div class="chart-canvas-container">
          <canvas></canvas>
        </div>
        <p class="chart-fallback" hidden>No hay datos suficientes</p>
      </div>
    `;
    this.canvas = this.querySelector("canvas");
    this.fallbackEl = this.querySelector(".chart-fallback");
    this._chart = null;
  }

  render(type, data, options) {
    const hasData = data && data.datasets && data.datasets.some(
      (ds) => ds.data && ds.data.length > 0 && ds.data.some((v) => v !== null && v !== undefined)
    );
    if (!hasData) {
      this.canvas.hidden = true;
      this.fallbackEl.hidden = false;
      this.fallbackEl.textContent = options?.fallbackText || "No hay datos suficientes";
      return;
    }
    this.canvas.hidden = false;
    this.fallbackEl.hidden = true;
    if (this._chart) this._chart.destroy();
    this._chart = new Chart(this.canvas.getContext("2d"), { type, data, options });
  }
}
customElements.define("chart-container", ChartContainer);
