/**
 * Valores por defecto de la empresa.
 * Se usan cuando la FDS no trae el dato.
 */
export const EMPRESA = Object.freeze({
  /**
   * Teléfono de emergencia que se imprime cuando la FDS no trae el de CISPROQUIM.
   * CISPROQUIM es la línea de emergencias químicas del Consejo Colombiano de Seguridad;
   * verifique de vez en cuando que los números sigan vigentes.
   */
  telefonoEmergencia: 'CISPROQUIM 01 8000 916012 - (601) 288 6012',
});

/** Formatos de hoja disponibles para imprimir varias etiquetas. */
export const HOJAS = Object.freeze({
  carta: { nombre: 'Carta', anchoMm: 215.9, altoMm: 279.4 },
  a4: { nombre: 'A4', anchoMm: 210, altoMm: 297 },
  oficio: { nombre: 'Oficio', anchoMm: 215.9, altoMm: 330.2 },
});

/** Margen de la hoja y separación entre etiquetas al imprimir varias (mm). */
export const IMPRESION = Object.freeze({
  margenHojaMm: 6,
  separacionMm: 4,
  dpiPictogramas: 600,
});
