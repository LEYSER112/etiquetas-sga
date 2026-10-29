/**
 * Diseño (maquetación) de la etiqueta SGA.
 *
 * Es lógica pura: recibe los datos y un "medidor" de texto y devuelve una
 * lista de elementos con posiciones en milímetros (origen arriba a la
 * izquierda). El generador de PDF solo se encarga de dibujarlos.
 *
 * Orden de la etiqueta:
 *   1. Nombre del producto
 *   2. Pictogramas
 *   3. Palabra de advertencia
 *   4. Indicaciones de peligro (H) y consejos de prudencia (P)
 *   5. Pie: teléfono de emergencia, fechas, contenido y cuadro para el sticker del lote
 */
import { formatearFecha } from './texto.js';

export const PT_A_MM = 25.4 / 72;
const INTERLINEADO = 1.18;

/**
 * @typedef {{ancho: (texto: string, pt: number, negrita: boolean) => number}} Medidor
 *   Devuelve el ancho del texto en mm.
 * @typedef {{texto: string, negrita?: boolean}} Segmento
 */

/** Altura de línea en mm para un tamaño de fuente en puntos. */
const altoLinea = (pt) => pt * PT_A_MM * INTERLINEADO;

/**
 * Parte segmentos de texto (con o sin negrita) en líneas que quepan en `anchoMax`.
 * @param {Segmento[]} segmentos
 * @returns {{tramos: {texto:string, negrita:boolean, x:number}[], ancho:number}[]}
 */
export function envolverTexto(segmentos, anchoMax, pt, medidor) {
  const palabras = [];
  for (const s of segmentos) {
    for (const p of s.texto.split(/\s+/).filter(Boolean)) {
      palabras.push(...partirPalabraLarga(p, !!s.negrita, anchoMax, pt, medidor));
    }
  }

  const lineas = [];
  let actual = [];
  let anchoActual = 0;
  const espacio = medidor.ancho(' ', pt, false);

  for (const palabra of palabras) {
    const anchoPalabra = medidor.ancho(palabra.texto, pt, palabra.negrita);
    const necesario = actual.length ? espacio + anchoPalabra : anchoPalabra;
    if (actual.length && anchoActual + necesario > anchoMax + 1e-6) {
      lineas.push(cerrarLinea(actual, pt, medidor));
      actual = [];
      anchoActual = 0;
    }
    actual.push(palabra);
    anchoActual += actual.length > 1 ? espacio + anchoPalabra : anchoPalabra;
  }
  if (actual.length) lineas.push(cerrarLinea(actual, pt, medidor));
  return lineas;
}

/** Corta por caracteres una palabra que no cabe sola en una línea. */
function partirPalabraLarga(texto, negrita, anchoMax, pt, medidor) {
  if (medidor.ancho(texto, pt, negrita) <= anchoMax) return [{ texto, negrita }];
  const trozos = [];
  let trozo = '';
  for (const c of texto) {
    if (trozo && medidor.ancho(trozo + c, pt, negrita) > anchoMax) {
      trozos.push({ texto: trozo, negrita });
      trozo = '';
    }
    trozo += c;
  }
  if (trozo) trozos.push({ texto: trozo, negrita });
  return trozos;
}

/** Agrupa palabras consecutivas con el mismo estilo en tramos con su posición x. */
function cerrarLinea(palabras, pt, medidor) {
  const tramos = [];
  for (const p of palabras) {
    const ultimo = tramos.at(-1);
    if (ultimo && ultimo.negrita === p.negrita) ultimo.texto += ` ${p.texto}`;
    else tramos.push({ texto: tramos.length ? ` ${p.texto}` : p.texto, negrita: p.negrita });
  }
  let x = 0;
  for (const t of tramos) {
    t.x = x;
    x += medidor.ancho(t.texto, pt, t.negrita);
  }
  return { tramos, ancho: x };
}

