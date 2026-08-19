// ==========================================================================
// TALMA DATA CENTER — Vista CURSOS (+ detalle)
// ==========================================================================
import { agregarPorCurso } from "./agregados.js";
import { escapeHtml, asistenciaPill, promedioFmt, percentFmt } from "./ui.js";
import { formatFechaDisplay, uniqueSorted } from "./utils.js";

export function renderCursos(s) {
  const cursos = agregarPorCurso(s.filtered);
  const tbody = document.getElementById("cursosTbody");
  if (!tbody) return;
  if (cursos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted">No hay cursos que coincidan con los filtros.</td></tr>';
    return;
  }
  tbody.innerHTML = cursos.map(c => {
    const r = c.resumen;
    const bases = uniqueSorted(c.registros.map(x => x.BASE)).join(", ") || "—";
    const instructores = uniqueSorted(c.registros.map(x => x.INSTRUCTOR)).join(", ") || "—";
    return `
      <tr>
        <td><span class="person-link" data-open-curso="${escapeHtml(c.curso)}">${escapeHtml(c.curso)}</span></td>
        <td>${escapeHtml(c.programa || "—")}</td>
        <td class="mono">${r.grupos}</td>
        <td class="mono">${r.personasUnicas}</td>
        <td class="mono">${r.asistieron}</td>
        <td class="mono">${r.noAsistieron}</td>
        <td class="mono">${promedioFmt(r.promedioNota)}</td>
        <td title="${escapeHtml(bases)}">${escapeHtml(bases)}</td>
        <td title="${escapeHtml(instructores)}">${escapeHtml(instructores)}</td>
      </tr>`;
  }).join("");
}

export function renderCursoDetalle(s, nombre) {
  const cont = document.getElementById("cursoDetalleContent");
  if (!cont) return;
  const cursos = agregarPorCurso(s.data);
  const curso = cursos.find(c => c.curso === nombre);
  if (!curso) {
    cont.innerHTML = `
      <button class="btn btn-sm btn-outline-navy back-btn" onclick="location.hash='#cursos'"><i class="fa-solid fa-arrow-left me-1"></i>Volver a cursos</button>
      <div class="text-muted">No se encontró el curso "${escapeHtml(nombre)}".</div>`;
    return;
  }
  const r = curso.resumen;
  const registros = curso.registros.slice().sort((a, b) => (b.FECHA || "").localeCompare(a.FECHA || ""));
  cont.innerHTML = `
    <button class="btn btn-sm btn-outline-navy back-btn" onclick="location.hash='#cursos'"><i class="fa-solid fa-arrow-left me-1"></i>Volver a cursos</button>
    <div class="detail-hero">
      <div class="detail-title">${escapeHtml(curso.curso)}</div>
      <div class="detail-sub">${escapeHtml(curso.programa || "—")}</div>
    </div>
    <div class="kpi-strip mb-3">
      <div class="kpi-card"><div><div class="kpi-value">${r.registros}</div><div class="kpi-label">Registros</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${r.personasUnicas}</div><div class="kpi-label">Personas únicas</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${r.grupos}</div><div class="kpi-label">Grupos</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${percentFmt(r.pctAsistencia)}</div><div class="kpi-label">% asistencia</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${promedioFmt(r.promedioNota)}</div><div class="kpi-label">Promedio de nota</div></div></div>
      <div class="kpi-card"><div><div class="kpi-value">${r.instructores}</div><div class="kpi-label">Instructores</div></div></div>
    </div>
    <div class="section-title"><span class="hz-diamond bg-navy"><i class="fa-solid fa-clock-rotate-left" style="color:#fff"></i></span>Histórico del curso</div>
    <div class="card card-custom p-3">
      <div class="table-responsive" style="max-height:55vh;">
        <table class="table table-hover border align-middle mb-0">
          <thead class="table-dark-custom">
            <tr><th>Colaborador</th><th>Fecha</th><th>Grupo</th><th>Base</th><th>Instructor</th><th>Asistencia</th><th>Nota</th></tr>
          </thead>
          <tbody>
            ${registros.map(p => `
              <tr>
                <td><span class="person-link" data-open-perfil="${escapeHtml(p.ID || "")}">${escapeHtml(p.NOMBRES || "—")}</span></td>
                <td class="mono">${formatFechaDisplay(p.FECHA)}</td>
                <td>${escapeHtml(p.GRUPO || "—")}</td>
                <td>${escapeHtml(p.BASE || "—")}</td>
                <td>${escapeHtml(p.INSTRUCTOR || "—")}</td>
                <td>${asistenciaPill(p)}</td>
                <td class="mono">${escapeHtml(p.NOTA || "—")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}
