/**
 * Valores por defecto de la empresa.
 * Ajuste estos datos una sola vez; se usan cuando la FDS no los trae.
 */
export const EMPRESA = Object.freeze({
  nombre: 'Vimach',
  direccion: '',
  telefono: '',
  /**
   * Teléfono de emergencia que se imprime si la FDS no trae uno.
   * Verifique el número vigente de su línea de atención (p. ej. CISPROQUIM)
   * antes de ponerlo en producción.
   */
  telefonoEmergencia: '',
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