/** Escalas de fuente para un tamaño de etiqueta. */
export function escalasTipograficas(anchoMm, altoMm) {
  const s = Math.min(anchoMm, altoMm) / 74;
  return {
    margen: Math.min(2.5, Math.max(1.8, 2.5 * s)),
    nombreMax: 11.5 * s,
    nombreMin: Math.max(5.5, 7 * s),
    palabra: Math.max(6.5, 10 * s),
    cuerpoMax: 7.5 * s,
    cuerpoMin: s < 1 ? 4 : 4.4,
    pie: Math.max(4, 5.2 * s),
    separacion: 1.2 * s,
  };
}

/**
 * Distribuye los pictogramas.
 *  - Si caben en una fila, van en fila (separados 1 mm o tocándose por las puntas).
 *  - Si no, en zigzag: rombos encajados que se alternan arriba y abajo. Ocupa
 *    ~1,5 veces el lado en altura en lugar de 2 filas completas.
 *  - Si el zigzag tampoco cabe a lo ancho, se apilan varios zigzags.
 */
export function ubicarPictogramas(codigos, x0, ancho, y0, lado) {
  const n = codigos.length;
  if (n === 0) return { elementos: [], alto: 0 };
  const picto = (codigo, x, y) => ({ tipo: 'pictograma', codigo, x, y, lado });

  if (n * lado <= ancho + 1e-6) {
    const separacion = n * lado + (n - 1) <= ancho ? 1 : 0;
    const anchoFila = n * lado + (n - 1) * separacion;
    const inicio = x0 + (ancho - anchoFila) / 2;
    return {
      elementos: codigos.map((c, i) => picto(c, inicio + i * (lado + separacion), y0)),
      alto: lado,
    };
  }

  // Paso entre rombos del zigzag (deja ~0,8 mm entre bordes vecinos).
  const paso = (lado + 1.2) / 2;
  // Cuántos rombos caben en un zigzag: ancho = (k - 1) * paso + lado
  const porZigzag = Math.max(1, Math.floor((ancho - lado) / paso) + 1);
  const grupos = Math.ceil(n / porZigzag);
  const porGrupo = Math.ceil(n / grupos);
  const elementos = [];
  let y = y0;
  for (let g = 0; g < grupos; g += 1) {
    const grupo = codigos.slice(g * porGrupo, (g + 1) * porGrupo);
    const k = grupo.length;
    const anchoGrupo = (k - 1) * paso + lado;
    const inicio = x0 + (ancho - anchoGrupo) / 2;
    grupo.forEach((c, i) => elementos.push(picto(c, inicio + i * paso, y + (i % 2) * paso)));
    y += (k > 1 ? lado + paso : lado) + (g < grupos - 1 ? 1 : 0);
  }
  return { elementos, alto: y - y0 };
}

/**
 * Distribuye los pictogramas en una columna (diseño horizontal), de arriba
 * abajo y alineados a la izquierda de `x0`:
 *  - en línea recta si caben en la altura disponible;
 *  - si no, en zigzag vertical (rombos encajados, más angosto que dos columnas);
 *  - si tampoco, en varias columnas de zigzag.
 * @returns {{elementos: object[], ancho: number, alto: number}}
 */
