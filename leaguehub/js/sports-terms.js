window.LH = window.LH || {};

LH.SPORTS = {
  futbol: {
    key: "futbol",
    label: "Fútbol",
    icon: "",
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
    icon: "",
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
    icon: "",
    accent: "#1565c0",
    scoringEvent: "Punto",
    scoringEventPlural: "Puntos",
    scorersLabel: "Anotadores",
    forLabel: "PF",
    againstLabel: "PC",
  },
};

LH.getSportTerms = function (sportKey) {
  return LH.SPORTS[sportKey] || LH.SPORTS.futbol;
};
