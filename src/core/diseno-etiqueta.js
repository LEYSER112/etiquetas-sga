/**
 * Diseño (maquetación) de la etiqueta SGA.
 *
 * Es lógica pura: recibe los datos y un "medidor" de texto y devuelve una
 * lista de elementos con posiciones en milímetros (origen arriba a la
 * izquierda). El generador de PDF solo se encarga de dibujarlos.
 *
 * Contenido de la etiqueta:
 *   1. Encabezado: código interno (Odoo) y nombre del producto en la misma fila
 *   2. Pictogramas y palabra de advertencia
 *   3. Indicaciones de peligro (H) y consejos de prudencia (P)
 *   4. Pie: recuadro de emergencias CISPROQUIM (con el EAN-13 debajo, si hay),
 *      contenido y fechas, y cuadro para el sticker del lote
 */
import { formatearFecha } from './texto.js';
import { PT_A_MM } from './medidas.js';
import { CISPROQUIM } from '../config/empresa.js';
import { EAN13, anchoEan13, maquetarEan13 } from './ean13.js';

export { PT_A_MM };
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
    escala: s,
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
const SEPARACION_CAJAS = 2;
const RELLENO_CAJA = 1;

/** Contenido y fechas en una sola línea (se parte si no cabe). */
function maquetarInfo(datos, x, ancho, y, e, medidor) {
  const extras = [
    datos.contenido && ['Contenido:', datos.contenido],
    datos.fechaFabricacion && ['F. fab.:', formatearFecha(datos.fechaFabricacion)],
    datos.fechaVencimiento && ['F. venc.:', formatearFecha(datos.fechaVencimiento)],
  ].filter(Boolean);
  if (!extras.length) return { elementos: [], alto: 0 };
  const segmentos = extras.flatMap(([etiqueta, valor], i) => [
    { texto: (i ? '·  ' : '') + etiqueta, negrita: true },
    { texto: valor },
  ]);
  const lineas = envolverTexto(segmentos, ancho, e.pie, medidor);
  return { elementos: lineasAElementos(lineas, x, ancho, y, e.pie), alto: lineas.length * altoLinea(e.pie) };
}

/** Tamaños de letra del recuadro de emergencias para una escala dada. */
function letrasEmergencia(e) {
  return { titulo: e.pie * 1.05, etiqueta: e.pie, numero: e.pie * 1.55 };
}

/** Alto de las barras del EAN-13 según el tamaño de la etiqueta (mm). */
function altoBarrasEan(e) {
  return Math.min(22, Math.max(8, 10 * e.escala));
}

/** Ancho mínimo que necesita el recuadro de emergencias (mm). */
function anchoMinimoEmergencia(datos, e, medidor) {
  const l = letrasEmergencia(e);
  const textos = [
    medidor.ancho(CISPROQUIM.titulo, l.titulo, true),
    ...CISPROQUIM.lineas.map((f) => medidor.ancho(f.etiqueta, l.etiqueta, false)),
    ...CISPROQUIM.lineas.map((f) => medidor.ancho(f.numero, l.numero * 0.8, true)),
  ];
  const barras = datos.ean13 ? anchoEan13(EAN13.magnificacionMin) : 0;
  return Math.max(...textos, barras) + 2 * RELLENO_CAJA;
}

/**
 * Recuadro de emergencias: barra negra con el título, los teléfonos de
 * CISPROQUIM (etiqueta a la izquierda, número grande a la derecha; o uno debajo
 * del otro si no caben) y, si hay, el código de barras EAN-13 debajo.
 * @returns {{elementos: object[], alto: number, avisos: object[]}}
 */