export function ubicarPictogramasEnColumna(codigos, x0, y0, altoDisponible, lado) {
  const n = codigos.length;
  if (n === 0) return { elementos: [], ancho: 0, alto: 0 };
  const picto = (codigo, x, y) => ({ tipo: 'pictograma', codigo, x, y, lado });

  if (n * lado + (n - 1) <= altoDisponible + 1e-6) {
    return {
      elementos: codigos.map((c, i) => picto(c, x0, y0 + i * (lado + 1))),
      ancho: lado,
      alto: n * lado + (n - 1),
    };
  }

  const paso = (lado + 1.2) / 2;
  const porColumna = Math.max(1, Math.floor((altoDisponible - lado) / paso) + 1);
  const columnas = Math.ceil(n / porColumna);
  const porGrupo = Math.ceil(n / columnas);
  const elementos = [];
  let x = x0;
  let alto = 0;
  for (let c = 0; c < columnas; c += 1) {
    const grupo = codigos.slice(c * porGrupo, (c + 1) * porGrupo);
    grupo.forEach((codigo, i) => elementos.push(picto(codigo, x + (i % 2) * paso, y0 + i * paso)));
    alto = Math.max(alto, (grupo.length - 1) * paso + lado);
    x += (grupo.length > 1 ? lado + paso : lado) + 1;
  }
  return { elementos, ancho: x - 1 - x0, alto };
}

/** Convierte líneas envueltas en elementos de texto. */
function lineasAElementos(lineas, x0, ancho, y0, pt, alineacion = 'izquierda', color) {
  const alto = altoLinea(pt);
  return lineas.map((linea, i) => {
    const desplazamiento = alineacion === 'centro' ? (ancho - linea.ancho) / 2 : 0;
    return {
      tipo: 'texto',
      x: x0 + desplazamiento,
      // y = línea base
      y: y0 + i * alto + pt * PT_A_MM * 0.88,
      pt,
      tramos: linea.tramos,
      color,
    };
  });
}

/** Bloques de frases (H y P) como lista de párrafos con segmentos. */
function parrafosCuerpo(datos, esPeligroso) {
  const parrafos = [];
  const frase = (f) =>
    f.codigo ? [{ texto: f.codigo, negrita: true }, { texto: f.texto }] : [{ texto: f.texto }];

  if (datos.frasesH.length) {
    parrafos.push({ titulo: true, segmentos: [{ texto: 'Indicaciones de peligro:', negrita: true }] });
    datos.frasesH.forEach((f) => parrafos.push({ segmentos: frase(f) }));
  }
  if (datos.frasesP.length) {
    const titulo = esPeligroso ? 'Consejos de prudencia:' : 'Precauciones:';
    parrafos.push({
      titulo: true,
      espacioAntes: datos.frasesH.length > 0,
      segmentos: [{ texto: titulo, negrita: true }],
    });
    datos.frasesP.forEach((f) => parrafos.push({ segmentos: frase(f) }));
  }
  return parrafos;
}

/** Mide (y opcionalmente coloca) el cuerpo con un tamaño de fuente dado. */
function maquetarCuerpo(parrafos, x0, ancho, y0, pt, medidor, separacion) {
  const elementos = [];
  let y = y0;
  for (const p of parrafos) {
    if (p.espacioAntes) y += separacion * 0.8;
    const lineas = envolverTexto(p.segmentos, ancho, pt, medidor);
    elementos.push(...lineasAElementos(lineas, x0, ancho, y, pt));
    y += lineas.length * altoLinea(pt) + (p.titulo ? 0 : pt * PT_A_MM * 0.15);
  }
  return { elementos, alto: y - y0 };
}

/** Medidas del cuadro para pegar el sticker del lote (mm). */
export const CUADRO_LOTE = Object.freeze({ anchoMm: 32, altoMm: 15 });

/** Segmentos del pie de la etiqueta (sin el lote: va en el sticker). */
function parrafosPie(datos) {
  const parrafos = [];
  if (datos.telefonoEmergencia) {
    parrafos.push([{ texto: 'Emergencias:', negrita: true }, { texto: datos.telefonoEmergencia }]);
  }
  const extras = [
    datos.fechaFabricacion && ['F. fab.:', formatearFecha(datos.fechaFabricacion)],
    datos.fechaVencimiento && ['F. venc.:', formatearFecha(datos.fechaVencimiento)],
    datos.contenido && ['Contenido:', datos.contenido],
  ].filter(Boolean);
  for (const [etiqueta, valor] of extras)
    parrafos.push([{ texto: etiqueta, negrita: true }, { texto: valor }]);
  return parrafos;
}

