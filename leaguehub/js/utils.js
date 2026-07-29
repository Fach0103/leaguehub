/**
 * utils.js
 * Funciones puras y pequeñas, sin estado, usadas en toda la app.
 */
window.LH = window.LH || {};

LH.utils = {
  /** Evita inyección de HTML al insertar texto de usuario en templates. */
  escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  /** Debounce clásico: retrasa la ejecución hasta que paren los eventos. */
  debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  /** Placeholder de escudo/foto: iniciales sobre un color. */
  initials(name) {
    if (!name) return "?";
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  },
};
