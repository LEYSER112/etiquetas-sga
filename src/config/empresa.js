/**
 * Línea de emergencias químicas que se imprime en todas las etiquetas.
 * CISPROQUIM es el centro de información de emergencias del Consejo Colombiano
 * de Seguridad. Si cambian los números, se actualizan solo aquí.
 */
export const CISPROQUIM = Object.freeze({
  titulo: 'EMERGENCIAS · CISPROQUIM',
  lineas: Object.freeze([
    Object.freeze({ etiqueta: 'Línea gratuita nacional', numero: '018000-916012' }),
    Object.freeze({ etiqueta: 'Bogotá', numero: '(601) 2886012' }),
  ]),
});

/** Hojas para imprimir el lote de etiquetas (vertical; el acomodo gira las etiquetas si conviene). */
export const HOJAS = Object.freeze({
  carta: Object.freeze({ nombre: 'Carta', detalle: '216 x 279 mm', anchoMm: 215.9, altoMm: 279.4 }),
  oficio: Object.freeze({ nombre: 'Oficio', detalle: '216 x 330 mm', anchoMm: 215.9, altoMm: 330.2 }),
  a4: Object.freeze({ nombre: 'A4', detalle: '210 x 297 mm', anchoMm: 210, altoMm: 297 }),
  legal: Object.freeze({ nombre: 'Legal', detalle: '216 x 356 mm', anchoMm: 215.9, altoMm: 355.6 }),
  mediaCarta: Object.freeze({
    nombre: 'Media carta',
    detalle: '140 x 216 mm',
    anchoMm: 139.7,
    altoMm: 215.9,
  }),
  a3: Object.freeze({ nombre: 'A3', detalle: '297 x 420 mm', anchoMm: 297, altoMm: 420 }),
});

/**
 * Medidas de impresión del lote (mm).
 * - margenHojaMm: zona que la mayoría de impresoras no imprime (~4 mm) más el
 *   espacio para las marcas de corte de las etiquetas del borde.
 * - separacionMm: espacio entre etiquetas; las marcas de corte de dos etiquetas
 *   vecinas llegan hasta la mitad, sin montarse.
 * - marcaCorte: distancia de la marca a la etiqueta y largo de la marca.
 */
export const IMPRESION = Object.freeze({
  margenHojaMm: 7,
  separacionMm: 6,
  marcaCorte: Object.freeze({ distanciaMm: 1, largoMm: 2 }),
  dpiPictogramas: 600,
});