/**
 * Pie: textos a la izquierda y cuadro del lote abajo a la derecha.
 * Si no queda ancho suficiente al lado del cuadro, los textos van encima.
 */
function maquetarPie(datos, x0, ancho, yInferior, e, medidor, conCuadroLote) {
  const elementos = [];
  const cuadro = conCuadroLote ? CUADRO_LOTE : { anchoMm: 0, altoMm: 0 };
  const anchoLateral = ancho - cuadro.anchoMm - 2;
  const alLado = !conCuadroLote || anchoLateral >= 26;
  const anchoTexto = alLado && conCuadroLote ? anchoLateral : ancho;

  const lineas = parrafosPie(datos).flatMap((p) => envolverTexto(p, anchoTexto, e.pie, medidor));
  const altoTexto = lineas.length * altoLinea(e.pie);
  const alto = alLado ? Math.max(altoTexto, cuadro.altoMm) : altoTexto + 1 + cuadro.altoMm;
  if (alto === 0) return { elementos, alto: 0 };

  const yTexto = alLado ? yInferior - altoTexto : yInferior - alto;
  elementos.push(...lineasAElementos(lineas, x0, anchoTexto, yTexto, e.pie));

  if (conCuadroLote) {
    const x = x0 + ancho - cuadro.anchoMm;
    const y = yInferior - cuadro.altoMm;
    elementos.push({
      tipo: 'rect',
      x,
      y,
      ancho: cuadro.anchoMm,
      alto: cuadro.altoMm,
      grosor: 0.3,
      guion: true,
    });
    const pt = 4.5;
    elementos.push({
      tipo: 'texto',
      x: x + 1,
      y: y + 1 + pt * PT_A_MM * 0.88,
      pt,
      tramos: [{ texto: 'LOTE', negrita: true, x: 0 }],
    });
  }
  return { elementos, alto };
}

/**
 * Coloca el pie abajo y el cuerpo (frases H/P) en el espacio que queda,
 * buscando la letra más grande que quepa.
 */
function maquetarZonaTexto(datos, zona, e, medidor, opciones, esPeligroso) {
  const { x, ancho, yInicio, yFin } = zona;
  const elementos = [];
  const avisos = [];

  const pie = maquetarPie(datos, x, ancho, yFin, e, medidor, opciones.cuadroLote !== false);
  const yPie = yFin - pie.alto;
  if (pie.alto) {
    const yLinea = yPie - e.separacion * 0.6;
    elementos.push({ tipo: 'linea', x1: x, y1: yLinea, x2: x + ancho, y2: yLinea, grosor: 0.2 });
    elementos.push(...pie.elementos);
  }

  const limiteCuerpo = (pie.alto ? yPie - e.separacion * 1.2 : yFin) - yInicio;
  const parrafos = parrafosCuerpo(datos, esPeligroso);
  let ptCuerpo = e.cuerpoMax;
  let cuerpo = maquetarCuerpo(parrafos, x, ancho, yInicio, ptCuerpo, medidor, e.separacion);
  while (cuerpo.alto > limiteCuerpo && ptCuerpo > e.cuerpoMin) {
    ptCuerpo = Math.max(e.cuerpoMin, ptCuerpo - 0.25);
    cuerpo = maquetarCuerpo(parrafos, x, ancho, yInicio, ptCuerpo, medidor, e.separacion);
  }

  const desborde = cuerpo.alto > limiteCuerpo + 0.01;
  if (desborde) {
    const limiteY = yInicio + limiteCuerpo;
    const visibles = cuerpo.elementos.filter((el) => el.y <= limiteY);
    elementos.push(...visibles);
    avisos.push({
      nivel: 'error',
      mensaje: `El texto no cabe en esta etiqueta (${cuerpo.elementos.length - visibles.length} línea(s) quedaron por fuera). Use un tamaño mayor o resuma las frases P.`,
    });
  } else {
    elementos.push(...cuerpo.elementos);
  }
  if (!desborde && ptCuerpo < 5 && parrafos.length) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: `El texto quedó en ${ptCuerpo.toFixed(1)} pt; puede ser difícil de leer. Considere un tamaño de etiqueta mayor.`,
    });
  }
  return { elementos, avisos, ptCuerpo, desborde };
}

