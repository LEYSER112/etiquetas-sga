/**
 * Acomodo de etiquetas de distintos tamaños en hojas de impresión.
 *
 * Se prueban dos métodos y se usa el que gaste menos hojas (si empatan, el de
 * filas, porque queda más ordenado para cortar):
 *
 * A) Por filas ("estanterías"), primero los más grandes:
 *  1. Cada etiqueta se intenta poner en una fila ya abierta (de cualquier hoja)
 *     donde quepa a lo ancho sin superar el alto de la fila, derecha o girada 90°.
 *  2. Si no, se abre una fila nueva debajo, en la primera hoja con espacio,
 *     usando la orientación más baja que quepa a lo ancho.
 *  3. Si no, se abre una hoja nueva.
 *
 * B) MaxRects: se lleva la lista de rectángulos libres de cada hoja y cada
 *    etiqueta va donde le sobre menos espacio por el lado corto. Aprovecha mejor
 *    la hoja cuando conviene mezclar etiquetas derechas y giradas.
 *
 * Entre etiquetas se deja `separacion` (ahí van las marcas de corte) y alrededor
 * de la hoja `margen` (zona que la impresora no imprime + marcas de corte).
 * Al final se centra horizontalmente el bloque de cada hoja.
 */

const EPS = 1e-6;

/**
 * @typedef {{anchoMm:number, altoMm:number}} Pieza  Cualquier objeto con medidas.
 * @typedef {{pieza: Pieza, x:number, y:number, ancho:number, alto:number, girada:boolean}} Ubicacion
 *   (x, y) es la esquina superior izquierda en mm; ancho y alto ya tienen en cuenta el giro.
 */

/**
 * @param {Pieza[]} piezas
 * @param {{anchoMm:number, altoMm:number}} hoja
 * @param {{margen:number, separacion:number, permitirGiro?: boolean}} opciones
 * @returns {Ubicacion[][]} Una lista de ubicaciones por hoja.
 */
export function acomodarEnHojas(piezas, hoja, opciones) {
  if (!piezas.length) return [];
  const porFilas = acomodarPorFilas(piezas, hoja, opciones);
  const porEspacios = acomodarMaxRects(piezas, hoja, opciones);
  return porEspacios.length < porFilas.length ? porEspacios : porFilas;
}

/** Área útil de la hoja y validación de que cada pieza quepa en alguna orientación. */
function prepararArea(piezas, hoja, margen, permitirGiro) {
  const area = {
    izquierda: margen,
    derecha: hoja.anchoMm - margen,
    arriba: margen,
    abajo: hoja.altoMm - margen,
  };
  const anchoArea = area.derecha - area.izquierda;
  const altoArea = area.abajo - area.arriba;
  const orientaciones = (p) => {
    const lista = [{ ancho: p.anchoMm, alto: p.altoMm, girada: false }];
    if (permitirGiro && p.anchoMm !== p.altoMm)
      lista.push({ ancho: p.altoMm, alto: p.anchoMm, girada: true });
    return lista;
  };
  for (const p of piezas) {
    if (!orientaciones(p).some((o) => o.ancho <= anchoArea + EPS && o.alto <= altoArea + EPS)) {
      throw new Error(
        `Una etiqueta de ${p.anchoMm} x ${p.altoMm} mm no cabe en la hoja de ${hoja.anchoMm} x ${hoja.altoMm} mm.`,
      );
    }
  }
  return { area, anchoArea, altoArea, orientaciones };
}

/** Más grandes primero; el orden es estable, así las copias quedan juntas. */
function ordenarPorTamano(piezas) {
  const mayor = (p) => Math.max(p.anchoMm, p.altoMm);
  const menor = (p) => Math.min(p.anchoMm, p.altoMm);
  return piezas
    .map((pieza, indice) => ({ pieza, indice }))
    .sort((a, b) => mayor(b.pieza) - mayor(a.pieza) || menor(b.pieza) - menor(a.pieza) || a.indice - b.indice)
    .map((o) => o.pieza);
}

/** Centra horizontalmente el contenido de cada hoja. */
function centrar(hojas, area) {
  return hojas.map((ubicaciones) => {
    const izquierda = Math.min(...ubicaciones.map((u) => u.x));
    const derecha = Math.max(...ubicaciones.map((u) => u.x + u.ancho));
    const desplazamiento = (area.izquierda + area.derecha) / 2 - (izquierda + derecha) / 2;
    return ubicaciones.map((u) => ({ ...u, x: u.x + desplazamiento }));
  });
}

