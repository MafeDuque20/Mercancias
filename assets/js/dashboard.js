// ==========================================================================
// TALMA DATA CENTER — Vista INICIO (dashboard)
// ==========================================================================
import { resumen } from "./agregados.js";
import { renderKpiStrip } from "./ui.js";

export function renderDashboard(s) {
  const r = resumen(s.filtered);
  renderKpiStrip("dashKpis", [
    { label: "Registros", value: r.registros, icon: '<i class="fa-solid fa-database" style="color:#fff"></i>', color: "bg-navy" },
    { label: "Personas únicas", value: r.personasUnicas, icon: '<i class="fa-solid fa-user" style="color:#fff"></i>', color: "bg-teal" },
    { label: "% Asistencia", value: `${r.pctAsistencia}%`, icon: '<i class="fa-solid fa-user-check" style="color:#fff"></i>', color: "bg-si" },
    { label: "Grupos", value: r.grupos, icon: '<i class="fa-solid fa-people-group" style="color:#fff"></i>', color: "bg-navy" },
    { label: "Cursos", value: r.cursos, icon: '<i class="fa-solid fa-book-open" style="color:#fff"></i>', color: "bg-teal" },
    { label: "Bases", value: r.bases, icon: '<i class="fa-solid fa-location-dot" style="color:#fff"></i>', color: "bg-orange" },
    { label: "Asistieron", value: r.asistieron, icon: '<i class="fa-solid fa-check" style="color:#fff"></i>', color: "bg-si" },
    { label: "No asistieron", value: r.noAsistieron, icon: '<i class="fa-solid fa-xmark" style="color:#fff"></i>', color: "bg-no" },
  ]);

  const ult = document.getElementById("dashResumenRapido");
  if (ult) {
    ult.innerHTML = `
      <strong>${r.registros}</strong> registro(s) sobre <strong>${r.personasUnicas}</strong> persona(s) única(s) ·
      <strong>${r.asistieron}</strong> asistieron · <strong>${r.noAsistieron}</strong> no asistieron ·
      promedio de nota: <strong>${r.promedioNota === null ? "—" : r.promedioNota.toFixed(1)}</strong> ·
      cursos realizados: <strong>${r.cursos}</strong>`;
  }
}