/** Nombre del producto: hasta 2 líneas, reduciendo la fuente si hace falta. */
function maquetarNombre(datos, x0, ancho, y, e, medidor) {
  const nombre = (datos.nombreProducto || 'SIN NOMBRE').toUpperCase();
  let pt = e.nombreMax;
  let lineas = envolverTexto([{ texto: nombre, negrita: true }], ancho, pt, medidor);
  while (lineas.length > 2 && pt > e.nombreMin) {
    pt = Math.max(e.nombreMin, pt - 0.5);
    lineas = envolverTexto([{ texto: nombre, negrita: true }], ancho, pt, medidor);
  }
  return {
    elementos: lineasAElementos(lineas, x0, ancho, y, pt, 'centro'),
    alto: lineas.length * altoLinea(pt),
  };
}

/** Palabra de advertencia o leyenda de producto no peligroso. */
function maquetarLeyenda(datos, x0, ancho, y, e, medidor, esPeligroso) {
  const leyenda = esPeligroso
    ? (datos.palabraAdvertencia || '').toUpperCase()
    : 'PRODUCTO NO CLASIFICADO COMO PELIGROSO';
  if (!leyenda) return { elementos: [], alto: 0 };
  const pt = esPeligroso ? e.palabra : e.palabra * 0.75;
  const lineas = envolverTexto([{ texto: leyenda, negrita: true }], ancho, pt, medidor);
  return {
    elementos: lineasAElementos(lineas, x0, ancho, y, pt, 'centro'),
    alto: lineas.length * altoLinea(pt),
  };
}

/**
 * Diseño en flujo: nombre, fila de pictogramas, palabra de advertencia,
 * frases y pie, uno debajo del otro. Es el natural para etiquetas verticales.
 */
function disenoFlujo(datos, formato, medidor, opciones, e, esPeligroso) {
  const { anchoMm, altoMm, pictogramaMm } = formato;
  const x0 = e.margen;
  const ancho = anchoMm - 2 * e.margen;
  const elementos = [];
  let y = e.margen;

  const nombre = maquetarNombre(datos, x0, ancho, y, e, medidor);
  elementos.push(...nombre.elementos);
  y += nombre.alto + e.separacion;

  const picto = ubicarPictogramas(datos.pictogramas, x0, ancho, y, pictogramaMm);
  elementos.push(...picto.elementos);
  if (picto.alto) y += picto.alto + e.separacion * 0.6;

  const leyenda = maquetarLeyenda(datos, x0, ancho, y, e, medidor, esPeligroso);
  elementos.push(...leyenda.elementos);
  if (leyenda.alto) y += leyenda.alto + e.separacion * 0.6;

  const zona = maquetarZonaTexto(
    datos,
    { x: x0, ancho, yInicio: y, yFin: altoMm - e.margen },
    e,
    medidor,
    opciones,
    esPeligroso,
  );
  return { ...zona, elementos: [...elementos, ...zona.elementos] };
}

/**
 * Diseño en columnas: nombre arriba; a la izquierda los pictogramas y la
 * palabra de advertencia; a la derecha las frases, la emergencia y el lote.
 * Aprovecha mejor las etiquetas horizontales.
 */
