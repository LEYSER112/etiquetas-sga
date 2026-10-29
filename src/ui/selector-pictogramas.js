/**
 * Cuadrícula de los 9 pictogramas para activarlos o desactivarlos.
 */
import { PICTOGRAMAS } from '../data/pictogramas.js';

/**
 * @param {HTMLElement} contenedor
 * @param {() => void} alCambiar
 */
export function crearSelectorPictogramas(contenedor, alCambiar) {
  contenedor.replaceChildren(
    ...PICTOGRAMAS.map((p) => {
      const etiqueta = document.createElement('label');
      etiqueta.className = 'picto';
      etiqueta.title = `${p.codigo} · ${p.nombre}`;

      const casilla = document.createElement('input');
      casilla.type = 'checkbox';
      casilla.value = p.codigo;
      casilla.addEventListener('change', alCambiar);

      const imagen = document.createElement('img');
      imagen.src = p.archivo;
      imagen.alt = '';
      imagen.width = 46;
      imagen.height = 46;

      const nombre = document.createElement('span');
      nombre.textContent = p.nombre;
      const codigo = document.createElement('span');
      codigo.className = 'picto__codigo';
      codigo.textContent = p.codigo;

      etiqueta.append(casilla, imagen, nombre, codigo);
      return etiqueta;
    }),
  );

  const casillas = () => [...contenedor.querySelectorAll('input[type="checkbox"]')];

  return {
    /** @returns {string[]} */
    obtener: () =>
      casillas()
        .filter((c) => c.checked)
        .map((c) => c.value),
    /** @param {string[]} codigos */
    establecer(codigos) {
      casillas().forEach((c) => {
        c.checked = codigos.includes(c.value);
      });
    },
  };
}
