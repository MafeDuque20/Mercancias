// ==========================================================================
// TALMA DATA CENTER — Boot (SPA)
// Inicializa la conexión a Firestore, el router, los filtros compartidos y
// orquesta el re-render de la vista activa cada vez que cambian los datos
// o los filtros. Toda la app consume una única fuente: store.filtered.
// ==========================================================================
import { store } from "./store.js";
import { defineRoute, initRouter, route, navigate } from "./router.js";
import { initFiltros } from "./filtros.js";
import { initAsistencias, render as renderAsistencias } from "./asistencias.js";
import { renderDashboard } from "./dashboard.js";
import { renderColaboradores } from "./colaboradores.js";
import { renderGrupos, renderGrupoDetalle } from "./grupos.js";
import { renderCursos, renderCursoDetalle } from "./cursos.js";
import { renderAnalitica } from "./analitica.js";
import { initPerfil, abrirPerfil, renderPerfil, cerrarPerfil } from "./perfil.js";
import { renderEstado, escapeHtml } from "./ui.js";
import { showToast } from "./utils.js";

let currentRoute = { name: "inicio", param: "" };

/* ------------------------------ Rutas ------------------------------ */
defineRoute("inicio", () => renderDashboard(store));
defineRoute("asistencias", () => renderAsistencias(store));
defineRoute("colaboradores", () => renderColaboradores(store));
defineRoute("cursos", () => renderCursos(store));
defineRoute("grupos", () => renderGrupos(store));
defineRoute("analitica", () => renderAnalitica(store));
defineRoute("grupo", (nombre) => renderGrupoDetalle(store, nombre));
defineRoute("curso", (nombre) => renderCursoDetalle(store, nombre));

/* ------------------------------ Render central ------------------------------ */
function renderCurrent() {
  switch (currentRoute.name) {
    case "inicio": renderDashboard(store); break;
    case "asistencias": renderAsistencias(store); break;
    case "colaboradores": renderColaboradores(store); break;
    case "cursos": renderCursos(store); break;
    case "grupos": renderGrupos(store); break;
    case "analitica": renderAnalitica(store); break;
    case "grupo": renderGrupoDetalle(store, currentRoute.param); break;
    case "curso": renderCursoDetalle(store, currentRoute.param); break;
  }
  renderPerfil(store); // si hay perfil abierto, se mantiene sincronizado
}

function renderChrome() {
  renderEstado(store, "connectionBadge", "loadErrorPanel");
  const total = document.getElementById("totalRecords");
  if (total) total.innerText = store.sizeCrudo;
  const ult = document.getElementById("lastUpdated");
  if (ult) ult.innerText = store.ultimaActualizacion ? `Actualizado: ${store.ultimaActualizacion}` : "";
}

/* ------------------------------ Botones globales ------------------------------ */
window.actualizarDatos = async function () {
  const botones = ["btnActualizarDatos", "btnActualizarDatosDash"];
  botones.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin me-1"></i> Actualizando...'; }
  });
  const r = await store.actualizar();
  botones.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrows-rotate me-1"></i> Actualizar datos'; }
  });
  if (r.ok) showToast("Datos actualizados desde la nube.", "success");
};

window.reintentarCarga = function () {
  store.connect();
};

// Desde el dashboard: ver solo los que no asistieron en el módulo Asistencias.
window.irANoAsistieron = function () {
  store.setFiltro("asistio", "NO");
  navigate("asistencias");
};

/* ------------------------------ Delegación de clicks (perfil / grupo / curso) ------------------------------ */
document.addEventListener("click", (e) => {
  const perfil = e.target.closest("[data-open-perfil]");
  if (perfil) { e.preventDefault(); abrirPerfil(perfil.dataset.openPerfil); return; }
  const grupo = e.target.closest("[data-open-grupo]");
  if (grupo) { e.preventDefault(); navigate("grupo/" + encodeURIComponent(grupo.dataset.openGrupo)); return; }
  const curso = e.target.closest("[data-open-curso]");
  if (curso) { e.preventDefault(); navigate("curso/" + encodeURIComponent(curso.dataset.openCurso)); return; }
});

/* ------------------------------ Inicio ------------------------------ */
initFiltros();
initAsistencias();
initPerfil();

initRouter((name, param) => {
  currentRoute = { name, param };
  renderCurrent();
});

store.subscribe((s) => {
  renderChrome();
  renderCurrent();
});

store.iniciar();