function disenoColumnas(datos, formato, medidor, opciones, e, esPeligroso) {
  const { anchoMm, altoMm, pictogramaMm } = formato;
  const x0 = e.margen;
  const ancho = anchoMm - 2 * e.margen;
  const elementos = [];
  let y = e.margen;

  const nombre = maquetarNombre(datos, x0, ancho, y, e, medidor);
  elementos.push(...nombre.elementos);
  y += nombre.alto + e.separacion;
  const yFin = altoMm - e.margen;

  // Columna izquierda: se reserva espacio para la palabra de advertencia debajo.
  const altoLeyenda = esPeligroso && datos.palabraAdvertencia ? altoLinea(e.palabra) + e.separacion : 0;
  const picto = ubicarPictogramasEnColumna(datos.pictogramas, 0, 0, yFin - y - altoLeyenda, pictogramaMm);
  const anchoLeyenda = esPeligroso
    ? medidor.ancho((datos.palabraAdvertencia || '').toUpperCase(), e.palabra, true)
    : 0;
  const anchoColumna = Math.max(picto.ancho, anchoLeyenda);
  const altoColumna = picto.alto + (picto.alto ? e.separacion * 0.6 : 0) + altoLeyenda;
  // Centrada vertical y horizontalmente en su espacio
  const yColumna = y + Math.max(0, (yFin - y - altoColumna) / 2);
  const dx = x0 + (anchoColumna - picto.ancho) / 2;
  elementos.push(...picto.elementos.map((p) => ({ ...p, x: p.x + dx, y: p.y + yColumna })));
  const leyenda = maquetarLeyenda(
    datos,
    x0,
    anchoColumna,
    yColumna + picto.alto + e.separacion * 0.6,
    e,
    medidor,
    esPeligroso,
  );
  elementos.push(...leyenda.elementos);

  const separacionColumnas = 3;
  const xTexto = x0 + anchoColumna + separacionColumnas;
  elementos.push({
    tipo: 'linea',
    x1: xTexto - separacionColumnas / 2,
    y1: y,
    x2: xTexto - separacionColumnas / 2,
    y2: yFin,
    grosor: 0.2,
  });

  const zona = maquetarZonaTexto(
    datos,
    { x: xTexto, ancho: x0 + ancho - xTexto, yInicio: y, yFin },
    e,
    medidor,
    opciones,
    esPeligroso,
  );
  return { ...zona, elementos: [...elementos, ...zona.elementos] };
}

/**
 * Diseña la etiqueta. En etiquetas horizontales con pictogramas se prueban
 * los dos diseños (flujo y columnas) y se usa el que deja la letra más grande.
 * @param {object} datos  Datos de la etiqueta (ver README).
 * @param {{anchoMm:number, altoMm:number, pictogramaMm:number}} formato
 * @param {Medidor} medidor
 * @param {{borde?: boolean, cuadroLote?: boolean}} [opciones]
 */
export function disenarEtiqueta(datos, formato, medidor, opciones = {}) {
  const { anchoMm, altoMm } = formato;
  const e = escalasTipograficas(anchoMm, altoMm);
  const esPeligroso = datos.frasesH.length > 0 || datos.pictogramas.length > 0;

  const opcionesDiseno = [disenoFlujo(datos, formato, medidor, opciones, e, esPeligroso)];
  if (anchoMm > altoMm && datos.pictogramas.length) {
    opcionesDiseno.push(disenoColumnas(datos, formato, medidor, opciones, e, esPeligroso));
  }
  const mejor = opcionesDiseno.reduce((a, b) => {
    if (a.desborde !== b.desborde) return a.desborde ? b : a;
    return b.ptCuerpo > a.ptCuerpo + 0.1 ? b : a;
  });

  const elementos = [...mejor.elementos];
  if (opciones.borde !== false) {
    elementos.unshift({ tipo: 'rect', x: 0.5, y: 0.5, ancho: anchoMm - 1, alto: altoMm - 1, grosor: 0.3 });
  }
  return { elementos, avisos: mejor.avisos, tamanoCuerpoPt: mejor.ptCuerpo, desborde: mejor.desborde };
}
