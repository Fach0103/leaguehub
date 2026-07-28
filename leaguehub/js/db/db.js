/**
 * db.js
 * Capa de acceso a IndexedDB. NINGÚN otro archivo debe llamar a
 * indexedDB.open(...) o db.transaction(...) directamente fuera de aquí
 * (excepto matchOperations.js en la Fase 4, que necesita transacciones
 * multi-store a medida).
 *
 * Expone:
 *   LH.db.open()                              -> Promise<IDBDatabase>
 *   LH.db.getAll(store)                       -> Promise<Array>
 *   LH.db.getAllByIndex(store, index, value)  -> Promise<Array>
 *   LH.db.get(store, key)                     -> Promise<Object|undefined>
 *   LH.db.add(store, obj)                     -> Promise<key>
 *   LH.db.put(store, obj)                     -> Promise<key>
 *   LH.db.delete(store, key)                  -> Promise<void>
 */
window.LH = window.LH || {};

(function () {
  "use strict";

  const DB_NAME = "leaguehub-db";
  const DB_VERSION = 1;

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (event) => {
        const db = event.target.result;

        // --- leagues ---
        const leagues = db.createObjectStore("leagues", {
          keyPath: "id",
          autoIncrement: true,
        });
        leagues.createIndex("name", "name", { unique: true });
        leagues.createIndex("isActive", "isActive");

        // --- teams ---
        const teams = db.createObjectStore("teams", {
          keyPath: "id",
          autoIncrement: true,
        });
        teams.createIndex("leagueId", "leagueId");
        teams.createIndex("name", "name");

        // --- players ---
        const players = db.createObjectStore("players", {
          keyPath: "id",
          autoIncrement: true,
        });
        players.createIndex("teamId", "teamId");
        players.createIndex("name", "name");

        // --- matches ---
        const matches = db.createObjectStore("matches", {
          keyPath: "id",
          autoIncrement: true,
        });
        matches.createIndex("leagueId", "leagueId");
        matches.createIndex("homeTeamId", "homeTeamId");
        matches.createIndex("awayTeamId", "awayTeamId");
        matches.createIndex("date", "date");
        matches.createIndex("status", "status");

        // --- events ---
        const events = db.createObjectStore("events", {
          keyPath: "id",
          autoIncrement: true,
        });
        events.createIndex("matchId", "matchId");
        events.createIndex("playerId", "playerId");
      };

      req.onsuccess = (event) => resolve(event.target.result);
      req.onerror = (event) => reject(event.target.error);
      req.onblocked = () =>
        reject(new Error("La base de datos está bloqueada por otra pestaña abierta."));
    });

    return dbPromise;
  }

  /** Envuelve una request de IndexedDB en una Promise. */
  function wrapRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const db = await openDB();
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    return wrapRequest(store.getAll());
  }

  async function getAllByIndex(storeName, indexName, value) {
    const db = await openDB();
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    return wrapRequest(store.index(indexName).getAll(value));
  }

  async function get(storeName, key) {
    const db = await openDB();
    const tx = db.transaction([storeName], "readonly");
    const store = tx.objectStore(storeName);
    return wrapRequest(store.get(key));
  }

  async function add(storeName, obj) {
    const db = await openDB();
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    return wrapRequest(store.add(obj));
  }

  async function put(storeName, obj) {
    const db = await openDB();
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    return wrapRequest(store.put(obj));
  }

  async function deleteRecord(storeName, key) {
    const db = await openDB();
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);
    return wrapRequest(store.delete(key));
  }

  /**
   * Ejecuta una transacción "cruda" sobre uno o más stores.
   * `executor(stores, tx)` recibe un objeto { storeName: IDBObjectStore, ... }
   * y debe encadenar TODAS sus operaciones dentro de esta misma transacción
   * (nada de abrir otra transacción adentro, nada de awaits ajenos a ella).
   *
   * La promesa se resuelve recién en tx.oncomplete (éxito atómico real) y
   * se rechaza en tx.onerror / tx.onabort (rollback automático de IndexedDB).
   *
   * Uso típico (ver matchOperations.js en Fase 4):
   *   LH.db.transaction(["matches","teams"], "readwrite", (stores) => {
   *     stores.matches.get(id).onsuccess = (e) => { ... stores.teams.put(...) ... };
   *   });
   */
  function runTransaction(storeNames, mode, executor) {
    return openDB().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(storeNames, mode);
          const stores = {};
          storeNames.forEach((name) => (stores[name] = tx.objectStore(name)));

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error("Transacción cancelada"));

          try {
            executor(stores, tx);
          } catch (err) {
            // Error síncrono lanzado por el executor: abortamos manualmente.
            try {
              tx.abort();
            } catch (e) {
              /* ya podría estar abortada */
            }
            reject(err);
          }
        })
    );
  }

  LH.db = {
    open: openDB,
    getAll,
    getAllByIndex,
    get,
    add,
    put,
    delete: deleteRecord,
    transaction: runTransaction,
  };
})();
