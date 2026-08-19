// ==========================================================================
// TALMA DATA CENTER — Vista GRUPOS (+ detalle)
// ==========================================================================
import { agregarPorGrupo } from "./agregados.js";
import { escapeHtml, asistenciaPill, promedioFmt } from "./ui.js";
import { formatFechaDisplay } from "./utils.js";

export function renderGrupos(s) {
  const grupos = agregarPorGrupo(s.filtered);
  const tbody = document.getElementById("gruposTbody");
  if (!tbody) return;
  if (grupos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted">No hay grupos que coincidan con los filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = grupos.map(g => `
    <tr>
      <td><span class="person-link" data-open-grupo="${escapeHtml(g.grupo)}">${escapeHtml(g.grupo)}</span></td>
      <td title="${escapeHtml(g.curso)}">${escapeHtml(g.curso || "—")}</td>
      <td class="mono">${formatFechaDisplay(g.fecha)}</td>
      <td>${escapeHtml(g.instructor || "—")}</td>
      <td class="mono">${g.resumen.registros}</td>
      <td>${g.resumen.asistieron} / ${g.resumen.noAsistieron}</td>
      <td class="mono">${g.resumen.pctAsistencia}%</td>
    </tr>`).join("");
}

export function renderGrupoDetalle(s, nombre) {
  const cont = document.getElementById("grupoDetalleContent");
  if (!cont) return;
  const grupos = agregarPorGrupo(s.data);
  const grupo = grupos.find(g => g.grupo === nombre);
  if (!grupo) {
    cont.innerHTML = `
      <button class="btn btn-sm btn-outline-navy back-btn" onclick="location.hash='#grupos'"><i class="fa-solid fa-arrow-left me-1"></i>Volver a grupos</button>
      <div class="text-muted">No se encontró el grupo "${escapeHtml(nombre)}".</div>`;
    return;
  }
  const r = grupo.resumen;
  cont.innerHTML = `
    <button class="btn btn-sm btn-outline-navy back-btn" onclick="location.hash='#grupos'"><i class="fa-solid fa-arrow-left me-1"></i>Volver a grupos</button>
    <div class="detail-hero">
      <div class="detail-title">Grupo ${escapeHtml(grupo.grupo)}</div>
      <div class="detail-sub">
        ${escapeHtml(grupo.programa || "")}${grupo.programa && grupo.curso ? " · " : ""}${escapeHtml(grupo.curso || "")}
        ${grupo.fecha ? ` · ${formatFechaDisplay(grupo.fecha)}` : ""}
        ${grupo.base ? ` · ${escapeHtml(grupo.base)}` : ""}
        ${grupo.instructor ? ` · Instructor: ${escapeHtml(grupo.instructor)}` : ""}
        ${grupo.salon ? ` · Salón: ${escapeHtml(grupo.salon)}` : ""}
      </div>
    </div>
    <div class="kpi-strip mb-3">
      <div class="kpi-card"><div><div class="kpi-value">${r.registros}</div><div class="kpi-label">Registros</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value" style="color:var(--dg-green)">${r.asistieron}</div><div class="kpi-label">Asistentes</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value" style="color:var(--dg-red)">${r.noAsistieron}</div><div class="kpi-label">Inasistencias</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${r.pctAsistencia}%</div><div class="kpi-label">% asistencia</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${promedioFmt(r.promedioNota)}</div><div class="kpi-label">Promedio de nota</div></div></div>
    </div>
    <div class="section-title"><span class="hz-diamond bg-navy"><i class="fa-solid fa-users" style="color:#fff"></i></span>Participantes</div>
    <div class="card card-custom p-3">
      <div class="table-responsive" style="max-height:55vh;">
        <table class="table table-hover border align-middle mb-0">
          <thead class="table-dark-custom">
            <tr><th>Nombre</th><th>ID</th><th>Cargo</th><th>Asistencia</th><th>Nota</th><th>Observación</th></tr>
          </thead>
          <tbody>
            ${grupo.registros.slice().sort((a, b) => a.NOMBRES.localeCompare(b.NOMBRES, "es")).map(p => `
              <tr>
                <td><span class="person-link" data-open-perfil="${escapeHtml(p.ID || "")}">${escapeHtml(p.NOMBRES || "—")}</span></td>
                <td class="mono">${escapeHtml(p.ID || "—")}</td>
                <td>${escapeHtml(p.CARGO || "—")}</td>
                <td>${asistenciaPill(p)}</td>
                <td class="mono">${escapeHtml(p.NOTA || "—")}</td>
                <td title="${escapeHtml(p.OBSERVACION)}">${escapeHtml(p.OBSERVACION || "—")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}