/** Método A: por filas. */
function acomodarPorFilas(piezas, hoja, { margen, separacion, permitirGiro = true }) {
  const { area, anchoArea, orientaciones } = prepararArea(piezas, hoja, margen, permitirGiro);
  const ordenadas = ordenarPorTamano(piezas);

  /** @type {{filas: {y:number, alto:number, xLibre:number}[], yLibre:number, ubicaciones: Ubicacion[]}[]} */
  const hojas = [];
  const nuevaHoja = () => {
    const h = { filas: [], yLibre: area.arriba, ubicaciones: [] };
    hojas.push(h);
    return h;
  };

  const poner = (h, fila, o, pieza) => {
    h.ubicaciones.push({ pieza, x: fila.xLibre, y: fila.y, ancho: o.ancho, alto: o.alto, girada: o.girada });
    fila.xLibre += o.ancho + separacion;
  };

  /** Orientación para abrir una fila: la más baja que quepa a lo ancho y en el alto restante. */
  const orientacionNuevaFila = (h, pieza) =>
    orientaciones(pieza)
      .filter((o) => o.ancho <= anchoArea + EPS && h.yLibre + o.alto <= area.abajo + EPS)
      .sort((a, b) => a.alto - b.alto || Number(a.girada) - Number(b.girada))[0];

  for (const pieza of ordenadas) {
    let ubicada = false;

    // 1. En una fila existente
    buscar: for (const h of hojas) {
      for (const fila of h.filas) {
        for (const o of orientaciones(pieza)) {
          if (o.alto <= fila.alto + EPS && fila.xLibre + o.ancho <= area.derecha + EPS) {
            poner(h, fila, o, pieza);
            ubicada = true;
            break buscar;
          }
        }
      }
    }
    if (ubicada) continue;

    // 2. En una fila nueva de una hoja existente, o 3. en una hoja nueva
    let destino = hojas.find((h) => orientacionNuevaFila(h, pieza));
    destino ??= nuevaHoja();
    const o = orientacionNuevaFila(destino, pieza);
    const fila = { y: destino.yLibre, alto: o.alto, xLibre: area.izquierda };
    destino.filas.push(fila);
    destino.yLibre += o.alto + separacion;
    poner(destino, fila, o, pieza);
  }

  return centrar(
    hojas.map((h) => h.ubicaciones),
    area,
  );
}

/**
 * Método B: MaxRects con la regla "mejor lado corto".
 * La separación se maneja agrandando cada pieza y el área en `separacion`:
 * así dos piezas vecinas quedan siempre a esa distancia.
 */
function acomodarMaxRects(piezas, hoja, { margen, separacion, permitirGiro = true }) {
  const { area, orientaciones } = prepararArea(piezas, hoja, margen, permitirGiro);
  const ordenadas = ordenarPorTamano(piezas);
  const contenedor = () => [
    {
      x: area.izquierda,
      y: area.arriba,
      ancho: area.derecha - area.izquierda + separacion,
      alto: area.abajo - area.arriba + separacion,
    },
  ];
  /** @type {{libres: object[], ubicaciones: Ubicacion[]}[]} */
  const hojas = [];

  const mejorLugar = (libres, pieza) => {
    let mejor = null;
    for (const o of orientaciones(pieza)) {
      const w = o.ancho + separacion;
      const h = o.alto + separacion;
      for (const r of libres) {
        if (w > r.ancho + EPS || h > r.alto + EPS) continue;
        const corto = Math.min(r.ancho - w, r.alto - h);
        const largo = Math.max(r.ancho - w, r.alto - h);
        const candidato = { x: r.x, y: r.y, o, w, h, corto, largo };
        if (
          !mejor ||
          corto < mejor.corto - EPS ||
          (Math.abs(corto - mejor.corto) <= EPS &&
            (largo < mejor.largo - EPS ||
              (Math.abs(largo - mejor.largo) <= EPS &&
                (r.y < mejor.y - EPS || (Math.abs(r.y - mejor.y) <= EPS && r.x < mejor.x)))))
        ) {
          mejor = candidato;
        }
      }
    }
    return mejor;
  };

  for (const pieza of ordenadas) {
    let destino = null;
    let lugar = null;
    for (const h of hojas) {
      lugar = mejorLugar(h.libres, pieza);
      if (lugar) {
        destino = h;
        break;
      }
    }
    if (!destino) {
      destino = { libres: contenedor(), ubicaciones: [] };
      hojas.push(destino);
      lugar = mejorLugar(destino.libres, pieza);
    }
    destino.ubicaciones.push({
      pieza,
      x: lugar.x,
      y: lugar.y,
      ancho: lugar.o.ancho,
      alto: lugar.o.alto,
      girada: lugar.o.girada,
    });
    destino.libres = dividirLibres(destino.libres, { x: lugar.x, y: lugar.y, ancho: lugar.w, alto: lugar.h });
  }

  return centrar(
    hojas.map((h) => h.ubicaciones),
    area,
  );
}

/** Quita el rectángulo ocupado de los libres y descarta los que quedan contenidos en otros. */
function dividirLibres(libres, ocupado) {
  const resultado = [];
  for (const r of libres) {
    const seCruzan =
      ocupado.x < r.x + r.ancho - EPS &&
      ocupado.x + ocupado.ancho > r.x + EPS &&
      ocupado.y < r.y + r.alto - EPS &&
      ocupado.y + ocupado.alto > r.y + EPS;
    if (!seCruzan) {
      resultado.push(r);
      continue;
    }
    if (ocupado.x > r.x + EPS) resultado.push({ x: r.x, y: r.y, ancho: ocupado.x - r.x, alto: r.alto });
    if (ocupado.x + ocupado.ancho < r.x + r.ancho - EPS) {
      const x = ocupado.x + ocupado.ancho;
      resultado.push({ x, y: r.y, ancho: r.x + r.ancho - x, alto: r.alto });
    }
    if (ocupado.y > r.y + EPS) resultado.push({ x: r.x, y: r.y, ancho: r.ancho, alto: ocupado.y - r.y });
    if (ocupado.y + ocupado.alto < r.y + r.alto - EPS) {
      const y = ocupado.y + ocupado.alto;
      resultado.push({ x: r.x, y, ancho: r.ancho, alto: r.y + r.alto - y });
    }
  }
  const contiene = (a, b) =>
    a.x <= b.x + EPS &&
    a.y <= b.y + EPS &&
    a.x + a.ancho >= b.x + b.ancho - EPS &&
    a.y + a.alto >= b.y + b.alto - EPS;
  return resultado.filter(
    (r, i) => !resultado.some((o, j) => j !== i && contiene(o, r) && (!contiene(r, o) || j < i)),
  );
}