function maquetarEmergencia(datos, x, y, ancho, altoMinimo, e, medidor) {
  const l = letrasEmergencia(e);
  const avisos = [];
  const interior = ancho - 2 * RELLENO_CAJA;
  const elementos = [];

  // Barra de título
  const altoTitulo = altoLinea(l.titulo) + 0.8;
  const ptTitulo = Math.min(l.titulo, ajustarPt(CISPROQUIM.titulo, interior, l.titulo, true, medidor));
  elementos.push({ tipo: 'relleno', x, y, ancho, alto: altoTitulo });
  elementos.push(textoCentrado(CISPROQUIM.titulo, x, ancho, y + 0.4, ptTitulo, true, medidor, 'blanco'));
  let yActual = y + altoTitulo + 0.7;

  // Teléfonos
  const separacion = 1.5;
  const enFila = CISPROQUIM.lineas.every(
    (f) =>
      medidor.ancho(f.etiqueta, l.etiqueta, false) + separacion + medidor.ancho(f.numero, l.numero, true) <=
      interior,
  );
  for (const f of CISPROQUIM.lineas) {
    if (enFila) {
      const altoFila = altoLinea(l.numero);
      const base = yActual + l.numero * PT_A_MM * 0.9;
      elementos.push(texto(f.etiqueta, x + RELLENO_CAJA, base, l.etiqueta, false));
      const anchoNumero = medidor.ancho(f.numero, l.numero, true);
      elementos.push(texto(f.numero, x + ancho - RELLENO_CAJA - anchoNumero, base, l.numero, true));
      yActual += altoFila;
    } else {
      const ptNumero = Math.min(l.numero, ajustarPt(f.numero, interior, l.numero, true, medidor));
      elementos.push(textoCentrado(f.etiqueta, x, ancho, yActual, l.etiqueta, false, medidor));
      yActual += altoLinea(l.etiqueta) * 0.95;
      elementos.push(textoCentrado(f.numero, x, ancho, yActual, ptNumero, true, medidor));
      yActual += altoLinea(ptNumero) + 0.3;
    }
  }

  // Código de barras
  if (datos.ean13) {
    yActual += 0.8;
    const magnificacion = Math.min(Math.max(1, e.escala), interior / anchoEan13(1));
    if (magnificacion < EAN13.magnificacionMin) {
      avisos.push({
        nivel: 'advertencia',
        mensaje: `El código de barras quedó al ${Math.round(magnificacion * 100)} % (GS1 recomienda mínimo 80 %). Use una etiqueta más grande.`,
      });
    }
    const anchoCodigo = anchoEan13(magnificacion);
    const ean = maquetarEan13(
      datos.ean13,
      x + (ancho - anchoCodigo) / 2,
      yActual,
      magnificacion,
      altoBarrasEan(e),
      medidor,
    );
    elementos.push(...ean.elementos);
    yActual += ean.alto;
  }

  const alto = Math.max(altoMinimo, yActual + RELLENO_CAJA * 0.6 - y);
  elementos.unshift({ tipo: 'rect', x, y, ancho, alto, grosor: 0.4 });
  return { elementos, alto, avisos };
}

/** Tamaño de letra (pt) con el que `texto` ocupa como máximo `ancho`. */
function ajustarPt(texto, ancho, pt, negrita, medidor) {
  const medido = medidor.ancho(texto, pt, negrita);
  return medido <= ancho ? pt : (pt * ancho) / medido;
}

function texto(contenido, x, base, pt, negrita, color) {
  return { tipo: 'texto', x, y: base, pt, color, tramos: [{ texto: contenido, negrita, x: 0 }] };
}

function textoCentrado(contenido, x, ancho, yArriba, pt, negrita, medidor, color) {
  const anchoTexto = medidor.ancho(contenido, pt, negrita);
  return texto(contenido, x + (ancho - anchoTexto) / 2, yArriba + pt * PT_A_MM * 0.9, pt, negrita, color);
}

/** Cuadro punteado para pegar el sticker del lote. */
function maquetarCuadroLote(x, y) {
  const pt = 4.5;
  return [
    { tipo: 'rect', x, y, ancho: CUADRO_LOTE.anchoMm, alto: CUADRO_LOTE.altoMm, grosor: 0.3, guion: true },
    texto('LOTE', x + 1, y + 1 + pt * PT_A_MM * 0.88, pt, true),
  ];
}

/**
 * Pie de la etiqueta, apoyado en `yInferior`.
 * - Normal: recuadro de emergencias a la izquierda y cuadro del lote a la
 *   derecha; el contenido y las fechas van sobre el cuadro del lote si hay
 *   espacio (cuando el EAN-13 hace más alto el recuadro), o encima de todo.
 * - Etiquetas angostas: todo apilado.
 * @returns {{elementos: object[], alto: number, avisos: object[]}}
 */
