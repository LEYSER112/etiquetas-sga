/**
 * Revisión de los datos de la etiqueta frente a la Res. 773 de 2021 / SGA.
 * Devuelve avisos; no bloquea la generación para que el usuario decida.
 */
import { pictogramasDesdeH, palabraDesdeH } from './reglas-sga.js';
import { pictogramaPorCodigo } from '../data/pictogramas.js';
import { tamanoPorCapacidad, indiceTamano } from '../config/tamanos-etiqueta.js';

const nombrePicto = (codigo) => `${codigo} (${pictogramaPorCodigo(codigo)?.nombre ?? '?'})`;

/**
 * @param {object} datos
 * @returns {{nivel:'error'|'advertencia'|'info', mensaje:string}[]}
 */
export function validarEtiqueta(datos) {
  const avisos = [];
  const codigosH = datos.frasesH.map((f) => f.codigo).filter(Boolean);
  const esperados = pictogramasDesdeH(codigosH);

  if (!datos.nombreProducto?.trim()) {
    avisos.push({ nivel: 'error', mensaje: 'Falta el nombre del producto.' });
  }

  const faltantes = esperados.filter((p) => !datos.pictogramas.includes(p));
  if (faltantes.length) {
    avisos.push({
      nivel: 'error',
      mensaje: `Según las frases H faltan pictogramas: ${faltantes.map(nombrePicto).join(', ')}.`,
    });
  }

  const sobrantes = datos.pictogramas.filter((p) => !esperados.includes(p));
  if (sobrantes.length && codigosH.length) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: `Ninguna frase H justifica: ${sobrantes.map(nombrePicto).join(', ')}. Verifique con la FDS.`,
    });
  }

  if (datos.pictogramas.includes('GHS06') && datos.pictogramas.includes('GHS07')) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: 'Con la calavera (GHS06) no debe usarse el signo de exclamación (GHS07).',
    });
  }

  const palabraEsperada = palabraDesdeH(codigosH);
  if (codigosH.length && !datos.palabraAdvertencia) {
    avisos.push({ nivel: 'error', mensaje: 'Falta la palabra de advertencia (Peligro / Atención).' });
  } else if (palabraEsperada === 'Peligro' && datos.palabraAdvertencia === 'Atención') {
    avisos.push({
      nivel: 'advertencia',
      mensaje: 'Hay frases H que normalmente llevan "Peligro" y se eligió "Atención".',
    });
  }

  const sinTexto = [...datos.frasesH, ...datos.frasesP].filter((f) => f.codigo && !f.texto);
  if (sinTexto.length) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: `Códigos sin texto: ${sinTexto.map((f) => f.codigo).join(', ')}. Escriba la frase completa.`,
    });
  }

  if (codigosH.length && datos.frasesP.length === 0) {
    avisos.push({ nivel: 'advertencia', mensaje: 'No hay consejos de prudencia (frases P).' });
  }

  if (!datos.proveedor?.nombre) {
    avisos.push({ nivel: 'advertencia', mensaje: 'Falta la identificación del proveedor.' });
  }
  if (!datos.telefonoEmergencia) {
    avisos.push({ nivel: 'advertencia', mensaje: 'Falta el teléfono de emergencia.' });
  }

  const minimo = tamanoPorCapacidad(datos.capacidadL);
  if (minimo && indiceTamano(datos.tamanoId) < indiceTamano(minimo.id)) {
    avisos.push({
      nivel: 'error',
      mensaje: `Para ${datos.capacidadL} L la norma exige mínimo ${minimo.anchoMm} x ${minimo.altoMm} mm (${minimo.id}).`,
    });
  }

  return avisos;
}
