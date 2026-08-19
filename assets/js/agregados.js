// ==========================================================================
// TALMA DATA CENTER — Métricas y agregaciones compartidas
// Toda vista (dashboard, asistencias, colaboradores, grupos, cursos,
// analítica, perfil) obtiene sus cifras de estas mismas funciones, para
// garantizar que un "recuento de registros" nunca se confunda con un
// "recuento de personas únicas".
// ==========================================================================
import { safeStr, parseNotaNumero, normKey } from "./utils.js";

// Clave de identidad de una persona: el ID (cédula). Si el registro no
// trae ID, se usa el nombre normalizado como respaldo para no contar el
// vacío como una sola "persona desconocida".
export function personKey(rec) {
  const id = safeStr(rec.ID).trim();
  if (id) return id;
  const nombre = safeStr(rec.NOMBRES).trim();
  return nombre ? "N:" + normKey(nombre) : "";
}

export function asisteSi(rec) {
  return (rec.ASISTIO || "SÍ").toUpperCase() !== "NO";
}

// Resumen completo de un conjunto de registros (ya filtrados).
export function resumen(data) {
  const registros = data.length;
  const personasSet = new Set();
  const gruposSet = new Set();
  const cursosSet = new Set();
  const basesSet = new Set();
  const instructoresSet = new Set();
  let asistieron = 0;
  let noAsistieron = 0;
  let sumaNotas = 0;
  let notasConValor = 0;

  data.forEach(rec => {
    const pk = personKey(rec);
    if (pk) personasSet.add(pk);
    if (rec.GRUPO) gruposSet.add(rec.GRUPO);
    if (rec.CURSO) cursosSet.add(rec.CURSO);
    if (rec.BASE) basesSet.add(rec.BASE);
    if (rec.INSTRUCTOR) instructoresSet.add(rec.INSTRUCTOR);

    if (asisteSi(rec)) asistieron++; else noAsistieron++;

    const nota = parseNotaNumero(rec.NOTA);
    if (nota !== null) { sumaNotas += nota; notasConValor++; }
  });

  return {
    registros,
    personasUnicas: personasSet.size,
    grupos: gruposSet.size,
    cursos: cursosSet.size,
    bases: basesSet.size,
    instructores: instructoresSet.size,
    asistieron,
    noAsistieron,
    pctAsistencia: registros ? Math.round((asistieron / registros) * 100) : 0,
    promedioNota: notasConValor ? sumaNotas / notasConValor : null,
  };
}

// Agregación por persona para la vista "Colaboradores".
export function agregarPorPersona(data) {
  const mapa = new Map();
  data.forEach(rec => {
    const pk = personKey(rec);
    if (!pk) return;
    if (!mapa.has(pk)) {
      mapa.set(pk, {
        key: pk,
        ID: rec.ID || pk,
        NOMBRES: rec.NOMBRES || "(Sin nombre)",
        registros: [],
      });
    }
    mapa.get(pk).registros.push(rec);
  });

  const personas = [...mapa.values()].map(p => {
    const r = p.registros;
    const cursosOk = new Set();
    let asistieron = 0, noAsistieron = 0, suma = 0, notas = 0;
    let ultimaFecha = "";
    r.forEach(rec => {
      if (rec.CURSO) cursosOk.add(rec.CURSO);
      if (asisteSi(rec)) asistieron++; else noAsistieron++;
      const nota = parseNotaNumero(rec.NOTA);
      if (nota !== null) { suma += nota; notas++; }
      if (rec.FECHA && rec.FECHA > ultimaFecha) ultimaFecha = rec.FECHA;
    });
    // Datos "más recientes" del registro más nuevo para la ficha.
    const ult = r.filter(x => (!ultimaFecha) || x.FECHA === ultimaFecha)[0] || r[r.length - 1];
    return {
      key: p.key,
      ID: ult.ID || p.ID,
      NOMBRES: ult.NOMBRES || p.NOMBRES,
      CARGO: ult.CARGO || "",
      BASE: ult.BASE || "",
      CORREO: ult.CORREO || "",
      EMPRESA: ult.EMPRESA || "",
      totalCursos: cursosOk.size,
      asistencias: asistieron,
      inasistencias: noAsistieron,
      promedioNota: notas ? suma / notas : null,
      ultimoCurso: ult.CURSO || "",
      ultimaFecha: ultimaFecha,
      registros: r,
    };
  });

  personas.sort((a, b) => a.NOMBRES.localeCompare(b.NOMBRES, "es"));
  return personas;
}

// Agregación por grupo para la vista "Grupos".
export function agregarPorGrupo(data) {
  const mapa = new Map();
  data.forEach(rec => {
    const g = rec.GRUPO || "(Sin grupo)";
    if (!mapa.has(g)) mapa.set(g, { grupo: g, registros: [] });
    mapa.get(g).registros.push(rec);
  });
  const grupos = [...mapa.values()].map(g => {
    const r = g.registros;
    const s = resumen(r);
    let ultimaFecha = "";
    r.forEach(rec => { if (rec.FECHA && rec.FECHA > ultimaFecha) ultimaFecha = rec.FECHA; });
    const ult = r.filter(x => (!ultimaFecha) || x.FECHA === ultimaFecha)[0] || {};
    return {
      grupo: g.grupo,
      curso: ult.CURSO || "",
      programa: ult.PROGRAMA || "",
      fecha: ultimaFecha,
      base: ult.BASE || "",
      instructor: ult.INSTRUCTOR || "",
      salon: ult.SALON || "",
      resumen: s,
      registros: r,
    };
  });
  grupos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  return grupos;
}

// Agregación por curso para la vista "Cursos".
export function agregarPorCurso(data) {
  const mapa = new Map();
  data.forEach(rec => {
    const c = rec.CURSO || "(Sin curso)";
    if (!mapa.has(c)) mapa.set(c, { curso: c, programa: rec.PROGRAMA || "", registros: [] });
    mapa.get(c).registros.push(rec);
    const info = mapa.get(c);
    if (!info.programa && rec.PROGRAMA) info.programa = rec.PROGRAMA;
  });
  const cursos = [...mapa.values()].map(c => {
    const r = c.registros;
    const s = resumen(r);
    return {
      curso: c.curso,
      programa: c.programa,
      resumen: s,
      registros: r,
    };
  });
  cursos.sort((a, b) => a.curso.localeCompare(b.curso, "es"));
  return cursos;
}