function maquetarPie(datos, x0, ancho, yInferior, e, medidor, conCuadroLote) {
  const lote = conCuadroLote ? CUADRO_LOTE : null;
  const anchoLateral = lote ? ancho - lote.anchoMm - SEPARACION_CAJAS : ancho;
  const alLado = !lote || anchoLateral >= anchoMinimoEmergencia(datos, e, medidor);
  const elementos = [];

  if (alLado) {
    // Se maqueta arriba (y = 0) y luego se desplaza para apoyarlo abajo.
    const emergencia = maquetarEmergencia(datos, x0, 0, anchoLateral, lote ? lote.altoMm : 0, e, medidor);
    const xLote = x0 + ancho - (lote?.anchoMm ?? 0);
    const infoArriba = lote ? maquetarInfo(datos, xLote, lote.anchoMm, 0, e, medidor) : { alto: 0 };
    const cabeSobreLote =
      lote && infoArriba.alto && emergencia.alto - lote.altoMm >= infoArriba.alto + SEPARACION_CAJAS;

    let altoTotal = emergencia.alto;
    const yBase = yInferior - emergencia.alto;
    elementos.push(...mover(emergencia.elementos, 0, yBase));
    if (lote) elementos.push(...maquetarCuadroLote(xLote, yInferior - lote.altoMm));

    if (cabeSobreLote) {
      elementos.push(...mover(infoArriba.elementos, 0, yBase));
    } else {
      const info = maquetarInfo(datos, x0, ancho, 0, e, medidor);
      if (info.alto) {
        altoTotal += info.alto + SEPARACION_CAJAS * 0.5;
        elementos.push(...mover(info.elementos, 0, yInferior - altoTotal));
      }
    }
    return { elementos, alto: altoTotal, avisos: emergencia.avisos };
  }

  // Apilado: info, recuadro de emergencias a todo el ancho y cuadro del lote.
  let y = yInferior - lote.altoMm;
  elementos.push(...maquetarCuadroLote(x0 + ancho - lote.anchoMm, y));
  const emergencia = maquetarEmergencia(datos, x0, 0, ancho, 0, e, medidor);
  y -= SEPARACION_CAJAS + emergencia.alto;
  elementos.push(...mover(emergencia.elementos, 0, y));
  const info = maquetarInfo(datos, x0, ancho, 0, e, medidor);
  if (info.alto) {
    y -= info.alto + SEPARACION_CAJAS * 0.5;
    elementos.push(...mover(info.elementos, 0, y));
  }
  return { elementos, alto: yInferior - y, avisos: emergencia.avisos };
}

