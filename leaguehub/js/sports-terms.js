/**
 * sports-terms.js
 * Única fuente de verdad para la terminología/identidad visual por deporte.
 * NINGÚN componente ni vista debe hardcodear "Gol", "Goleadores", etc.
 * Todos leen de aquí según LH.SPORTS[league.sport].
 *
 * Fase 7 completará colores/iconos definitivos; por ahora deja lo mínimo
 * para poder seguir avanzando con las otras fases.
 */
window.LH = window.LH || {};

LH.SPORTS = {
  futbol: {
    key: "futbol",
    label: "Fútbol",
    icon: "⚽",
    accent: "#2e7d32",
    scoringEvent: "Gol",
    scoringEventPlural: "Goles",
    scorersLabel: "Goleadores",
    forLabel: "GF",
    againstLabel: "GC",
  },
  basquet: {
    key: "basquet",
    label: "Básquet",
    icon: "🏀",
    accent: "#e65100",
    scoringEvent: "Canasta",
    scoringEventPlural: "Canastas",
    scorersLabel: "Encestadores",
    forLabel: "PF",
    againstLabel: "PC",
  },
  voley: {
    key: "voley",
    label: "Vóley",
    icon: "🏐",
    accent: "#1565c0",
    scoringEvent: "Punto",
    scoringEventPlural: "Puntos",
    scorersLabel: "Anotadores",
    forLabel: "PF",
    againstLabel: "PC",
  },
};

/** Devuelve el mapa de un deporte, con fallback seguro si algo viene mal. */
LH.getSportTerms = function (sportKey) {
  return LH.SPORTS[sportKey] || LH.SPORTS.futbol;
};
