// ==========================================================================
// TALMA DATA CENTER — Vista INICIO (dashboard / centro de control)
// Todos los indicadores, gráficos, tablas y alertas se construyen sobre
// store.filtered: exactamente el mismo universo que los filtros.
// ==========================================================================
import { store } from "./store.js";
import { resumen, agregarPorGrupo } from "./agregados.js";
import { renderKpiStrip, escapeHtml } from "./ui.js";
import { formatFechaDisplay } from "./utils.js";
import { estadosPorPersona } from "./capacitacion.js";

const VERDE = "#0b7a40", ROJO = "#d92d2d", TEAL = "#1c6fa8", AMARILLO = "#b78e12";

let dashCharts = {};

function chartColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    texto: css.getPropertyValue("--ink-600").trim() || "#475467",
    linea: css.getPropertyValue("--line").trim() || "#e4e7ec",
  };
}

function destruir(id) {
  if (dashCharts[id]) { dashCharts[id].destroy(); dashCharts[id] = null; }
}

function crear(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  destruir(id);
  dashCharts[id] = new Chart(canvas.getContext("2d"), config);
}

function vaciar(id) {
  destruir(id);
}

/* ============================== Hero / actualización / calidad ============================== */
function renderHero(s) {
  const updateLabel = document.getElementById("dashUpdateLabel");
  const updateValue = document.getElementById("dashUpdateValue");
  if (updateLabel) updateLabel.innerHTML =
    s.ultimaActualizacion ? "Última actualización" : "Sin sincronizar";
  if (updateValue) updateValue.innerText = s.ultimaActualizacion || "—";

  const heroSub = document.getElementById("dashHeroSub");
  if (heroSub) {
    const filtros = s.filtrosActivos();
    heroSub.innerHTML = filtros.length === 0
      ? "Gestiona, filtra y analiza las asistencias a cursos en tiempo real."
      : `<i class="fa-solid fa-filter me-1"></i> Mostrando resultado con <strong>${filtros.length}</strong> filtro(s) activo(s) · universo: ${s.filtered.length} de ${s.data.length} registros`;
  }

  renderCalidadHero(s);
}

