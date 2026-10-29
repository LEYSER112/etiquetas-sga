/**
 * Elección automática del tamaño de la etiqueta.
 *
 * Se prueban los tamaños de menor a mayor, empezando por el mínimo que exige
 * la norma para la capacidad del envase. En cada tamaño se prueba primero la
 * orientación horizontal y luego la vertical. Gana el primero en el que todo
 * el texto cabe con una letra legible.
 */
import { TAMANOS_ETIQUETA, tamanoPorCapacidad, dimensionesOrientadas } from '../config/tamanos-etiqueta.js';
import { disenarEtiqueta } from './diseno-etiqueta.js';

/** Tamaño de letra mínimo (pt) que se considera legible para el cuerpo. */
export const CUERPO_LEGIBLE_PT = 5;

/**
 * Lista ordenada de formatos candidatos.
 * @param {{capacidadL: number|null, tamano?: string, orientacion?: string}} preferencias
 *   `tamano`: 'auto' o un id (A8…A5). `orientacion`: 'auto', 'horizontal' o 'vertical'.
 */
export function formatosCandidatos({ capacidadL, tamano = 'auto', orientacion = 'auto' }) {
  let tamanos;
  if (tamano && tamano !== 'auto') {
    tamanos = TAMANOS_ETIQUETA.filter((t) => t.id === tamano);
  } else {
    const minimo = tamanoPorCapacidad(capacidadL) ?? TAMANOS_ETIQUETA[0];
    tamanos = TAMANOS_ETIQUETA.slice(TAMANOS_ETIQUETA.indexOf(minimo));
  }
  const orientaciones =
    orientacion === 'vertical' || orientacion === 'horizontal' ? [orientacion] : ['horizontal', 'vertical'];

  return tamanos.flatMap((t) =>
    orientaciones.map((o) => ({
      id: t.id,
      orientacion: o,
      ...dimensionesOrientadas(t, o),
      pictogramaMm: t.pictogramaMm,
    })),
  );
}

/**
 * Devuelve el primer formato donde todo cabe con letra legible; si ninguno
 * lo logra, el primero donde al menos cabe; y si nada cabe, el último (el mayor).
 * @returns {{formato: object, diseno: ReturnType<typeof disenarEtiqueta>}}
 */
export function elegirFormato(datos, candidatos, medidor, opciones = {}) {
  if (!candidatos.length) throw new Error('No hay tamaños de etiqueta para elegir.');
  let primeroQueCabe = null;
  let ultimo = null;
  for (const formato of candidatos) {
    const diseno = disenarEtiqueta(datos, formato, medidor, opciones);
    ultimo = { formato, diseno };
    if (diseno.desborde) continue;
    if (diseno.tamanoCuerpoPt >= CUERPO_LEGIBLE_PT) return ultimo;
    primeroQueCabe ??= ultimo;
  }
  return primeroQueCabe ?? ultimo;
}