/** Desplaza elementos ya maquetados. */
function mover(elementos, dx, dy) {
  return elementos.map((el) =>
    el.tipo === 'linea'
      ? { ...el, x1: el.x1 + dx, x2: el.x2 + dx, y1: el.y1 + dy, y2: el.y2 + dy }
      : { ...el, x: el.x + dx, y: el.y + dy },
  );
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
  elementos.push(...pie.elementos);
  avisos.push(...pie.avisos);

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
function envolverNombre(datos, ancho, e, medidor) {
  const nombre = (datos.nombreProducto || 'SIN NOMBRE').toUpperCase();
  let pt = e.nombreMax;
  let lineas = envolverTexto([{ texto: nombre, negrita: true }], ancho, pt, medidor);
  while (lineas.length > 2 && pt > e.nombreMin) {
    pt = Math.max(e.nombreMin, pt - 0.5);
    lineas = envolverTexto([{ texto: nombre, negrita: true }], ancho, pt, medidor);
  }
  return { lineas, pt, alto: lineas.length * altoLinea(pt) };
}

/** Letra mínima del código interno antes de ensanchar su celda (pt). */
const CODIGO_PT_MIN = 6;

/** Ancho que necesita el código interno con la letra mínima (mm). */
function anchoMinimoCodigo(datos, medidor) {
  return datos.codigoInterno ? medidor.ancho(datos.codigoInterno, CODIGO_PT_MIN, true) : 0;
}

/**
 * Fila de encabezado: el código interno en su celda a la izquierda y el
 * nombre del producto a la derecha, separados por una línea vertical y
 * centrados en la misma fila. Sin código, el nombre va centrado a todo el ancho.
 * @param {number} anchoCelda  Ancho de la celda del código (en columnas, el de
 *   la columna de pictogramas; en flujo, 0 = según el código).
 * @returns {{elementos: object[], alto: number, xTexto: number}}
 */
function maquetarEncabezado(datos, x0, ancho, y, e, medidor, anchoCelda = 0) {
  if (!datos.codigoInterno) {
    const nombre = envolverNombre(datos, ancho, e, medidor);
    return {
      elementos: lineasAElementos(nombre.lineas, x0, ancho, y, nombre.pt, 'centro'),
      alto: nombre.alto,
      conCodigo: false,
    };
  }

  const separacion = 3;
  const celda = Math.max(anchoCelda, anchoMinimoCodigo(datos, medidor) + (anchoCelda ? 0 : 2));
  const xNombre = x0 + celda + separacion;
  const nombre = envolverNombre(datos, x0 + ancho - xNombre, e, medidor);
  // El código usa la letra del nombre, o la más grande que quepa en su celda.
  const ptCodigo = Math.min(nombre.pt, ajustarPt(datos.codigoInterno, celda, nombre.pt, true, medidor));
  const alto = Math.max(nombre.alto, altoLinea(ptCodigo));

  const elementos = lineasAElementos(nombre.lineas, xNombre, 0, y + (alto - nombre.alto) / 2, nombre.pt);
  elementos.push(
    textoCentrado(
      datos.codigoInterno,
      x0,
      celda,
      y + (alto - altoLinea(ptCodigo)) / 2,
      ptCodigo,
      true,
      medidor,
    ),
  );
  return { elementos, alto, conCodigo: true, xLinea: x0 + celda + separacion / 2 };
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
 * Diseño en flujo: encabezado, fila de pictogramas, palabra de advertencia,
 * frases y pie, uno debajo del otro. Es el natural para etiquetas verticales.
 */
function disenoFlujo(datos, formato, medidor, opciones, e, esPeligroso) {
  const { anchoMm, altoMm, pictogramaMm } = formato;
  const x0 = e.margen;
  const ancho = anchoMm - 2 * e.margen;
  const elementos = [];
  let y = e.margen;

  const encabezado = maquetarEncabezado(datos, x0, ancho, y, e, medidor);
  elementos.push(...encabezado.elementos);
  if (encabezado.conCodigo) {
    elementos.push(lineaV(encabezado.xLinea, y - 0.5, y + encabezado.alto + 0.5));
    y += encabezado.alto + e.separacion * 0.6;
    elementos.push(lineaH(x0, x0 + ancho, y));
    y += e.separacion * 0.8;
  } else {
    y += encabezado.alto + e.separacion;
  }

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

const lineaV = (x, y1, y2) => ({ tipo: 'linea', x1: x, y1, x2: x, y2, grosor: 0.25 });
const lineaH = (x1, x2, y) => ({ tipo: 'linea', x1, y1: y, x2, y2: y, grosor: 0.25 });

/**
 * Diseño en columnas (etiquetas horizontales):
 *
 *   código Odoo  │ NOMBRE DE LA MATERIA PRIMA
 *   ─────────────┼────────────────────────────
 *   pictogramas  │ frases H y P
 *   PELIGRO      │ [emergencias + EAN-13] [lote]
 *
 * La línea vertical separa la columna de pictogramas del resto; el código va
 * encima de los pictogramas y el nombre después de la línea, en la misma fila.
 */
function disenoColumnas(datos, formato, medidor, opciones, e, esPeligroso) {
  const { anchoMm, altoMm, pictogramaMm } = formato;
  const x0 = e.margen;
  const ancho = anchoMm - 2 * e.margen;
  const yInicio = e.margen;
  const yFin = altoMm - e.margen;
  const separacionColumnas = 3;
  const altoLeyenda = esPeligroso && datos.palabraAdvertencia ? altoLinea(e.palabra) + e.separacion : 0;
  const anchoLeyenda = esPeligroso
    ? medidor.ancho((datos.palabraAdvertencia || '').toUpperCase(), e.palabra, true)
    : 0;

  // El ancho de la columna depende de cómo se acomoden los pictogramas, y eso
  // del alto que deja el encabezado: se calcula en dos pasadas.
  let anchoColumna = 0;
  let encabezado = null;
  let picto = null;
  let yCuerpo = yInicio;
  for (let pasada = 0; pasada < 2; pasada += 1) {
    const altoPictos = yFin - yCuerpo - altoLeyenda;
    picto = ubicarPictogramasEnColumna(datos.pictogramas, 0, 0, altoPictos, pictogramaMm);
    anchoColumna = Math.max(picto.ancho, anchoLeyenda, anchoMinimoCodigo(datos, medidor));
    const xTexto = x0 + anchoColumna + separacionColumnas;
    encabezado = datos.codigoInterno
      ? maquetarEncabezado(datos, x0, ancho, yInicio, e, medidor, anchoColumna)
      : (() => {
          const nombre = envolverNombre(datos, x0 + ancho - xTexto, e, medidor);
          return {
            elementos: lineasAElementos(nombre.lineas, xTexto, 0, yInicio, nombre.pt),
            alto: nombre.alto,
            conCodigo: false,
          };
        })();
    yCuerpo = encabezado.conCodigo ? yInicio + encabezado.alto + e.separacion * 1.4 : yInicio;
  }

  const xLinea = x0 + anchoColumna + separacionColumnas / 2;
  const xTexto = x0 + anchoColumna + separacionColumnas;
  const elementos = [...encabezado.elementos, lineaV(xLinea, yInicio - 0.5, yFin)];
  if (encabezado.conCodigo) {
    elementos.push(lineaH(x0, x0 + ancho, yInicio + encabezado.alto + e.separacion * 0.6));
  }

  // Columna izquierda: pictogramas y palabra de advertencia, centrados.
  const altoColumna = picto.alto + (picto.alto ? e.separacion * 0.6 : 0) + altoLeyenda;
  const yColumna = yCuerpo + Math.max(0, (yFin - yCuerpo - altoColumna) / 2);
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

  // Columna derecha: debajo del nombre (sin código, el nombre está en esta columna).
  const yTexto = encabezado.conCodigo ? yCuerpo : yInicio + encabezado.alto + e.separacion;
  const zona = maquetarZonaTexto(
    datos,
    { x: xTexto, ancho: x0 + ancho - xTexto, yInicio: yTexto, yFin },
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