function renderCalidadHero(s) {
  const cont = document.getElementById("dashCalidad");
  if (!cont) return;
  const cal = s.resumenCalidad();
  const revision = cal.revision.length;
  const duplicados = cal.duplicados.length;
  const problemas = revision + duplicados;
  if (s.estado !== "online" || s.data.length === 0) {
    cont.innerHTML = `<span class="status-dot status-loading"></span> Verificando calidad de datos...`;
    return;
  }
  if (problemas === 0) {
    cont.innerHTML = `<span class="cal-badge ok"><i class="fa-solid fa-circle-check me-1"></i> Datos correctos — ${cal.correctos} registro(s) sin problemas detectados</span>`;
  } else {
    const partes = [];
    if (duplicados) partes.push(`${duplicados} duplicado(s)`);
    if (revision) partes.push(`${revision} registro(s) requieren revisión`);
    cont.innerHTML = `
      <span class="cal-badge warn"><i class="fa-solid fa-triangle-exclamation me-1"></i> ${partes.join(" · ")}</span>
      <button class="btn btn-sm btn-outline-warning ms-2" type="button" data-ir-a-calidad>
        <i class="fa-solid fa-magnifying-glass me-1"></i> Revisar
      </button>`;
    const btn = cont.querySelector("[data-ir-a-calidad]");
    if (btn) btn.addEventListener("click", () => {
      document.getElementById("dashCalidadDetalle")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

/* ============================== KPIs principales ============================== */
function renderKpis(s, r) {
  renderKpiStrip("dashKpis", [
    { label: "Personas capacitadas", value: r.personasUnicas, icon: '<i class="fa-solid fa-user" style="color:#fff"></i>', color: "bg-teal" },
    { label: "Asistencias", value: r.asistieron, icon: '<i class="fa-solid fa-user-check" style="color:#fff"></i>', color: "bg-si" },
    { label: "Inasistencias", value: r.noAsistieron, icon: '<i class="fa-solid fa-user-xmark" style="color:#fff"></i>', color: "bg-no" },
    { label: "% Asistencia", value: `${r.pctAsistencia}%`, icon: '<i class="fa-solid fa-percent" style="color:#fff"></i>', color: "bg-navy" },
    { label: "Registros", value: r.registros, icon: '<i class="fa-solid fa-database" style="color:#fff"></i>', color: "bg-navy" },
    { label: "Cursos", value: r.cursos, icon: '<i class="fa-solid fa-book-open" style="color:#fff"></i>', color: "bg-teal" },
  ]);
}

/* ============================== Asistencia general (dona) ============================== */
function renderAsistenciaGeneral(data) {
  const canvas = document.getElementById("dashChartAsistencia");
  const leyenda = document.getElementById("dashDonaLeyenda");
  if (!canvas) return;
  if (data.length === 0) { vaciar("dashChartAsistencia"); if (leyenda) leyenda.innerHTML = ""; return; }

  let si = 0, no = 0;
  data.forEach(d => (d.ASISTIO || "SÍ").toUpperCase() === "NO" ? no++ : si++);
  const total = si + no;
  const pct = total ? Math.round((si / total) * 100) : 0;

  crear("dashChartAsistencia", {
    type: "doughnut",
    data: {
      labels: ["Asistieron", "No asistieron"],
      datasets: [{ data: [si, no], backgroundColor: [VERDE, ROJO], borderWidth: 3, borderColor: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#fff" }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / total * 100)}%)` } },
      },
    },
  });

  if (leyenda) {
    leyenda.innerHTML = `
      <div class="dona-leyenda-item"><span class="dl-dot" style="background:${VERDE}"></span><strong>${si}</strong> asistieron</div>
      <div class="dona-leyenda-item"><span class="dl-dot" style="background:${ROJO}"></span><strong>${no}</strong> no asistieron</div>
      <div class="dona-leyenda-total"><strong>${total}</strong> total · <strong>${pct}%</strong> de asistencia</div>`;
  }
}

/* ============================== Estado de capacitación ============================== */
function coloresEstado(estado) {
  const mapa = {
    "VIGENTE": { color: VERDE, soft: "soft-green" },
    "PRÓXIMO A VENCER": { color: AMARILLO, soft: "soft-yellow" },
    "VENCIDO": { color: ROJO, soft: "soft-red" },
    "REALIZÓ RECURRENCIA": { color: TEAL, soft: "soft-teal" },
    "SIN FECHA": { color: "#8a94a6", soft: "soft-gray" },
  };
  return mapa[estado] || { color: "#8a94a6", soft: "soft-gray" };
}

function chipEstado(est, conDetalle) {
  const { color, soft } = coloresEstado(est.estado);
  const detalle = conDetalle && est.vencimiento
    ? `<span class="est-chip-detalle">venc. ${formatFechaDisplay(est.vencimiento)}${est.diasRestantes !== null ? ` · ${est.diasRestantes < 0 ? `${Math.abs(est.diasRestantes)} días vencido` : `${est.diasRestantes} días restantes`}` : ""}</span>`
    : "";
  return `<span class="est-chip ${soft}" style="--chip-color:${color}">
    <i class="fa-solid ${est.icono}"></i> ${est.etiqueta}${detalle}
  </span>`;
}

// Estado por persona+curso (agrupando todos los registros de esa persona).
function estadosDeLaFiltrada(data, hoyLocalDate) {
  // Pasa por la persona completa de store.data: así una persona filtrada por
  // un registro muestra el estado de TODOS sus cursos (información global).
  const porPersona = new Map();
  store.data.forEach(rec => {
    const clave = rec.ID || `N:${rec.NOMBRES}`;
    if (!porPersona.has(clave)) porPersona.set(clave, []);
    porPersona.get(clave).push(rec);
  });
  const personasPresentes = new Set();
  data.forEach(rec => {
    const clave = rec.ID || `N:${rec.NOMBRES}`;
    if (clave) personasPresentes.add(clave);
  });
  const resultados = [];
  porPersona.forEach((registros, clave) => {
    if (!personasPresentes.has(clave)) return;
    const p = estadosPorPersona(registros, hoyLocalDate);
    // Solo interesan los cursos que aparecen en el universo filtrado.
    const cursosVisibles = new Set(data
      .filter(r => (r.ID || `N:${r.NOMBRES}`) === clave)
      .map(r => String(r.CURSO || "").toUpperCase()));
    const cursos = p.cursos.filter(c => cursosVisibles.has(String(c.curso).toUpperCase()));
    const global = cursos.length ? p.global : null;
    resultados.push({ clave, cursos, global });
  });
  return resultados;
}

function renderEstados(s) {
  const cont = document.getElementById("dashEstadosResumen");
  if (!cont) return;
  const data = s.filtered;
  if (data.length === 0) {
    cont.innerHTML = `<div class="text-muted text-center py-4">Sin datos para el universo filtrado.</div>`;
    return;
  }

  const personas = estadosDeLaFiltrada(data, s.estadoHoy);
  const conteo = { "VIGENTE": 0, "PRÓXIMO A VENCER": 0, "VENCIDO": 0, "REALIZÓ RECURRENCIA": 0, "SIN FECHA": 0, "SIN REGISTRO": 0 };
  personas.forEach(p => {
    if (p.global) conteo[p.global.estado.estado] = (conteo[p.global.estado.estado] || 0) + 1;
  });

  const orden = [
    ["VIGENTE", "Vigente", "fa-circle-check", VERDE],
    ["REALIZÓ RECURRENCIA", "Realizó recurrencia", "fa-arrows-rotate", TEAL],
    ["PRÓXIMO A VENCER", "Próximo a vencer", "fa-clock", AMARILLO],
    ["VENCIDO", "Vencido", "fa-circle-xmark", ROJO],
    ["SIN FECHA", "Sin fecha", "fa-circle-question", "#8a94a6"],
  ];
  const max = Math.max(1, ...orden.map(([k]) => conteo[k] || 0));
  const totalPersonas = personas.length;

  cont.innerHTML = `
    <div class="estados-conteo">
      ${orden.map(([key, etiqueta, icono, color]) => {
        const n = conteo[key] || 0;
        const pct = totalPersonas ? Math.round((n / totalPersonas) * 100) : 0;
        return `
        <div class="estado-barra-item" title="${etiqueta}: ${n} persona(s)">
          <div class="estado-barra-head">
            <span><i class="fa-solid ${icono}" style="color:${color}"></i> ${etiqueta}</span>
            <strong>${n}</strong>
          </div>
          <div class="estado-barra-track">
            <div class="estado-barra-fill" style="width:${n / max * 100}%; background:${color}"></div>
          </div>
          <div class="estado-barra-pct">${pct}%</div>
        </div>`;
      }).join("")}
    </div>
    <div class="estados-leyenda">
      <span><i class="fa-solid fa-user me-1"></i> Personas únicas del universo: <strong>${totalPersonas}</strong></span>
      <span class="estados-vigencia-info"><i class="fa-solid fa-circle-info me-1"></i> Vigencia por curso (24 meses por defecto)</span>
    </div>`;
}

/* ============================== Gráficos por base / curso ============================== */
function asistenciaPor(data, campo, canvasId, horizontal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (data.length === 0) { vaciar(canvasId); return; }
  const map = {};
  data.forEach(d => {
    const key = d[campo] || "SIN ASIGNAR";
    if (!map[key]) map[key] = { si: 0, no: 0 };
    (d.ASISTIO || "SÍ").toUpperCase() === "NO" ? map[key].no++ : map[key].si++;
  });
  const labels = Object.keys(map).sort((a, b) => {
    const ta = map[a].si + map[a].no, tb = map[b].si + map[b].no;
    return tb - ta || a.localeCompare(b, "es");
  });
  const c = chartColors();
  crear(canvasId, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Asistieron", data: labels.map(l => map[l].si), backgroundColor: VERDE, borderRadius: 3, stack: "a" },
        { label: "No asistieron", data: labels.map(l => map[l].no), backgroundColor: ROJO, borderRadius: 3, stack: "a" },
      ],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: c.texto }, grid: { color: c.linea } },
        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: c.texto }, grid: { color: c.linea } },
      },
      plugins: { legend: { position: "bottom", labels: { font: { size: 10 }, color: c.texto } } },
      onClick: (_evt, elements) => {
        if (elements && elements.length) {
          const idx = elements[0].index;
          const valor = labels[idx];
          if (valor && valor !== "SIN ASIGNAR") {
            store.setFiltro(campo === "BASE" ? "base" : "curso", valor);
          }
        }
      },
    },
  });
}

