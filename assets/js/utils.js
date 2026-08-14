// ==========================================================================
// TALMA DATA CENTER — Utilidades compartidas
// Validación de datos, normalización, mapeo tolerante de columnas de Excel,
// toasts y helpers de fecha / semestre.
// ==========================================================================

/* ---------------------------- Toasts ---------------------------- */
export function showToast(message, type = "info") {
  const icons = {
    success: "fa-circle-check",
    danger: "fa-triangle-exclamation",
    warning: "fa-triangle-exclamation",
    info: "fa-circle-info"
  };
  const colors = {
    success: "#0b7a40",
    danger: "#d92d2d",
    warning: "#b78e12",
    info: "#0b3d62"
  };
  let container = document.getElementById("tdcToastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "tdcToastContainer";
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    document.body.appendChild(container);
  }
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const el = document.createElement("div");
  el.className = "toast align-items-center border-0 show mb-2";
  el.style.background = isDark ? "#17212c" : "white";
  el.style.borderLeft = `4px solid ${colors[type] || colors.info}`;
  el.style.boxShadow = "0 8px 24px rgba(8,20,34,0.18)";
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body fw-semibold" style="color:${colors[type] || colors.info}; font-size:0.83rem;">
        <i class="fa-solid ${icons[type] || icons.info} me-2"></i>${message}
      </div>
      <button type="button" class="btn-close ${isDark ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(el);
  const toast = new bootstrap.Toast(el, { delay: 4000 });
  toast.show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

/* ---------------------------- Normalización ---------------------------- */
export function stripAccents(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normKey(str) {
  return stripAccents(str).trim().toUpperCase().replace(/\s+/g, " ");
}

/* ---------------------------- Fechas ---------------------------- */
// Acepta "8/06/2026", "2026-06-08", fechas de Excel (número serial) y
// devuelve {iso, display, valid}
export function parseFechaFlexible(value) {
  if (value === null || value === undefined || value === "") {
    return { iso: "", display: "", valid: true, empty: true };
  }

  // Excel serial date number
  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + value * 86400000);
    if (!isNaN(d)) return toDateResult(d);
  }

  const str = String(value).trim();

  // ISO yyyy-mm-dd
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toDateResult(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));

  // dd/mm/yyyy o d/m/yyyy
  m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return toDateResult(new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])));

  const fallback = new Date(str);
  if (!isNaN(fallback)) return toDateResult(fallback);

  return { iso: "", display: str, valid: false, empty: false };
}

function toDateResult(d) {
  const iso = d.toISOString().slice(0, 10);
  const [y, mo, da] = iso.split("-");
  const display = `${da}/${mo}/${y}`;
  const year = +y;
  const valid = year >= 2015 && year <= 2035;
  return { iso, display, valid, empty: false, dateObj: d };
}

export function getSemestre(iso) {
  if (!iso) return null;
  const mes = +iso.slice(5, 7);
  return mes >= 1 && mes <= 6 ? 1 : 2;
}

export function getPeriodoLabel(iso) {
  if (!iso) return "Sin fecha";
  const year = iso.slice(0, 4);
  return `${year}-S${getSemestre(iso)}`;
}

