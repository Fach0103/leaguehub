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

        const leagues = db.createObjectStore("leagues", {
          keyPath: "id",
          autoIncrement: true,
        });
        leagues.createIndex("name", "name", { unique: true });
        leagues.createIndex("isActive", "isActive");

        const teams = db.createObjectStore("teams", {
          keyPath: "id",
          autoIncrement: true,
        });
        teams.createIndex("leagueId", "leagueId");
        teams.createIndex("name", "name");

        const players = db.createObjectStore("players", {
          keyPath: "id",
          autoIncrement: true,
        });
        players.createIndex("teamId", "teamId");
        players.createIndex("name", "name");

        const matches = db.createObjectStore("matches", {
          keyPath: "id",
          autoIncrement: true,
        });
        matches.createIndex("leagueId", "leagueId");
        matches.createIndex("homeTeamId", "homeTeamId");
        matches.createIndex("awayTeamId", "awayTeamId");
        matches.createIndex("date", "date");
        matches.createIndex("status", "status");

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

            try {
              tx.abort();
            } catch (e) {

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