/* ============================== Tabla de grupos ============================== */
function renderGrupos(data) {
  const tbody = document.getElementById("dashGruposBody");
  if (!tbody) return;
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Sin datos.</td></tr>';
    return;
  }
  const grupos = agregarPorGrupo(data)
    .sort((a, b) => (b.resumen.registros - a.resumen.registros) || (b.resumen.pctAsistencia - a.resumen.pctAsistencia));
  // Máximo 8 grupos en la tabla del Home.
  const top = grupos.slice(0, 8);
  tbody.innerHTML = top.map(g => {
    const r = g.resumen;
    const pct = r.pctAsistencia;
    const barColor = pct >= 85 ? VERDE : pct >= 65 ? AMARILLO : ROJO;
    return `
      <tr class="clickable-row" data-open-grupo="${escapeHtml(g.grupo)}">
        <td>${escapeHtml(g.grupo)}</td>
        <td class="mono">${r.registros}</td>
        <td class="mono" style="color:var(--dg-green);font-weight:700">${r.asistieron}</td>
        <td class="mono" style="color:var(--dg-red);font-weight:700">${r.noAsistieron}</td>
        <td>
          <div class="minibar"><div class="minibar-fill" style="width:${pct}%;background:${barColor}"></div></div>
          <span class="mono minibar-pct">${pct}%</span>
        </td>
      </tr>`;
  }).join("");
}

