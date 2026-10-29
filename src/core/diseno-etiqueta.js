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
 *   5. Pie: proveedor, teléfono de emergencia, lote y fechas
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
    cuerpoMin: Math.max(4, 4.4 * s),
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

/** Segmentos del pie de la etiqueta. */
function parrafosPie(datos) {
  const parrafos = [];
  const { proveedor = {} } = datos;
  const partesProveedor = [
    proveedor.nombre,
    proveedor.direccion,
    proveedor.telefono && `Tel: ${proveedor.telefono}`,
  ]
    .filter(Boolean)
    .join(' · ');
  if (partesProveedor) parrafos.push([{ texto: 'Proveedor:', negrita: true }, { texto: partesProveedor }]);
  if (datos.telefonoEmergencia) {
    parrafos.push([{ texto: 'Teléfono de emergencia:', negrita: true }, { texto: datos.telefonoEmergencia }]);
  }
  const extras = [
    datos.lote && ['Lote:', datos.lote],
    datos.fechaFabricacion && ['F. fab.:', formatearFecha(datos.fechaFabricacion)],
    datos.fechaVencimiento && ['F. venc.:', formatearFecha(datos.fechaVencimiento)],
    datos.contenido && ['Contenido:', datos.contenido],
  ].filter(Boolean);
  if (extras.length) {
    parrafos.push(
      extras.flatMap(([etiqueta, valor], i) => [
        { texto: (i ? '  ' : '') + etiqueta, negrita: true },
        { texto: valor },
      ]),
    );
  }
  return parrafos;
}

/**
 * Diseña la etiqueta.
 * @param {object} datos  Datos de la etiqueta (ver README).
 * @param {{anchoMm:number, altoMm:number, pictogramaMm:number}} formato
 * @param {Medidor} medidor
 * @param {{borde?: boolean}} [opciones]
 */
export function disenarEtiqueta(datos, formato, medidor, opciones = {}) {
  const { anchoMm, altoMm, pictogramaMm } = formato;
  const e = escalasTipograficas(anchoMm, altoMm);
  const x0 = e.margen;
  const ancho = anchoMm - 2 * e.margen;
  const elementos = [];
  const avisos = [];

  if (opciones.borde !== false) {
    elementos.push({ tipo: 'rect', x: 0.5, y: 0.5, ancho: anchoMm - 1, alto: altoMm - 1, grosor: 0.3 });
  }

  const esPeligroso = datos.frasesH.length > 0 || datos.pictogramas.length > 0;
  let y = e.margen;

  // 1. Nombre del producto: hasta 3 líneas, reduciendo la fuente si hace falta.
  const nombre = (datos.nombreProducto || 'SIN NOMBRE').toUpperCase();
  let ptNombre = e.nombreMax;
  let lineasNombre = envolverTexto([{ texto: nombre, negrita: true }], ancho, ptNombre, medidor);
  while (lineasNombre.length > 2 && ptNombre > e.nombreMin) {
    ptNombre = Math.max(e.nombreMin, ptNombre - 0.5);
    lineasNombre = envolverTexto([{ texto: nombre, negrita: true }], ancho, ptNombre, medidor);
  }
  elementos.push(...lineasAElementos(lineasNombre, x0, ancho, y, ptNombre, 'centro'));
  y += lineasNombre.length * altoLinea(ptNombre) + e.separacion;

  // 2. Pictogramas con el tamaño mínimo de la norma.
  const picto = ubicarPictogramas(datos.pictogramas, x0, ancho, y, pictogramaMm);
  elementos.push(...picto.elementos);
  if (picto.alto) y += picto.alto + e.separacion * 0.6;

  // 3. Palabra de advertencia o leyenda de producto no peligroso.
  const leyenda = esPeligroso
    ? (datos.palabraAdvertencia || '').toUpperCase()
    : 'PRODUCTO NO CLASIFICADO COMO PELIGROSO';
  if (leyenda) {
    const pt = esPeligroso ? e.palabra : e.palabra * 0.75;
    const lineas = envolverTexto([{ texto: leyenda, negrita: true }], ancho, pt, medidor);
    elementos.push(...lineasAElementos(lineas, x0, ancho, y, pt, 'centro'));
    y += lineas.length * altoLinea(pt) + e.separacion * 0.6;
  }

  // 5. Pie (se calcula antes para saber cuánto espacio queda al cuerpo).
  const lineasPie = parrafosPie(datos).flatMap((p) => envolverTexto(p, ancho, e.pie, medidor));
  const altoPie = lineasPie.length * altoLinea(e.pie);
  const yPie = altoMm - e.margen - altoPie;
  if (lineasPie.length) {
    elementos.push({
      tipo: 'linea',
      x1: x0,
      y1: yPie - e.separacion * 0.6,
      x2: x0 + ancho,
      y2: yPie - e.separacion * 0.6,
      grosor: 0.2,
    });
    elementos.push(...lineasAElementos(lineasPie, x0, ancho, yPie, e.pie));
  }

  // 4. Cuerpo: se busca la fuente más grande que quepa.
  const limiteCuerpo = (lineasPie.length ? yPie - e.separacion * 1.2 : altoMm - e.margen) - y;
  const parrafos = parrafosCuerpo(datos, esPeligroso);
  let ptCuerpo = e.cuerpoMax;
  let cuerpo = maquetarCuerpo(parrafos, x0, ancho, y, ptCuerpo, medidor, e.separacion);
  while (cuerpo.alto > limiteCuerpo && ptCuerpo > e.cuerpoMin) {
    ptCuerpo = Math.max(e.cuerpoMin, ptCuerpo - 0.25);
    cuerpo = maquetarCuerpo(parrafos, x0, ancho, y, ptCuerpo, medidor, e.separacion);
  }

  const desborde = cuerpo.alto > limiteCuerpo + 0.01;
  if (desborde) {
    const limiteY = y + limiteCuerpo;
    const visibles = cuerpo.elementos.filter((el) => el.y <= limiteY);
    const omitidas = cuerpo.elementos.length - visibles.length;
    elementos.push(...visibles);
    avisos.push({
      nivel: 'error',
      mensaje: `El texto no cabe en esta etiqueta (${omitidas} línea(s) quedaron por fuera). Use un tamaño mayor, orientación distinta o resuma las frases P.`,
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

  return { elementos, avisos, tamanoCuerpoPt: ptCuerpo, desborde };
}
