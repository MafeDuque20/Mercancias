// ==========================================================================
// TALMA DATA CENTER — Barra de filtros compartida (chips + resumen)
// ==========================================================================
import { store } from "./store.js";
import { uniqueSorted, debounce } from "./utils.js";
import { resumen } from "./agregados.js";

const SELECTS = [
  { id: "filtroBase", campo: "BASE" },
  { id: "filtroGrupo", campo: "GRUPO" },
  { id: "filtroCurso", campo: "CURSO" },
  { id: "filtroSalon", campo: "SALON" },
  { id: "filtroInstructor", campo: "INSTRUCTOR" },
];

const CLAVES_NORMALIZADA = {
  busqueda: "busqueda", desde: "desde", hasta: "hasta",
  semestre: "semestre", asistio: "asistio",
  filtroBase: "base", filtroGrupo: "grupo", filtroCurso: "curso",
  filtroInstructor: "instructor", filtroSalon: "salon",
};

let invFiltros = null;
export function initFiltros() {
  const barra = document.getElementById("filtroBarContainer");
  if (!barra) return;
  barra.innerHTML = `
    <div class="filter-bar">
      <div class="fb-item fb-search">
        <label class="filter-label">Buscar</label>
        <input type="text" id="searchInput" class="form-control" placeholder="Colaborador, ID, correo...">
      </div>
      <div class="fb-item">
        <label class="filter-label">Base</label>
        <select id="filtroBase" class="form-select"><option value="">Todas</option></select>
      </div>
      <div class="fb-item">
        <label class="filter-label">Grupo</label>
        <select id="filtroGrupo" class="form-select"><option value="">Todos</option></select>
      </div>
      <div class="fb-item">
        <label class="filter-label">Curso</label>
        <select id="filtroCurso" class="form-select"><option value="">Todos</option></select>
      </div>
      <div class="fb-item">
        <label class="filter-label">Asistencia</label>
        <select id="filtroAsistio" class="form-select">
          <option value="">Todas</option><option value="SÍ">Asistió</option><option value="NO">No asistió</option>
        </select>
      </div>
      <div class="fb-item">
        <button class="btn btn-sm btn-outline-navy" id="toggleMasFiltros" type="button">
          <i class="fa-solid fa-sliders me-1"></i> Más filtros
        </button>
      </div>
    </div>
    <div class="filter-bar mt-2 d-none" id="masFiltrosBar">
      <div class="fb-item">
        <label class="filter-label">Desde</label>
        <input type="date" id="filtroFechaDesde" class="form-control">
      </div>
      <div class="fb-item">
        <label class="filter-label">Hasta</label>
        <input type="date" id="filtroFechaHasta" class="form-control">
      </div>
      <div class="fb-item">
        <label class="filter-label">Semestre</label>
        <select id="filtroSemestre" class="form-select">
          <option value="todos">Todos</option><option value="1">Semestre 1</option><option value="2">Semestre 2</option>
        </select>
      </div>
      <div class="fb-item">
        <label class="filter-label">Salón</label>
        <select id="filtroSalon" class="form-select"><option value="">Todos</option></select>
      </div>
      <div class="fb-item">
        <label class="filter-label">Instructor</label>
        <select id="filtroInstructor" class="form-select"><option value="">Todos</option></select>
      </div>
      <div class="fb-item align-self-end">
        <button class="btn btn-sm btn-outline-secondary" id="btnLimpiarFiltros" type="button">
          <i class="fa-solid fa-eraser me-1"></i> Limpiar filtros
        </button>
      </div>
    </div>
    <div id="filterChips" class="filter-chips"></div>
    <div id="filterSummary" class="filter-result-summary"></div>`;

  document.getElementById("toggleMasFiltros").addEventListener("click", () => {
    document.getElementById("masFiltrosBar").classList.toggle("d-none");
  });

  document.getElementById("btnLimpiarFiltros").addEventListener("click", () => {
    store.clearFiltros();
    sincronizarControles(store);
  });

  const debounced = debounce(() => store.setFiltro("busqueda", document.getElementById("searchInput").value), 200);
  document.getElementById("searchInput").addEventListener("input", debounced);

  Object.keys(CLAVES_NORMALIZADA).forEach(id => {
    const el = document.getElementById(id);
    if (!el || id === "searchInput") return;
    el.addEventListener("change", () => store.setFiltro(CLAVES_NORMALIZADA[id], el.value));
  });

  invFiltros = store.subscribe(renderUI);
  renderUI(store);
}

function renderUI(s) {
  poblarSelects(s.data);
  renderChips(s.filtrosActivos());
  renderSummary(s.filtered);
  sincronizarControles(s);
}

function poblarSelects(data) {
  SELECTS.forEach(({ id, campo }) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const actual = store.filtros[CLAVES_NORMALIZADA[id]] || "";
    const valores = uniqueSorted(data.map(d => d[campo]));
    sel.innerHTML = `<option value="">${labelTodos(id)}</option>` +
      valores.map(v => `<option value="${escapeAttr(v)}">${escapePlain(v)}</option>`).join("");
    sel.value = valores.includes(actual) ? actual : "";
  });
}

function labelTodos(id) {
  const mapa = { filtroBase: "Todas", filtroGrupo: "Todos", filtroCurso: "Todos", filtroSalon: "Todos", filtroInstructor: "Todos" };
  return mapa[id] || "Todos";
}

function renderChips(activos) {
  const cont = document.getElementById("filterChips");
  if (!cont) return;
  if (activos.length === 0) { cont.innerHTML = ""; return; }
  cont.innerHTML = activos.map(f =>
    `<button class="filter-chip" data-clave="${f.clave}" title="Quitar filtro: ${escapePlain(f.etiqueta)}">
       ${escapePlain(f.etiqueta)}: ${escapePlain(f.valor)}
       <span class="fc-remove"><i class="fa-solid fa-xmark"></i></span>
     </button>`).join("");
  cont.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const clave = chip.dataset.clave;
      store.setFiltro(clave, clave === "semestre" ? "todos" : "");
      // Forzamos la limpieza visual del control aunque el foco esté en otro sitio.
      const id = Object.keys(CLAVES_NORMALIZADA).find(k => CLAVES_NORMALIZADA[k] === clave);
      const el = id ? document.getElementById(id) : null;
      if (el) el.value = clave === "semestre" ? "todos" : "";
    });
  });
}

function renderSummary(dataFiltrada) {
  const cont = document.getElementById("filterSummary");
  if (!cont) return;
  const s = resumen(dataFiltrada);
  cont.innerHTML =
    `<strong>${s.registros}</strong> registro(s) · <strong>${s.personasUnicas}</strong> persona(s) única(s) · ` +
    `<strong>${s.grupos}</strong> grupo(s) · <strong>${s.cursos}</strong> curso(s)`;
}

function sincronizarControles(s) {
  const f = s.filtros;
  Object.entries(CLAVES_NORMALIZADA).forEach(([id, clave]) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el && el.type !== "date") {
      // El input de búsqueda también se evita para no interrumpir tipeo.
      if (id === "searchInput") { el.value = f.busqueda; return; }
      el.value = f[clave] ?? (clave === "semestre" ? "todos" : "");
    } else if (el && el.type === "date") {
      el.value = f[clave] ?? "";
    }
  });
}

function escapeAttr(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapePlain(str) { return escapeAttr(str); }