/* ============================== Puntos de atención (mayor inasistencia) ============================== */
function renderAlertas(data) {
  const cont = document.getElementById("dashAlertas");
  if (!cont) return;
  if (data.length === 0) { cont.innerHTML = '<div class="text-muted small py-2">Sin datos.</div>'; return; }
  const map = {};
  data.forEach(d => {
    const b = d.BASE || "(Sin base)";
    if (!map[b]) map[b] = { no: 0, total: 0 };
    map[b].total++;
    if ((d.ASISTIO || "SÍ").toUpperCase() === "NO") map[b].no++;
  });
  const orden = Object.entries(map)
    .filter(([, v]) => v.no > 0)
    .sort((a, b) => b[1].no - a[1].no)
    .slice(0, 5);
  if (orden.length === 0) {
    cont.innerHTML = `<div class="alerta-item ok"><i class="fa-solid fa-circle-check"></i> Sin inasistencias en este universo.</div>`;
    return;
  }
  cont.innerHTML = orden.map(([base, v]) => `
    <div class="alerta-item">
      <span class="alerta-icono"><i class="fa-solid fa-triangle-exclamation"></i></span>
      <div class="alerta-info">
        <strong>${escapeHtml(base)}</strong>
        <span class="alerta-sub">${v.no} inasistencia(s) de ${v.total} registro(s) · ${Math.round(v.no / v.total * 100)}%</span>
      </div>
      <div class="alerta-numero">${v.no}</div>
    </div>`).join("");
}

/* ============================== No asistieron ============================== */
function renderNoAsistieron(data) {
  const cont = document.getElementById("dashNoAsistieron");
  if (!cont) return;
  const noAsist = data.filter(d => (d.ASISTIO || "SÍ").toUpperCase() === "NO")
    .sort((a, b) => (b.FECHA || "").localeCompare(a.FECHA || ""))
    .slice(0, 6);
  if (noAsist.length === 0) {
    cont.innerHTML = `<div class="text-muted small py-2">Todos asistieron en este universo. ✅</div>`;
    return;
  }
  cont.innerHTML = noAsist.map(d => `
    <div class="no-asist-item">
      <span class="person-link" data-open-perfil="${escapeHtml(d.ID || "")}">${escapeHtml(d.NOMBRES || "(Sin nombre)")}</span>
      <span class="no-asist-meta">${escapeHtml(d.CURSO || "—")} · ${escapeHtml(d.BASE || "—")} · ${escapeHtml(d.GRUPO || "—")} · ${formatFechaDisplay(d.FECHA)}</span>
    </div>`).join("");
}