/* ---------------------------- Validación de un registro ---------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^\d{5,12}$/;

export function validarRegistro(rec) {
  const errores = [];

  const id = String(rec.ID ?? "").trim();
  if (!id) errores.push("ID vacío (obligatorio)");
  else if (!ID_RE.test(id)) errores.push("ID debe ser numérico (5-12 dígitos)");

  const nombres = String(rec.NOMBRES ?? "").trim();
  if (!nombres) errores.push("Nombres y Apellidos vacío (obligatorio)");
  else if (nombres.length < 4) errores.push("Nombres y Apellidos demasiado corto");

  const correo = String(rec.CORREO ?? "").trim();
  if (correo && !EMAIL_RE.test(correo)) errores.push("Correo con formato inválido");

  if (rec.FECHA) {
    const f = parseFechaFlexible(rec.FECHA);
    if (!f.valid) errores.push("Fecha con formato o rango inválido");
  }

  const asistio = String(rec.ASISTIO ?? "").trim().toUpperCase();
  if (asistio && !["SÍ", "SI", "NO"].includes(asistio)) {
    errores.push("Asistió debe ser SÍ o NO");
  }

  return { valido: errores.length === 0, errores };
}

/* ---------------------------- Mapeo tolerante de columnas Excel ---------------------------- */
// Cada campo oficial admite varios alias de encabezado (con/sin tilde,
// mayúsculas/minúsculas, orden de palabras distinto).
const ALIAS = {
  ID: ["ID", "CEDULA", "CÉDULA", "NUMERO DE IDENTIFICACION", "DOCUMENTO", "IDENTIFICACION"],
  NOMBRES: ["NOMBRES", "NOMBRES Y APELLIDOS", "NOMBRE COMPLETO", "NOMBRE Y APELLIDO", "APELLIDOS Y NOMBRES"],
  PROGRAMA: ["PROGRAMA", "PROGRAMA DE ENTRENAMIENTO", "PROGRAMA ENTRENAMIENTO"],
  CURSO: ["CURSO", "TIPO DE CURSO", "NOMBRE DEL CURSO"],
  FECHA: ["FECHA", "FECHA CURSO", "FECHA DE CAPACITACION", "FECHA CAPACITACION"],
  INTENSIDAD: ["INTENSIDAD", "INTENSIDAD HORARIA", "HORAS", "DURACION"],
  BASE: ["BASE", "ESTACION", "ESTACIÓN", "AEROPUERTO"],
  HORA: ["HORA", "HORARIO", "HORA INICIO"],
  SALON: ["SALON", "SALÓN", "AULA", "LUGAR"],
  GRUPO: ["GRUPO", "GRUPO CURSO", "NOMBRE DEL GRUPO"],
  CARGO: ["CARGO", "ROL", "PUESTO"],
  CORREO: ["CORREO", "EMAIL", "CORREO ELECTRONICO", "E-MAIL"],
  INSTRUCTOR: ["INSTRUCTOR", "DOCENTE", "FACILITADOR"],
  ASISTIO: ["ASISTIO", "ASISTIÓ", "ASISTENCIA"],
  NOTA: ["NOTA", "CALIFICACION", "CALIFICACIÓN", "PUNTAJE"],
  OBSERVACION: ["OBSERVACION", "OBSERVACIÓN", "OBSERVACIONES", "COMENTARIOS"]
};

// Construye {claveOficial -> claveOriginalDelExcel} a partir de las
// cabeceras reales que trae el archivo, sin importar tildes/orden.
export function mapearEncabezados(headersOriginales) {
  const normalizados = headersOriginales.map(h => ({ original: h, norm: normKey(h) }));
  const mapa = {};
  for (const campo of Object.keys(ALIAS)) {
    const aliasesNorm = ALIAS[campo].map(normKey);
    const encontrado = normalizados.find(h => aliasesNorm.includes(h.norm));
    if (encontrado) mapa[campo] = encontrado.original;
  }
  return mapa;
}

// Convierte una fila cruda del Excel (con encabezados desordenados o con
// alias) en un registro con las claves oficiales.
export function normalizarFilaExcel(rowRaw, mapaEncabezados) {
  const rec = {};
  for (const campo of Object.keys(ALIAS)) {
    const headerOriginal = mapaEncabezados[campo];
    let valor = headerOriginal !== undefined ? rowRaw[headerOriginal] : "";
    if (valor === undefined || valor === null) valor = "";

    if (campo === "FECHA") {
      const f = parseFechaFlexible(valor);
      rec.FECHA = f.empty ? "" : (f.valid ? f.iso : String(valor));
      rec._fechaValida = f.valid;
    } else if (campo === "ASISTIO") {
      const v = String(valor).trim().toUpperCase();
      rec.ASISTIO = v === "NO" ? "NO" : (v === "" ? "SÍ" : "SÍ");
    } else if (campo === "ID") {
      rec.ID = String(valor).trim().replace(/\.0$/, "");
    } else {
      rec[campo] = String(valor).trim();
    }
  }
  return rec;
}

/* ---------------------------- Formato de tabla ---------------------------- */
export function formatFechaDisplay(iso) {
  if (!iso) return "—";
  const f = parseFechaFlexible(iso);
  return f.display || iso;
}

export function parseHorasNumero(intensidad) {
  if (!intensidad) return 0;
  const m = String(intensidad).match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export function uniqueSorted(arr) {
  return [...new Set(arr.filter(v => v && v.trim()))].sort((a, b) => a.localeCompare(b, "es"));
}
