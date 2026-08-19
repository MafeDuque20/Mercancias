// ==========================================================================
// TALMA DATA CENTER — Vista ANALÍTICA
// Todos los gráficos se alimentan de store.filtered: exactamente el mismo
// conjunto de datos que usa la tabla y los KPIs.
// ==========================================================================
import { resumen } from "./agregados.js";
import { renderKpiStrip } from "./ui.js";
import { getPeriodoLabel, parseHorasNumero, parseNotaNumero } from "./utils.js";

let charts = {};
const VERDE = "#0b7a40", ROJO = "#d92d2d", NAVY = "#0b3d62", TEAL = "#1c6fa8", NARANJA = "#c96a10";

function chartColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    texto: css.getPropertyValue("--ink-600").trim() || "#475467",
    linea: css.getPropertyValue("--line").trim() || "#e4e7ec",
  };
}

function toggleEmptyState(canvasId, isEmpty) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  let msg = canvas.parentElement.querySelector(".chart-empty-msg");
  if (!msg) {
    msg = document.createElement("div");
    msg.className = "chart-empty-msg d-flex align-items-center justify-content-center h-100 text-muted small";
    msg.innerHTML = '<span><i class="fa-solid fa-chart-simple me-2"></i>No hay datos suficientes</span>';
    canvas.parentElement.appendChild(msg);
  }
  canvas.style.display = isEmpty ? "none" : "";
  msg.style.display = isEmpty ? "" : "none";
}

function destruir(id) {
  if (charts[id]) { charts[id].destroy(); charts[id] = null; }
}

function crear(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  destruir(id);
  charts[id] = new Chart(canvas.getContext("2d"), config);
}

/* ============================== KPIs ============================== */
export function renderAnaliticaKpis(s) {
  const r = resumen(s.filtered);
  renderKpiStrip("analiticaKpis", [
    { label: "Registros", value: r.registros, icon: '<i class="fa-solid fa-database" style="color:#fff"></i>', color: "bg-navy" },
    { label: "Personas únicas", value: r.personasUnicas, icon: '<i class="fa-solid fa-users" style="color:#fff"></i>', color: "bg-teal" },
    { label: "% Asistencia", value: `${r.pctAsistencia}%`, icon: '<i class="fa-solid fa-user-check" style="color:#fff"></i>', color: "bg-si" },
    { label: "Promedio de nota", value: r.promedioNota === null ? "—" : r.promedioNota.toFixed(1), icon: '<i class="fa-solid fa-star-half-stroke" style="color:#fff"></i>', color: "bg-orange" },
  ]);
}

/* ============================== 1. Asistieron vs no asistieron ============================== */
function chartAsistenciaGlobal(data) {
  toggleEmptyState("chartAsistencia", data.length === 0);
  if (data.length === 0) { destruir("chartAsistencia"); return; }
  let si = 0, no = 0;
  data.forEach(d => (d.ASISTIO || "SÍ").toUpperCase() === "NO" ? no++ : si++);
  crear("chartAsistencia", {
    type: "doughnut",
    data: {
      labels: ["Asistieron", "No asistieron"],
      datasets: [{ data: [si, no], backgroundColor: [VERDE, ROJO], borderWidth: 2, borderColor: "#fff" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, color: chartColors().texto } } },
    },
  });
}

/* ============================== Asistencia apilada por dimensión ============================== */
function chartAsistenciaPor(data, campo, canvasId, horizontal) {
  toggleEmptyState(canvasId, data.length === 0);
  if (data.length === 0) { destruir(canvasId); return; }
  const map = {};
  data.forEach(d => {
    const key = d[campo] || "SIN ASIGNAR";
    if (!map[key]) map[key] = { si: 0, no: 0 };
    (d.ASISTIO || "SÍ").toUpperCase() === "NO" ? map[key].no++ : map[key].si++;
  });
  const labels = Object.keys(map).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const c = chartColors();
  crear(canvasId, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Asistieron", data: labels.map(l => map[l].si), backgroundColor: VERDE, borderRadius: 3 },
        { label: "No asistieron", data: labels.map(l => map[l].no), backgroundColor: ROJO, borderRadius: 3 },
      ],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: c.texto }, grid: { color: c.linea } },
        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: c.texto }, grid: { color: c.linea } },
      },
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 }, color: c.texto } } },
    },
  });
}

