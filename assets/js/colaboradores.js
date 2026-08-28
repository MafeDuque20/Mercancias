// ==========================================================================
// TALMA DATA CENTER — Vista COLABORADORES (personas únicas)
// ==========================================================================
import { agregarPorPersona } from "./agregados.js";
import { escapeHtml, renderKpiStrip } from "./ui.js";
import { formatFechaDisplay } from "./utils.js";
import { estadosPorPersona, coloresEstadoCapacitacion } from "./capacitacion.js";
import { store } from "./store.js";

function chipEstadoGlobal(estado) {
  const { etiqueta, icono } = estado;
  const { color, soft } = coloresEstadoCapacitacion(estado.estado);
  return `<span class="est-chip ${soft}" style="--chip-color:${color}"><i class="fa-solid ${icono}"></i> ${etiqueta}</span>`;
}

export function renderColaboradores(s) {
  const personas = agregarPorPersona(s.filtered);
  const conAsistencia = personas.filter(p => p.asistencias > 0).length;
  const conInasistencia = personas.filter(p => p.inasistencias > 0).length;
  const conNota = personas.filter(p => p.promedioNota !== null);
  const promedioGlobal = conNota.length
    ? conNota.reduce((a, p) => a + p.promedioNota, 0) / conNota.length
    : null;

  // Estado de capacitación por persona (sobre TODOS sus registros).
  const estados = new Map();
  personas.forEach(p => {
    const recs = p.registros;
    const e = estadosPorPersona(recs, s.estadoHoy);
    estados.set(p.key, e);
  });

  renderKpiStrip("colabKpis", [
    { label: "Personas únicas", value: personas.length, icon: '<i class="fa-solid fa-users" style="color:#fff"></i>', color: "bg-teal" },
    { label: "Con asistencia", value: conAsistencia, icon: '<i class="fa-solid fa-user-check" style="color:#fff"></i>', color: "bg-si" },
    { label: "Con inasistencia", value: conInasistencia, icon: '<i class="fa-solid fa-user-xmark" style="color:#fff"></i>', color: "bg-no" },
    { label: "Promedio de nota", value: promedioGlobal === null ? "—" : promedioGlobal.toFixed(1), icon: '<i class="fa-solid fa-star-half-stroke" style="color:#fff"></i>', color: "bg-orange" },
  ]);

  const tbody = document.getElementById("colaboradoresTbody");
  if (!tbody) return;
  if (personas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted">No hay personas que coincidan con los filtros.</td></tr>';
    return;
  }

  tbody.innerHTML = personas.map(p => {
    const e = estados.get(p.key);
    const chip = e && e.global ? chipEstadoGlobal(e.global.estado) : '<span class="est-chip soft-gray" style="--chip-color:#8a94a6"><i class="fa-solid fa-circle"></i> Sin registro</span>';
    return `
    <tr>
      <td><span class="person-link" data-open-perfil="${escapeHtml(p.ID)}">${escapeHtml(p.NOMBRES)}</span></td>
      <td class="mono">${escapeHtml(p.ID || "—")}</td>
      <td>${escapeHtml(p.CARGO || "—")}</td>
      <td>${escapeHtml(p.BASE || "—")}</td>
      <td title="${escapeHtml(p.CORREO)}">${escapeHtml(p.CORREO || "—")}</td>
      <td class="mono">${p.totalCursos}</td>
      <td>${p.asistencias} / ${p.inasistencias}</td>
      <td>${chip}</td>
      <td class="mono">${formatFechaDisplay(p.ultimaFecha)}</td>
    </tr>`;
  }).join("");
}
