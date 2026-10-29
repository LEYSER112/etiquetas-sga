/**
 * Lista de avisos (errores, advertencias e información) junto a la vista previa.
 */
const ORDEN = { error: 0, advertencia: 1, info: 2 };

/**
 * @param {HTMLUListElement} lista
 * @param {{nivel:string, mensaje:string}[]} avisos
 */
export function mostrarAvisos(lista, avisos) {
  const unicos = [...new Map(avisos.map((a) => [a.mensaje, a])).values()].sort(
    (a, b) => ORDEN[a.nivel] - ORDEN[b.nivel],
  );
  lista.replaceChildren(
    ...unicos.map((a) => {
      const item = document.createElement('li');
      item.dataset.nivel = a.nivel;
      item.textContent = a.mensaje;
      return item;
    }),
  );
}
