window.LH = window.LH || {};

/**
 * Database
 * Capa de acceso a IndexedDB. Nadie fuera de esta clase (excepto los
 * métodos de MatchOperations, que necesitan transacciones multi-store
 * a medida) debería llamar a indexedDB.open(...) o db.transaction(...)
 * directamente.
 *
 * Se instancia una sola vez como LH.db, pero al ser una clase (en vez
 * de un módulo con funciones sueltas) el nombre/versión de la base son
 * configurables por constructor — útil por ejemplo para tests con una
 * base separada, sin tocar el resto del archivo.
 */
class Database {
  constructor(dbName = "leaguehub-db", dbVersion = 1) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
    this._dbPromise = null;
  }

  open() {
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion);

      req.onupgradeneeded = (event) => this.#onUpgradeNeeded(event);
      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = (event) => reject(event.target.error);
      req.onblocked = () =>
        reject(new Error("La base de datos está bloqueada por otra pestaña abierta."));
    });

    return this._dbPromise;
  }

  #onUpgradeNeeded(event) {
    const db = event.target.result;

    const leagues = db.createObjectStore("leagues", { keyPath: "id", autoIncrement: true });
    leagues.createIndex("name", "name", { unique: true });
    leagues.createIndex("isActive", "isActive");

    const teams = db.createObjectStore("teams", { keyPath: "id", autoIncrement: true });
    teams.createIndex("leagueId", "leagueId");
    teams.createIndex("name", "name");

    const players = db.createObjectStore("players", { keyPath: "id", autoIncrement: true });
    players.createIndex("teamId", "teamId");
    players.createIndex("name", "name");

    const matches = db.createObjectStore("matches", { keyPath: "id", autoIncrement: true });
    matches.createIndex("leagueId", "leagueId");
    matches.createIndex("homeTeamId", "homeTeamId");
    matches.createIndex("awayTeamId", "awayTeamId");
    matches.createIndex("date", "date");
    matches.createIndex("status", "status");

    const events = db.createObjectStore("events", { keyPath: "id", autoIncrement: true });
    events.createIndex("matchId", "matchId");
    events.createIndex("playerId", "playerId");
  }

  /** Envuelve una request de IndexedDB en una Promise. */
  #wrapRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    const db = await this.open();
    const store = db.transaction([storeName], "readonly").objectStore(storeName);
    return this.#wrapRequest(store.getAll());
  }

  async getAllByIndex(storeName, indexName, value) {
    const db = await this.open();
    const store = db.transaction([storeName], "readonly").objectStore(storeName);
    return this.#wrapRequest(store.index(indexName).getAll(value));
  }

  async get(storeName, key) {
    const db = await this.open();
    const store = db.transaction([storeName], "readonly").objectStore(storeName);
    return this.#wrapRequest(store.get(key));
  }

  async add(storeName, obj) {
    const db = await this.open();
    const store = db.transaction([storeName], "readwrite").objectStore(storeName);
    return this.#wrapRequest(store.add(obj));
  }

  async put(storeName, obj) {
    const db = await this.open();
    const store = db.transaction([storeName], "readwrite").objectStore(storeName);
    return this.#wrapRequest(store.put(obj));
  }

  async delete(storeName, key) {
    const db = await this.open();
    const store = db.transaction([storeName], "readwrite").objectStore(storeName);
    return this.#wrapRequest(store.delete(key));
  }

  /**
   * Ejecuta una transacción "cruda" sobre uno o más stores.
   * `executor(stores, tx)` recibe { storeName: IDBObjectStore, ... } y
   * debe encadenar TODAS sus operaciones dentro de esta misma transacción.
   *
   * La promesa se resuelve en tx.oncomplete (éxito atómico real) y se
   * rechaza en tx.onerror / tx.onabort (rollback automático de IndexedDB).
   */
  async transaction(storeNames, mode, executor) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const stores = {};
      storeNames.forEach((name) => (stores[name] = tx.objectStore(name)));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transacción cancelada"));

      try {
        executor(stores, tx);
      } catch (err) {
        try {
          tx.abort();
        } catch (e) {
          /* ya podría estar abortada */
        }
        reject(err);
      }
    });
  }
}

LH.db = new Database();
LH.Database = Database; // exportada por si se necesita instanciar otra (ej. tests)
