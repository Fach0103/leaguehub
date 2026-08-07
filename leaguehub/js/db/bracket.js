window.LH = window.LH || {};

/** BracketService — generación del bracket de eliminación directa. */
class BracketService {
  #WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  #getRoundLabel(round, numRounds) {
    const offset = numRounds - round;
    const labels = ["Final", "Semifinal", "Cuartos", "Octavos"];
    return labels[offset] || `Ronda ${round}`;
  }

  async generate(leagueId) {
    const league = await LH.leagues.getById(leagueId);
    if (!league) throw new Error("Liga no encontrada.");
    if (league.mode !== "knockout") {
      throw new Error("El bracket solo aplica a la modalidad eliminación directa.");
    }

    const teams = await LH.teams.getByLeague(leagueId);
    if (teams.length !== league.bracketSize) {
      throw new Error(
        `Se requieren exactamente ${league.bracketSize} equipos para generar el bracket (actualmente hay ${teams.length}).`
      );
    }

    const existing = await LH.matches.getByLeague(leagueId);
    if (existing.length > 0) {
      throw new Error("Esta liga ya tiene partidos generados.");
    }

    const teamIds = teams.map((t) => t.id).sort(() => Math.random() - 0.5);
    const numRounds = Math.log2(league.bracketSize);
    const baseDate = Date.now() + this.#WEEK_MS;
    const total = league.bracketSize - 1; // total de partidos del bracket completo

    await LH.db.transaction(["matches"], "readwrite", (stores) => {
      const idMap = {};
      let totalCreated = 0;

      const linkMatches = () => {
        for (let r = 1; r < numRounds; r++) {
          const matchesInRound = Math.pow(2, numRounds - r);
          for (let pos = 0; pos < matchesInRound; pos++) {
            const matchId = idMap[r][pos];
            const nextId = idMap[r + 1][Math.floor(pos / 2)];
            if (matchId && nextId) {
              const getReq = stores.matches.get(matchId);
              getReq.onsuccess = () => {
                const m = getReq.result;
                m.nextMatchId = nextId;
                stores.matches.put(m);
              };
            }
          }
        }
      };

      for (let round = numRounds; round >= 1; round--) {
        const matchesInRound = Math.pow(2, numRounds - round);
        idMap[round] = [];

        for (let pos = 0; pos < matchesInRound; pos++) {
          const isFirstRound = round === 1;
          const homeId = isFirstRound ? teamIds[pos * 2] : null;
          const awayId = isFirstRound ? teamIds[pos * 2 + 1] : null;

          const match = {
            leagueId: Number(leagueId),
            homeTeamId: homeId,
            awayTeamId: awayId,
            date: baseDate + (round - 1) * this.#WEEK_MS,
            status: "scheduled",
            homeScore: null,
            awayScore: null,
            round: round,
            roundLabel: this.#getRoundLabel(round, numRounds),
            nextMatchId: null,
            nextMatchSlot: pos % 2 === 0 ? "home" : "away",
          };

          const req = stores.matches.add(match);
          const r = round;
          const p = pos;
          req.onsuccess = () => {
            idMap[r][p] = req.result;
            totalCreated++;
            if (totalCreated >= total) linkMatches();
          };
        }
      }
    });

    return total;
  }
}

LH.bracket = new BracketService();
LH.BracketService = BracketService;
