// ==========================================================================
// TALMA DATA CENTER — Store central
// Única suscripción a Firestore + único pipeline de filtros. Cada vista
// (tabla, KPIs, gráficos, personas, grupos, cursos) consume EXACTAMENTE
// el mismo arreglo filtrado, eliminando lógicas aisladas por widget.
// ==========================================================================
import { colRef, CAMPOS } from "./firebase-config.js";
import { onSnapshot, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { normalizarRegistroFirestore, getSemestre, normKey, safeStr } from "./utils.js";
import { estadoDeRegistro, normalizarCedula, clavePersonaCurso, hoyLocal } from "./capacitacion.js";

const listeners = new Set();

// Campos "buscables" para la búsqueda inteligente (prioriza identidad).
const CAMPOS_BUSQUEDA = ["ID", "NOMBRES", "CORREO", "CURSO", "GRUPO", "BASE", "INSTRUCTOR", "PROGRAMA"];

const FILTRO_DEFAULT = {
  busqueda: "",
  desde: "",
  hasta: "",
  semestre: "todos",
  asistio: "",
  base: "",
  grupo: "",
  curso: "",
  instructor: "",
  salon: "",
  estado: "",          // VIGENTE | PRÓXIMO A VENCER | VENCIDO | SIN FECHA
  soloDuplicados: false,
  soloRevision: false,
};

export const store = {
  data: [],          // todos los registros normalizados (en memoria)
  filtered: [],      // resultado tras filtros (única fuente de verdad)
  filtros: { ...FILTRO_DEFAULT },
  estado: "loading",   // loading | online | partial | error
  sizeCrudo: 0,
  ultimaActualizacion: "",
  // Metadata de integridad calculada sobre store.data después de normalizar:
  encontradoPor: null,     // mapa _docId -> {busqueda, filtros}
  indiceBusqueda: null,    // mapa _docId -> textos normalizados (sin tildes)
  _claves: null,           // cache de claves de persona+curso por _docId
  _duplicados: [],         // _docIds marcados como cuerpo duplicado (persona+curso en vigencias solapadas)
  _revision: [],           // _docIds con problemas de calidad (faltan datos, fechas inválidas/futuras, etc.)
  _duplicadosSet: new Set(),
  _revisionSet: new Set(),
  _calidadResumen: { correctos: 0, revision: [], errores: [] },
  estadoHoy: hoyLocal(),

  /* ---------------- Suscripción de vistas ---------------- */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  notify() { listeners.forEach(fn => fn(store)); },

  /* ---------------- Filtros (API central) ---------------- */
  setFiltro(clave, valor) { store.filtros[clave] = valor; store.applyFilters(); },
  clearFiltros() { store.filtros = { ...FILTRO_DEFAULT }; store.applyFilters(); },

  filtrosActivos() {
    const etiquetas = {
      busqueda: "Búsqueda", desde: "Desde", hasta: "Hasta",
      semestre: "Semestre", asistio: "Asistencia", base: "Base",
      grupo: "Grupo", curso: "Curso", instructor: "Instructor", salon: "Salón",
      estado: "Estado", soloDuplicados: "Solo duplicados", soloRevision: "Solo revisión",
    };
    const activos = [];
    const valorNoVacio = (k, v) => (k === "semestre" ? v !== "todos" : v === true ? true : (v ?? "") !== "");
    Object.entries(store.filtros).forEach(([k, v]) => {
      if (k === "soloDuplicados" || k === "soloRevision") {
        if (v) activos.push({ clave: k, etiqueta: etiquetas[k], valor: "" });
      } else if (valorNoVacio(k, v)) {
        activos.push({ clave: k, etiqueta: etiquetas[k], valor: v });
      }
    });
    return activos;
  },

  /* ---------------- Búsqueda inteligente ---------------- */
  // Indices normalizados (sin tildes, mayúsculas, espacios) por registro.
  indiceDoc(item) {
    const partes = CAMPOS_BUSQUEDA
      .map(c => normKey(item[c]))
      .filter(Boolean);
    return partes.join(" § ").replace(/\s+/g, " ");
  },

  /* ---------------- Pipeline de filtros (único para todo) ---------------- */
  applyFilters() {
    const f = store.filtros;
    const term = normKey(f.busqueda || "");
    store.encontradoPor = {};

    if (!store.indiceBusqueda) {
      store.indiceBusqueda = new Map(store.data.map(d => [d._docId, store.indiceDoc(d)]));
    }
    if (!store._claves) {
      store._claves = new Map(store.data.map(d => [d._docId, clavePersonaCurso(d.ID, d.CURSO)]));
    }

    store.filtered = store.data.filter(item => {
      let encontrado = true;

      if (term) {
        const texto = store.indiceBusqueda.get(item._docId) || "";
        encontrado = texto.includes(term);
        if (encontrado) store.encontradoPor[item._docId] = "busqueda";
      }

      if (encontrado && f.base && item.BASE !== f.base) encontrado = false;
      if (encontrado && f.grupo && item.GRUPO !== f.grupo) encontrado = false;
      if (encontrado && f.curso && item.CURSO !== f.curso) encontrado = false;
      if (encontrado && f.instructor && item.INSTRUCTOR !== f.instructor) encontrado = false;
      if (encontrado && f.salon && item.SALON !== f.salon) encontrado = false;
      if (encontrado && f.asistio && (item.ASISTIO || "SÍ").toUpperCase() !== f.asistio) encontrado = false;
      if (encontrado && f.desde && item.FECHA && item.FECHA < f.desde) encontrado = false;
      if (encontrado && f.hasta && item.FECHA && item.FECHA > f.hasta) encontrado = false;
      if (encontrado && f.semestre !== "todos" && item.FECHA) {
        if (String(getSemestre(item.FECHA)) !== f.semestre) encontrado = false;
      }
      // Estado de capacitación (respecto a hoy).
      if (encontrado && f.estado) {
        const est = estadoDeRegistro(item, store.estadoHoy);
        const mapaEstados = {
          "VIGENTE": ["VIGENTE", "REALIZÓ RECURRENCIA"],
          "PRÓXIMO A VENCER": ["PRÓXIMO A VENCER"],
          "VENCIDO": ["VENCIDO"],
          "SIN FECHA": ["SIN FECHA"],
        };
        if (!(mapaEstados[f.estado] || []).includes(est.estado)) encontrado = false;
      }
      // Integridad: duplicados / pendientes de revisión.
      if (encontrado && f.soloDuplicados && !store._duplicadosSet.has(item._docId)) encontrado = false;
      if (encontrado && f.soloRevision && !store._revisionSet.has(item._docId)) encontrado = false;

      if (encontrado && (f.base || f.grupo || f.curso || f.instructor || f.salon || f.asistio ||
          f.desde || f.hasta || f.semestre !== "todos" || f.estado || f.soloDuplicados || f.soloRevision)) {
        store.encontradoPor[item._docId] = "filtros";
      }

      return encontrado;
    });
    store.notify();
  },

  /* ---------------- Conexión a Firestore ---------------- */
  iniciar() { store.connect(); },

  _unsubscribe: null,

  connect() {
    store.setEstado("loading");
    if (typeof store._unsubscribe === "function") store._unsubscribe();
    store._unsubscribe = onSnapshot(colRef, (snapshot) => {
      store.procesarSnapshot(snapshot);
    }, (error) => {
      console.error("[FIREBASE] Error de suscripción:", error);
      store.error = {
        titulo: "No fue posible conectar con la nube",
        mensaje: error.message || String(error),
        codigo: error.code || "—",
        proceso: "onSnapshot(capacitaciones)",
      };
      store.setEstado("error");
      store.notify();
    });
  },

  procesarSnapshot(snapshot) {
    store.sizeCrudo = snapshot.size;
    try {
      const docs = snapshot.docs;
      if (!Array.isArray(docs)) throw new Error("snapshot.docs no es un arreglo. Estructura inesperada.");
      store.data = docs.map(d => normalizarRegistroFirestore({ _docId: d.id, ...d.data() }, CAMPOS));
      store.estadoHoy = hoyLocal();
      // Reset de caches e índices derivados.
      store.indiceBusqueda = null;
      store._claves = null;
      store._duplicados = [];
      store._revision = [];
      store._duplicadosSet = new Set();
      store._revisionSet = new Set();
      store.calcularIntegridad();
      store.error = null;
      store.ultimaActualizacion = new Date().toLocaleString("es-CO");
      store.setEstado("online");
      store.applyFilters();
    } catch (err) {
      console.error("[DATA] Error procesando registros:", err);
      store.error = {
        titulo: "Se pudo consultar el total, pero no fue posible obtener los registros",
        mensaje: err.message || String(err),
        codigo: "—",
        proceso: "procesarSnapshot() / normalización de documentos",
      };
      store.setEstado("partial");
      store.notify();
    }
  },

  async actualizar() {
    try {
      store.setEstado("loading");
      store.notify();
      const snapshot = await getDocs(colRef);
      store.procesarSnapshot(snapshot);
      return { ok: true };
    } catch (err) {
      store.error = {
        titulo: "No fue posible actualizar los datos",
        mensaje: err.message || String(err),
        codigo: err.code || "—",
        proceso: "getDocs(capacitaciones)",
      };
      store.setEstado("error");
      store.notify();
      return { ok: false };
    }
  },

  setEstado(e) { store.estado = e; },

  /* ==================== Integridad de datos ==================== */
  // Revisa la base completa y detecta:
  //   · cédulas duplicadas / registros duplicados (persona+curso en vigencias solapadas)
  //   · personas sin nombre o sin cédula
  //   · fechas inválidas o futuras
  //   · asistencias con valores diferentes a los permitidos
  //   · registros sin curso / sin grupo / sin base
  calculaProblemasRec(rec) {
    const p = [];
    if (!normalizarCedula(rec.ID)) p.push("Sin cédula");
    else if (!/^\d{5,12}$/.test(normalizarCedula(rec.ID))) p.push("Cédula no numérica");
    if (!safeStr(rec.NOMBRES).trim()) p.push("Sin nombre");
    else if (safeStr(rec.NOMBRES).trim().length < 4) p.push("Nombre demasiado corto");
    if (!safeStr(rec.CURSO).trim()) p.push("Sin curso");
    if (!safeStr(rec.GRUPO).trim()) p.push("Sin grupo");
    if (!safeStr(rec.BASE).trim()) p.push("Sin base");
    if (!safeStr(rec.FECHA).trim()) p.push("Sin fecha");
    else if (rec.FECHA > store.estadoHoy) p.push("Fecha futura");
    const asistio = safeStr(rec.ASISTIO).toUpperCase();
    if (asistio && !["SÍ", "SI", "NO"].includes(asistio)) p.push("Asistencia inválida");
    return p;
  },

  calcularIntegridad() {
    store._duplicados = [];
    store._revision = [];
    const conteos = {};          // clavePersonaCurso -> contador de registros
    const porClave = {};         // clavePersonaCurso -> _docIds
    const errores = {};          // clavePersonaCurso -> problema más grave

    store.data.forEach(rec => {
      const id = normalizarCedula(rec.ID);
      const clave = id && rec.CURSO ? clavePersonaCurso(id, rec.CURSO) : `_noClave_${rec._docId}`;
      if (clave.startsWith("_noClave_")) {
        // Registro sin identidad completa → se marca para revisión.
        if (id && !rec.CURSO) store._revision.push(rec._docId);
        return;
      }
      conteos[clave] = (conteos[clave] || 0) + 1;
      (porClave[clave] = porClave[clave] || []).push(rec._docId);
      if (!errores[clave]) errores[clave] = store.calculaProblemasRec(rec);
    });

    // Duplicados: persona + curso repetida.
    Object.entries(conteos).forEach(([clave, n]) => {
      if (n > 1) {
        const ids = porClave[clave];
        // Conserva el más reciente como "válido" si tiene fecha; el resto se marca.
        const conFecha = ids
          .map(id => ({ id, fe: (store.data.find(d => d._docId === id) || {}).FECHA || "" }))
          .sort((a, b) => (b.fe || "").localeCompare(a.fe || ""));
        conFecha.slice(1).forEach(x => store._duplicados.push(x.id));
      }
    });

    // Revisión: problemas de calidad por registro.
    store.data.forEach(rec => {
      const p = store.calculaProblemasRec(rec);
      if (p.length > 0) store._revision.push(rec._docId);
    });
    store._revision = [...new Set(store._revision)];
    store._revisionSet = new Set(store._revision);
    store._duplicadosSet = new Set(store._duplicados);

    const total = store.data.length;
    const correctos = total - store._revision.length;
    store._calidadResumen = {
      correctos,
      errores,
      revision: store._revision,
      duplicados: store._duplicados,
      categorias: {
        duplicados: store._duplicados.length,
        revision: store._revision.length,
      },
    };
  },

  // Breve resumen de problemas legibles para alertas del dashboard.
  resumenCalidad() {
    return store._calidadResumen;
  },
};

// Mapa visual de los estados de conexión (compartido por todas las vistas).
export const ESTADO_HTML = {
  loading: '<span class="status-dot status-loading"></span> Conectando...',
  online: '<span class="status-dot status-online"></span> Conectado a la nube',
  partial: '<span class="status-dot status-partial"></span> Conexión parcial',
  error: '<span class="status-dot status-offline"></span> Error de conexión',
};
