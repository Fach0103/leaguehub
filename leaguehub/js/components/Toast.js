/**
 * <toast-container>
 * Instancia única en index.html. Uso:
 *   LH.ui.toast("Equipo creado", "success");
 *   LH.ui.toast("No se pudo guardar", "error");
 */
class ToastContainer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<div class="lh-toast-stack"></div>';
    this.stack = this.querySelector(".lh-toast-stack");
  }

  show(message, type = "success") {
    const el = document.createElement("div");
    el.className = `lh-toast lh-toast--${type}`;
    el.textContent = message;
    this.stack.appendChild(el);

    // Doble rAF para asegurar la transición de entrada.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-visible")));

    setTimeout(() => {
      el.classList.remove("is-visible");
      setTimeout(() => el.remove(), 250);
    }, 3500);
  }
}

customElements.define("toast-container", ToastContainer);
