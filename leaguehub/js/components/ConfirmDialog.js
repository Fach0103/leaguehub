class ConfirmDialog extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <dialog class="lh-dialog">
        <h3 class="lh-dialog__title"></h3>
        <p class="lh-dialog__message"></p>
        <div class="lh-dialog__actions">
          <button class="btn btn-outline" data-action="cancel" type="button">Cancelar</button>
          <button class="btn" data-action="confirm" type="button">Confirmar</button>
        </div>
      </dialog>
    `;
    this.dialogEl = this.querySelector("dialog");
    this.titleEl = this.querySelector(".lh-dialog__title");
    this.messageEl = this.querySelector(".lh-dialog__message");
    this.confirmBtn = this.querySelector('[data-action="confirm"]');
    this.cancelBtn = this.querySelector('[data-action="cancel"]');
  }

  show({ title = "Confirmar", message = "", confirmLabel = "Confirmar", danger = false } = {}) {
    this.titleEl.textContent = title;
    this.messageEl.textContent = message;
    this.confirmBtn.textContent = confirmLabel;
    this.confirmBtn.classList.toggle("btn-danger", danger);

    return new Promise((resolve) => {
      const cleanup = () => {
        this.confirmBtn.removeEventListener("click", onConfirm);
        this.cancelBtn.removeEventListener("click", onCancel);
        this.dialogEl.removeEventListener("cancel", onCancel);
        this.dialogEl.close();
      };
      const onConfirm = () => {
        cleanup();
        resolve(true);
      };
      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      this.confirmBtn.addEventListener("click", onConfirm);
      this.cancelBtn.addEventListener("click", onCancel);
      this.dialogEl.addEventListener("cancel", onCancel);
      this.dialogEl.showModal();
    });
  }
}

customElements.define("confirm-dialog", ConfirmDialog);