/* ============================== 5. Evolución de asistencia por fecha ============================== */
function chartEvolucion(data) {
  const conFecha = data.filter(d => d.FECHA);
  toggleEmptyState("chartEvolucion", conFecha.length === 0);
  if (conFecha.length === 0) { destruir("chartEvolucion"); return; }
  const map = {};
  conFecha.forEach(d => {
    if (!map[d.FECHA]) map[d.FECHA] = { si: 0, no: 0 };
    (d.ASISTIO || "SÍ").toUpperCase() === "NO" ? map[d.FECHA].no++ : map[d.FECHA].si++;
  });
  const labels = Object.keys(map).sort();
  const pct = labels.map(l => {
    const m = map[l];
    return Math.round((m.si / (m.si + m.no)) * 100);
  });
  const c = chartColors();
  crear("chartEvolucion", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "% asistencia por fecha",
        data: pct,
        borderColor: TEAL,
        backgroundColor: "rgba(28,111,168,0.12)",
        fill: true, tension: 0.3,
        pointBackgroundColor: VERDE, pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: c.texto, maxTicksLimit: 12 }, grid: { color: c.linea } },
        y: { min: 0, max: 100, ticks: { color: c.texto, callback: v => v + "%" }, grid: { color: c.linea } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ============================== 6. Distribución de notas ============================== */
function chartNotas(data) {
  const notas = data.map(d => parseNotaNumero(d.NOTA)).filter(n => n !== null);
  toggleEmptyState("chartNotas", notas.length === 0);
  if (notas.length === 0) { destruir("chartNotas"); return; }
  const min = Math.floor(Math.min(...notas) / 10) * 10;
  const max = Math.ceil(Math.max(...notas) / 10) * 10;
  const rango = Math.max(10, max - min);
  const paso = rango > 60 ? 20 : 10;
  const bins = [];
  for (let b = min; b < max; b += paso) bins.push({ label: `${b}–${b + paso}`, desde: b, hasta: b + paso, count: 0 });
  if (bins.length === 0) bins.push({ label: `${min}–${max}`, desde: min, hasta: max, count: 0 });
  notas.forEach(n => {
    const bin = bins.find(b => n >= b.desde && (n < b.hasta || (n === max && b.hasta === max)));
    if (bin) bin.count++;
    else bins[bins.length - 1].count++;
  });
  const c = chartColors();
  crear("chartNotas", {
    type: "bar",
    data: {
      labels: bins.map(b => b.label),
      datasets: [{ label: "Registros", data: bins.map(b => b.count), backgroundColor: NAVY, borderRadius: 3 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: c.texto }, grid: { color: c.linea } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: c.texto }, grid: { color: c.linea } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ============================== Horas por periodo (conservado) ============================== */
function chartHorasPeriodo(data) {
  const map = {};
  data.forEach(d => {
    if (!d.FECHA) return;
    const periodo = getPeriodoLabel(d.FECHA);
    map[periodo] = (map[periodo] || 0) + parseHorasNumero(d.INTENSIDAD);
  });
  const labels = Object.keys(map).sort();
  toggleEmptyState("chartHorasPeriodo", labels.length === 0);
  if (labels.length === 0) { destruir("chartHorasPeriodo"); return; }
  const c = chartColors();
  crear("chartHorasPeriodo", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Horas de capacitación ejecutadas",
        data: labels.map(l => map[l]),
        borderColor: NAVY, backgroundColor: "rgba(11,61,98,0.12)",
        fill: true, tension: 0.3, pointBackgroundColor: VERDE, pointRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: c.texto }, grid: { color: c.linea } },
        y: { beginAtZero: true, ticks: { color: c.texto }, grid: { color: c.linea } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

/* ============================== Render de toda la analítica ============================== */
export function renderAnalitica(s) {
  const data = s.filtered;
  renderAnaliticaKpis(s);
  chartAsistenciaGlobal(data);
  chartAsistenciaPor(data, "BASE", "chartPorBase", false);
  chartAsistenciaPor(data, "GRUPO", "chartPorGrupo", true);
  chartAsistenciaPor(data, "CURSO", "chartPorCurso", true);
  chartEvolucion(data);
  chartNotas(data);
  chartAsistenciaPor(data, "INSTRUCTOR", "chartPorInstructor", true);
  chartHorasPeriodo(data);
}
