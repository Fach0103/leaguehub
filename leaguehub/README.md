# LeagueHub — Gestor de Liga Deportiva

Aplicación web SPA para gestionar ligas deportivas amateur, construida con HTML, CSS y JavaScript vanilla.

## Integrantes

- Abraham Chourio
-

### División del Trabajo

| Estudiante A | Estudiante B |
|---|---|
| Capa de IndexedDB y transacciones | Vistas #teams y #team/:id |
| Vistas #matches y #match/:id | Vistas #players y #player/:id |
| Operación finalizar / deshacer partido | Vista #stats con tabla y gráficos |
| Vista #leagues y export/import JSON | Vista #dashboard con gráficos |
| Componentes: EventForm, MatchCard | Componentes: StandingsTable, RankingTable, ChartContainer |

**Construido en pareja:** Router, NavBar, Footer, ConfirmDialog, Toast, LoadingState, estilos globales, BracketView, lógica de bracket.

## Catálogo de Deportes Soportados

| Deporte | Clave | Evento | Etiqueta GF/GC | Ranking | Color Acento |
|---|---|---|---|---|---|
| Fútbol | `futbol` | Gol / Goles | GF / GC | Goleadores | Verde (#2e7d32) |
| Básquet | `basquet` | Canasta / Canastas | PF / PC | Encestadores | Naranja (#e65100) |
| Vóley | `voley` | Punto / Puntos | PF / PC | Anotadores | Azul (#1565c0) |

### Mapa de terminología

La adaptación por deporte se centraliza en `js/sports-terms.js`. Todos los componentes leen de este mapa en lugar de tener strings hardcodeados.

## Instrucciones para Ejecutar

1. Clonar o descargar el repositorio.
2. Abrir `index.html` directamente en el navegador (Chrome, Firefox, Edge).
3. No requiere servidor local ni instalación de dependencias.
4. Los datos se persisten automáticamente en IndexedDB (local en el navegador).
5. Usar el botón **"Datos de ejemplo"** en la vista Ligas para poblar la base de datos con contenido de prueba.

## Componentes Implementados

| Componente | Descripción |
|---|---|
| `NavBar` | Barra de navegación global con liga activa y enlaces |
| `Footer` | Créditos e indicador de estado de IndexedDB |
| `LeagueCard` | Tarjeta de liga con acciones (editar, activar, exportar, eliminar) |
| `TeamCard` | Tarjeta de equipo con escudo |
| `PlayerCard` | Tarjeta de jugador con foto |
| `MatchCard` | Tarjeta de partido con marcador o estado |
| `BracketView` | Representación visual del bracket (eliminación directa) |
| `StandingsTable` | Tabla de posiciones (modalidad liga) |
| `RankingTable` | Ranking de anotadores |
| `EventForm` | Sub-formulario para registrar anotaciones en un partido |
| `ChartContainer` | Envolvente para gráficos Chart.js |
| `ConfirmDialog` | Diálogo modal de confirmación |
| `Toast` | Notificaciones flotantes de éxito/error |
| `LoadingState` | Indicador visual de carga |

## Esquema de IndexedDB

**Base de datos:** `leaguehub-db` (versión 1)

### Object Stores

| Store | Key Path | Índices |
|---|---|---|
| `leagues` | `id` (autoIncrement) | `name` (único), `isActive` |
| `teams` | `id` (autoIncrement) | `leagueId`, `name` |
| `players` | `id` (autoIncrement) | `teamId`, `name` |
| `matches` | `id` (autoIncrement) | `leagueId`, `homeTeamId`, `awayTeamId`, `date`, `status` |
| `events` | `id` (autoIncrement) | `matchId`, `playerId` |

### Relaciones

```
League 1 ── N Team
Team   1 ── N Player
League 1 ── N Match
Match  1 ── N Event
Player 1 ── N Event
```

### Transacciones de integridad

Las siguientes operaciones se ejecutan dentro de una sola transacción IndexedDB:

1. **Finalizar partido** — actualiza match, teams, players, events y avanza ganador en bracket (6 stores).
2. **Deshacer partido** — revierte match, teams, players y limpia slot del bracket.
3. **Eliminar liga en cascada** — borra league, teams, players, matches, events.
4. **Importar liga** — crea league, teams, players, matches, events.
5. **Activar liga** — actualiza isActive en todos los registros de leagues.

## Decisiones Técnicas

### Puntos de tabla
Se calculan al vuelo (`pg * 3 + pe * 1`) donde se necesiten, no se almacenan como campo aparte. Esto evita desincronización.

### Algoritmo de fixture (round-robin)
Se implementa el método del círculo: se fija un equipo y se rotan los demás, generando `n-1` rondas. Soporta una vuelta o ida y vuelta.

### Generación del bracket
Se crean los partidos en orden inverso (final primero) dentro de una sola transacción. Los IDs generados por autoIncrement se capturan en `onsuccess` para enlazar los partidos (`nextMatchId`).

### Eventos de partido
No se persisten hasta que se finaliza el partido, momento en el que se persisten junto con la actualización de todas las entidades afectadas en una sola transacción.

### Chart.js
Única librería externa permitida. Se carga desde CDN. Los gráficos se renderizan al navegar a las vistas y se destruyen/crean al navegar de vuelta.

## Capturas de Pantalla

*(Insertar capturas de las 9 vistas aquí)*

## Vistas del Sistema

| ID | Vista | Ruta |
|---|---|---|
| V-01 | Dashboard | `#dashboard` |
| V-02 | Ligas | `#leagues` |
| V-03 | Equipos | `#teams` |
| V-04 | Detalle de Equipo | `#team/:id` |
| V-05 | Jugadores | `#players` |
| V-06 | Detalle de Jugador | `#player/:id` |
| V-07 | Partidos | `#matches` |
| V-08 | Detalle de Partido | `#match/:id` |
| V-09 | Estadísticas | `#stats` |
