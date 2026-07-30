/**
 * <event-form>
 * Sub-formulario de la sección 4.8.2. Recibe los dos equipos y sus
 * plantillas, y emite "lh:add-event" con { teamId, playerId, minute }.
 * No toca IndexedDB ni sabe nada del partido: la vista decide qué hacer
 * con el evento (lo acumula en memoria hasta que se finalice).
 */
class EventForm extends HTMLElement {
  set homeTeam(v) {
    this._homeTeam = v;
    this.render();
  }
  set awayTeam(v) {
    this._awayTeam = v;
    this.render();
  }
  set homePlayers(v) {
    this._homePlayers = v;
    this.render();
  }
  set awayPlayers(v) {
    this._awayPlayers = v;
    this.render();
  }

  render() {
    if (!this._homeTeam || !this._awayTeam || !this._homePlayers || !this._awayPlayers) return;
    const esc = LH.utils.escapeHtml;

    this.innerHTML = `
      <form class="lh-event-form" id="event-form">
        <h3>Agregar anotación</h3>
        <div class="lh-form-grid">
          <div class="lh-field">
            <label for="ef-team">Equipo</label>
            <select id="ef-team" name="teamId">
              <option value="${this._homeTeam.id}">${esc(this._homeTeam.name)}</option>
              <option value="${this._awayTeam.id}">${esc(this._awayTeam.name)}</option>
            </select>
          </div>
          <div class="lh-field">
            <label for="ef-player">Jugador</label>
            <select id="ef-player" name="playerId"></select>
          </div>
          <div class="lh-field">
            <label for="ef-minute">Minuto (opcional)</label>
            <input id="ef-minute" name="minute" type="number" min="0" />
          </div>
        </div>
        <div class="lh-form-actions">
          <button class="btn" type="submit">Agregar anotación</button>
        </div>
      </form>
    `;

    const teamSelect = this.querySelector("#ef-team");
    const playerSelect = this.querySelector("#ef-player");

    const fillPlayers = () => {
      const isHome = Number(teamSelect.value) === Number(this._homeTeam.id);
      const players = isHome ? this._homePlayers : this._awayPlayers;
      playerSelect.innerHTML = players
        .map((p) => `<option value="${p.id}">#${p.number} ${esc(p.name)}</option>`)
        .join("");
    };
    fillPlayers();
    teamSelect.addEventListener("change", fillPlayers);

    this.querySelector("#event-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!playerSelect.value) return;
      const minuteInput = this.querySelector("#ef-minute");
      this.dispatchEvent(
        new CustomEvent("lh:add-event", {
          detail: {
            teamId: Number(teamSelect.value),
            playerId: Number(playerSelect.value),
            minute: minuteInput.value !== "" ? Number(minuteInput.value) : null,
          },
          bubbles: true,
        })
      );
      minuteInput.value = "";
    });
  }
}

customElements.define("event-form", EventForm);
