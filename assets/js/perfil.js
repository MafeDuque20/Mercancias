// ==========================================================================
// TALMA DATA CENTER — Perfil de colaborador (overlay)
// Ficha individual: resumen, información personal, historial y documentos.
// ==========================================================================
import { store } from "./store.js";
import { agregarPorPersona } from "./agregados.js";
import { escapeHtml, asistenciaPill, formatBytes, promedioFmt } from "./ui.js";
import { formatFechaDisplay, showToast } from "./utils.js";
import { estadosPorPersona, estadoDeRegistro, coloresEstadoCapacitacion, addMeses, diffDias, vigenciaMesesCurso } from "./capacitacion.js";
import {
  suscribirDocumentos, subirDocumento, eliminarDocumento, obtenerUrlDescarga,
} from "./documentos.js";

let currentPersonId = null;
let unsubDocs = null;

function overlay() { return document.getElementById("profileOverlay"); }

export function abrirPerfil(id) {
  if (!id) return;
  currentPersonId = id;
  overlay().classList.add("open");
  renderPerfil(store);
  if (unsubDocs) unsubDocs();
  unsubDocs = suscribirDocumentos(id, (docs, err) => {
    renderDocs(docs, err);
  });
}

export function cerrarPerfil() {
  overlay().classList.remove("open");
  currentPersonId = null;
  if (unsubDocs) { unsubDocs(); unsubDocs = null; }
}

