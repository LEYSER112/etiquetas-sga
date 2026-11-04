/**
 * Guarda el grupo de impresión en el navegador (localStorage), para no perderlo
 * si se recarga la página. Solo se guardan los datos de cada etiqueta (pocos KB);
 * los PDF se vuelven a generar al imprimir.
 *
 * Si el navegador no permite guardar (modo privado, almacenamiento bloqueado),
 * el grupo funciona igual pero se pierde al cerrar la página.
 */
const CLAVE = 'etiquetas-sga:grupo:v1';

/** @returns {{items: object[], hoja: string}} */
export function cargarGrupo() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (guardado && Array.isArray(guardado.items)) {
      return { items: guardado.items, hoja: guardado.hoja || 'carta' };
    }
  } catch {
    // Sin almacenamiento disponible o datos dañados: se empieza vacío.
  }
  return { items: [], hoja: 'carta' };
}

/** @returns {boolean} true si se pudo guardar. */
export function guardarGrupo(grupo) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(grupo));
    return true;
  } catch {
    return false;
  }
}
