window.LH = window.LH || {};

LH.ui = {
  confirm(options) {
    const el = document.querySelector("confirm-dialog");
    if (!el) return Promise.resolve(window.confirm(options.message || "¿Confirmar?"));
    return el.show(options);
  },

  toast(message, type = "success") {
    const el = document.querySelector("toast-container");
    if (el) el.show(message, type);
  },
};