// Se re-renderiza cuando cambian los datos y el perfil está abierto.
export function renderPerfil(s) {
  if (!currentPersonId || !overlay().classList.contains("open")) return;

  const persona = agregarPorPersona(s.data).find(p => p.ID === currentPersonId || p.key === currentPersonId);
  const cont = document.getElementById("profileContent");
  if (!cont) return;

  if (!persona) {
    cont.innerHTML = `<div class="profile-body"><p class="text-muted">No se encontró información del colaborador.</p></div>`;
    return;
  }

  const nombre = escapeHtml(persona.NOMBRES);
  const res = {
    cursos: persona.totalCursos,
    asist: persona.asistencias,
    inasist: persona.inasistencias,
    prom: persona.promedioNota,
  };

  cont.innerHTML = `
    <div class="profile-header">
      <button class="p-close" onclick="cerrarPerfil()" aria-label="Cerrar perfil"><i class="fa-solid fa-xmark"></i></button>
      <div class="profile-name">${nombre}</div>
      <div class="profile-meta">
        ID: ${escapeHtml(persona.ID || "—")} · ${escapeHtml(persona.CARGO || "—")} · Base: ${escapeHtml(persona.BASE || "—")}
        ${persona.CORREO ? ` · ${escapeHtml(persona.CORREO)}` : ""}
      </div>
    </div>
    <div class="profile-body">

      <div class="profile-section">
        <div class="section-title mb-2"><span class="hz-diamond bg-navy"><i class="fa-solid fa-chart-simple" style="color:#fff"></i></span>Resumen</div>
        <div class="profile-kpis">
          <div class="kpi-card"><div><div class="kpi-value">${res.cursos}</div><div class="kpi-label">Cursos realizados</div></div></div>
          <div class="kpi-card"><div><div class="kpi-value" style="color:var(--dg-green)">${res.asist}</div><div class="kpi-label">Asistencias</div></div></div>
          <div class="kpi-card"><div><div class="kpi-value" style="color:var(--dg-red)">${res.inasist}</div><div class="kpi-label">Inasistencias</div></div></div>
          <div class="kpi-card"><div><div class="kpi-value">${promedioFmt(res.prom)}</div><div class="kpi-label">Promedio de nota</div></div></div>
          <div class="kpi-card"><div><div class="kpi-value" style="font-size:0.8rem;">${escapeHtml(persona.ultimoCurso || "—")}</div><div class="kpi-label">Último curso</div></div></div>
        </div>
      </div>

      <div class="profile-section">
        <div class="section-title mb-2"><span class="hz-diamond bg-si"><i class="fa-solid fa-shield-halved" style="color:#fff"></i></span>Estado de capacitación</div>
        ${renderEstadoCapacitacion(persona.registros)}
      </div>

      <div class="profile-section">
        <div class="section-title mb-2"><span class="hz-diamond bg-teal"><i class="fa-solid fa-id-card" style="color:#fff"></i></span>Información personal</div>
        <div class="info-grid">
          ${infoItem("ID", persona.ID)}
          ${infoItem("Nombres", persona.NOMBRES)}
          ${infoItem("Cargo", persona.CARGO)}
          ${infoItem("Correo", persona.CORREO)}
          ${infoItem("Base", persona.BASE)}
          ${infoItem("Empresa", persona.EMPRESA)}
        </div>
      </div>

      <div class="profile-section">
        <div class="section-title mb-2"><span class="hz-diamond bg-navy"><i class="fa-solid fa-graduation-cap" style="color:#fff"></i></span>Historial de capacitación</div>
        <div class="table-responsive" style="max-height:none;">
          <table class="mini-table">
            <thead><tr>
              <th>Curso</th><th>Fecha</th><th>Vencimiento</th><th>Estado</th><th>Grupo</th><th>Instructor</th><th>Asistencia</th>
            </tr></thead>
            <tbody>
              ${persona.registros.slice().sort((a, b) => (b.FECHA || "").localeCompare(a.FECHA || "")).map(r => {
                const e = estadoDeRegistroLocal(r);
                return `
                <tr>
                  <td>${escapeHtml(r.CURSO || "—")}</td>
                  <td class="mono">${formatFechaDisplay(r.FECHA)}</td>
                  <td class="mono">${e.vencimiento ? formatFechaDisplay(e.vencimiento) : "—"}</td>
                  <td>${chipPerfilEstado(e)}</td>
                  <td>${escapeHtml(r.GRUPO || "—")}</td>
                  <td>${escapeHtml(r.INSTRUCTOR || "—")}</td>
                  <td>${asistenciaPill(r)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="profile-section">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="section-title mb-0"><span class="hz-diamond bg-orange"><i class="fa-solid fa-folder-open" style="color:#fff"></i></span>Documentos</div>
          <button class="btn btn-sm btn-navy" onclick="adjuntarDocumento('${escapeHtml(persona.ID)}')"><i class="fa-solid fa-paperclip me-1"></i>Adjuntar documento</button>
        </div>
        <div id="docsList"></div>
      </div>

    </div>`;
}

function infoItem(label, value) {
  return `<div><div class="ig-label">${label}</div><div class="ig-value">${escapeHtml(value || "—")}</div></div>`;
}

function chipPerfilEstado(estado) {
  const { color, soft } = coloresEstadoCapacitacion(estado.estado);
  return `<span class="est-chip ${soft}" style="--chip-color:${color}"><i class="fa-solid ${estado.icono}"></i> ${estado.etiqueta}</span>`;
}

function estadoDeRegistroLocal(rec) {
  return estadoDeRegistro(rec, store.estadoHoy);
}

// Sección "Estado de capacitación" del perfil: por curso, con vencimiento,
// estado actual y próxima recurrencia sugerida.
function renderEstadoCapacitacion(registros) {
  const e = estadosPorPersona(registros, store.estadoHoy);
  if (!e.cursos.length) {
    return `<div class="text-muted small">Sin registros de capacitación.</div>`;
  }
  const items = e.cursos.map(c => {
    const hoy = store.estadoHoy;
    const proxima = c.fecha ? addMeses(c.fecha, vigenciaMesesCurso(c.curso)) : "";
    const dias = c.fecha && proxima ? diffDias(proxima, hoy) : null;
    const recurrencia = dias !== null && dias <= 0;
    return `
      <div class="estado-curso-item">
        <div class="estado-curso-head">
          <strong>${escapeHtml(c.curso)}</strong>
          ${chipPerfilEstado(c.estado)}
        </div>
        <div class="estado-curso-grid">
          <div><span class="ec-label">Última capacitación</span><span class="ec-value">${c.fecha ? formatFechaDisplay(c.fecha) : "—"}</span></div>
          <div><span class="ec-label">Vence</span><span class="ec-value">${c.vencimiento ? formatFechaDisplay(c.vencimiento) : "—"}</span></div>
          <div><span class="ec-label">Próxima recurrencia</span><span class="ec-value">${proxima ? formatFechaDisplay(proxima) : "—"}${recurrencia ? " <span class='ec-urgente'>(ya vencida)</span>" : ""}</span></div>
          <div><span class="ec-label">Registros</span><span class="ec-value">${c.registros}</span></div>
        </div>
      </div>`;
  }).join("");
  return `<div class="estado-cursos">${items}</div>`;
}

function docIcon(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("pdf")) return "fa-file-pdf";
  if (t.includes("word") || t.includes("doc")) return "fa-file-word";
  if (t.includes("sheet") || t.includes("excel") || t.includes("csv")) return "fa-file-excel";
  if (t.includes("image") || t.includes("png") || t.includes("jpg")) return "fa-file-image";
  if (t.includes("zip") || t.includes("rar")) return "fa-file-zipper";
  return "fa-file-lines";
}

function renderDocs(docs, err) {
  const cont = document.getElementById("docsList");
  if (!cont) return;
  if (err) {
    cont.innerHTML = `<div class="doc-empty" style="color:var(--dg-red)"><i class="fa-solid fa-triangle-exclamation me-1"></i>No se pudieron cargar los documentos: ${escapeHtml(err.message || String(err))}</div>`;
    return;
  }
  if (!docs || docs.length === 0) {
    cont.innerHTML = `<div class="doc-empty">Todavía no hay documentos adjuntos para este colaborador.</div>`;
    return;
  }
  cont.innerHTML = docs.map(d => `
    <div class="doc-item">
      <div class="doc-icon"><i class="fa-solid ${docIcon(d.tipo)}"></i></div>
      <div>
        <div class="doc-name">${escapeHtml(d.nombre || "Documento")}</div>
        <div class="doc-meta">${escapeHtml(d.tipo || "desconocido")} · ${formatBytes(d.size)} · ${formatFechaDisplay((d.fecha || "").slice(0, 10))} · ${escapeHtml(d.uploader || "—")}</div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-sm btn-outline-navy py-0 px-1" title="Ver" onclick="verDocumento('${d._docId}')"><i class="fa-solid fa-eye"></i></button>
        <button class="btn btn-sm btn-outline-success py-0 px-1" title="Descargar" onclick="descargarDocumento('${d._docId}')"><i class="fa-solid fa-download"></i></button>
        <button class="btn btn-sm btn-outline-danger py-0 px-1" title="Eliminar" onclick="eliminarDocConfirm('${d._docId}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join("");

  // Guardamos una copia accesible para las acciones
  window.__tdcDocs = docs;
}

window.cerrarPerfil = cerrarPerfil;
window.abrirPerfil = abrirPerfil;

window.adjuntarDocumento = function (personaId) {
  const input = document.getElementById("docFileInput");
  input.dataset.persona = personaId;
  input.value = "";
  input.click();
};

async function handleDocFileChange(input) {
  const file = input.files[0];
  if (!file) return;
  const personaId = input.dataset.persona;
  const persona = agregarPorPersona(store.data).find(p => p.ID === personaId);
  try {
    showToast("Subiendo documento...", "info");
    await subirDocumento(personaId, persona ? persona.NOMBRES : "", file);
    showToast(`Documento "${file.name}" cargado correctamente.`, "success");
  } catch (err) {
    console.error("[DOCUMENTOS] Error al subir:", err);
    showToast(`No se pudo subir el documento: ${err.message || err}`, "danger");
  }
}

window.verDocumento = async function (docId) {
  const d = (window.__tdcDocs || []).find(x => x._docId === docId);
  if (!d) return;
  try {
    const url = await obtenerUrlDescarga(d);
    window.open(url, "_blank");
  } catch (err) {
    showToast("No se pudo abrir el documento.", "danger");
  }
};

window.descargarDocumento = async function (docId) {
  const d = (window.__tdcDocs || []).find(x => x._docId === docId);
  if (!d) return;
  try {
    const url = await obtenerUrlDescarga(d);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.nombre || "documento";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    showToast("No se pudo descargar el documento.", "danger");
  }
};

window.eliminarDocConfirm = async function (docId) {
  const d = (window.__tdcDocs || []).find(x => x._docId === docId);
  if (!d) return;
  if (!confirm(`¿Eliminar el documento "${d.nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await eliminarDocumento(d);
    showToast("Documento eliminado.", "success");
  } catch (err) {
    console.error(err);
    showToast("No se pudo eliminar el documento.", "danger");
  }
};

export function initPerfil() {
  overlay().addEventListener("click", (e) => {
    if (e.target === overlay()) cerrarPerfil();
  });
  document.getElementById("docFileInput").addEventListener("change", (e) => handleDocFileChange(e.target));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay().classList.contains("open")) cerrarPerfil();
  });
}