/* ============================== Últimos registros ============================== */
function renderUltimos(data) {
  const cont = document.getElementById("dashUltimos");
  if (!cont) return;
  const recientes = data
    .filter(d => d.FECHA)
    .sort((a, b) => (b.FECHA || "").localeCompare(a.FECHA || ""))
    .slice(0, 6);
  if (recientes.length === 0) {
    cont.innerHTML = `<div class="text-muted small py-2">Sin registros con fecha.</div>`;
    return;
  }
  cont.innerHTML = recientes.map(d => {
    const esSi = (d.ASISTIO || "SÍ").toUpperCase() !== "NO";
    return `
      <div class="ultimo-item">
        <div class="ultimo-avatar"><i class="fa-solid fa-user"></i></div>
        <div class="ultimo-main">
          <span class="person-link" data-open-perfil="${escapeHtml(d.ID || "")}">${escapeHtml(d.NOMBRES || "(Sin nombre)")}</span>
          <span class="ultimo-meta">${escapeHtml(d.CURSO || "—")} · ${escapeHtml(d.GRUPO || "—")} · ${escapeHtml(d.BASE || "—")} · ${formatFechaDisplay(d.FECHA)}</span>
        </div>
        <span class="hz-pill ${esSi ? "si" : "no"}"><span class="hz-dot"></span>${esSi ? "SÍ" : "NO"}</span>
      </div>`;
  }).join("");
}

/* ============================== Calidad de datos (detalle) ============================== */
function renderCalidadDetalle(s) {
  const cont = document.getElementById("dashCalidadDetalle");
  if (!cont) return;
  const cal = s.resumenCalidad();
  if (s.estado !== "online" || s.data.length === 0) {
    cont.innerHTML = `<div class="text-muted small py-3">Calculando...</div>`;
    return;
  }
  const duplicados = cal.duplicados.length;
  const revision = cal.revision.length;
  const correctos = cal.correctos;
  const total = s.data.length;

  // Clasificar revisión por categoría aproximada.
  const catRevision = {};
  cal.revision.forEach(id => {
    const rec = s.data.find(d => d._docId === id);
    if (!rec) return;
    const problemas = s.calculaProblemasRec(rec);
    problemas.forEach(p => { catRevision[p] = (catRevision[p] || 0) + 1; });
  });
  const categorias = Object.entries(catRevision).sort((a, b) => b[1] - a[1]).slice(0, 6);

  cont.innerHTML = `
    <div class="calidad-total">
      <div><strong>${total}</strong><span>registros</span></div>
      <div class="ok"><strong>${correctos}</strong><span>correctos</span></div>
      <div class="warn"><strong>${duplicados}</strong><span>duplicados</span></div>
      <div class="danger"><strong>${revision}</strong><span>revisión</span></div>
    </div>
    ${duplicados > 0 ? `
      <div class="calidad-cta">
        <button class="btn btn-sm btn-outline-warning w-100" type="button" onclick="document.getElementById('filtroIntegridad').value='duplicados'; document.getElementById('filtroIntegridad').dispatchEvent(new Event('change')); navigate('asistencias');">
          <i class="fa-solid fa-copy me-1"></i> Ver ${duplicados} duplicado(s) detectados
        </button>
      </div>` : ""}
    ${revision > 0 ? `
      <div class="calidad-cta">
        <button class="btn btn-sm btn-outline-danger w-100" type="button" onclick="document.getElementById('filtroIntegridad').value='revision'; document.getElementById('filtroIntegridad').dispatchEvent(new Event('change')); navigate('asistencias');">
          <i class="fa-solid fa-triangle-exclamation me-1"></i> Ver ${revision} registro(s) en revisión
        </button>
      </div>` : ""}
    ${categorias.length ? `
      <div class="calidad-categorias">
        <div class="cal-cat-titulo">Problemas más comunes</div>
        ${categorias.map(([cat, n]) => `
          <div class="cal-cat"><span>${escapeHtml(cat)}</span><strong>${n}</strong></div>`).join("")}
      </div>` : ""}`;
}

/* ============================== Render del dashboard ============================== */
export function renderDashboard(s) {
  const data = s.filtered;
  const r = resumen(data);

  renderHero(s);
  renderKpis(s, r);
  renderAsistenciaGeneral(data);
  renderEstados(s);
  asistenciaPor(data, "BASE", "dashChartPorBase", false);
  asistenciaPor(data, "CURSO", "dashChartPorCurso", true);
  renderGrupos(data);
  renderAlertas(data);
  renderNoAsistieron(data);
  renderUltimos(data);
  renderCalidadDetalle(s);
}
