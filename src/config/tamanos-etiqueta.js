/**
 * Tamaños de etiqueta según la Resolución 773 de 2021 (SGA - Colombia).
 *
 * Fuente: hoja "Normativa_Dimensiones" del generador en Google Sheets.
 *
 * - `pictogramaNormaMm`: lado mínimo del pictograma que indica la tabla.
 * - `pictogramaMm`: tamaño que usa el generador. Se toma el mayor entre la
 *   tabla y la regla "cada pictograma cubre al menos 1/15 de la superficie
 *   de la etiqueta". Para A8 esa regla da 16 mm (la tabla dice 10 mm).
 */
export const TAMANOS_ETIQUETA = Object.freeze([
  {
    id: 'A8',
    nombre: 'Hasta 3 L',
    capacidadMaxL: 3,
    anchoMm: 52,
    altoMm: 74,
    pictogramaNormaMm: 10,
    pictogramaMm: 16,
    aplicacion: 'Frascos, botellas, reactivos y recipientes menores',
  },
  {
    id: 'A7',
    nombre: 'Más de 3 L hasta 50 L',
    capacidadMaxL: 50,
    anchoMm: 74,
    altoMm: 105,
    pictogramaNormaMm: 23,
    pictogramaMm: 23,
    aplicacion: 'Galones, garrafas, bidones y cuñetes',
  },
  {
    id: 'A6',
    nombre: 'Más de 50 L hasta 500 L',
    capacidadMaxL: 500,
    anchoMm: 105,
    altoMm: 148,
    pictogramaNormaMm: 32,
    pictogramaMm: 32,
    aplicacion: 'Tambores y canecas industriales (55 gal / 208 L)',
  },
  {
    id: 'A5',
    nombre: 'Más de 500 L',
    capacidadMaxL: Infinity,
    anchoMm: 148,
    altoMm: 210,
    pictogramaNormaMm: 46,
    pictogramaMm: 46,
    aplicacion: 'Contenedores IBC (1000 L) y tanques',
  },
]);

/** Fracción mínima de la superficie de la etiqueta que debe cubrir cada pictograma. */
export const FRACCION_MIN_PICTOGRAMA = 1 / 15;

/**
 * Devuelve el tamaño mínimo exigido para una capacidad de envase.
 * @param {number} litros
 */
export function tamanoPorCapacidad(litros) {
  if (!Number.isFinite(litros) || litros <= 0) return null;
  return TAMANOS_ETIQUETA.find((t) => litros <= t.capacidadMaxL) ?? null;
}

/** @param {string} id */
export function obtenerTamano(id) {
  return TAMANOS_ETIQUETA.find((t) => t.id === id) ?? null;
}

/** Índice del tamaño (sirve para comparar cuál es mayor). */
export function indiceTamano(id) {
  return TAMANOS_ETIQUETA.findIndex((t) => t.id === id);
}

/**
 * Dimensiones finales según la orientación.
 * @param {{anchoMm:number, altoMm:number}} tamano
 * @param {'vertical'|'horizontal'} orientacion
 */
export function dimensionesOrientadas(tamano, orientacion) {
  const corto = Math.min(tamano.anchoMm, tamano.altoMm);
  const largo = Math.max(tamano.anchoMm, tamano.altoMm);
  return orientacion === 'horizontal' ? { anchoMm: largo, altoMm: corto } : { anchoMm: corto, altoMm: largo };
}
