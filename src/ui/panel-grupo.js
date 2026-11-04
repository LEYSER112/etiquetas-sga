/**
 * Panel "Grupo de impresión": etiquetas guardadas para imprimir juntas, las
 * copias de cada una y la hoja en la que se van a imprimir.
 */
import { HOJAS } from '../config/empresa.js';
import { cargarGrupo, guardarGrupo } from '../services/almacen-grupo.js';

/**
 * @param {{lista: HTMLElement, vacio: HTMLElement, resumen: HTMLElement, hoja: HTMLSelectElement,
 *          contador: HTMLElement}} nodos
 * @param {() => void} alCambiar  Se llama cada vez que cambia el lote o la hoja.
 */
export function crearPanelGrupo(nodos, alCambiar) {
  let { items, hoja } = cargarGrupo();
  let persistente = true;

  nodos.hoja.replaceChildren(
    ...Object.entries(HOJAS).map(([id, h]) => new Option(`${h.nombre} (${h.detalle})`, id)),
  );
  nodos.hoja.value = HOJAS[hoja] ? hoja : 'carta';
  nodos.hoja.addEventListener('change', () => {
    hoja = nodos.hoja.value;
    cambio();
  });

  function cambio() {
    persistente = guardarGrupo({ items, hoja });
    pintar();
    alCambiar();
  }

  function pintar() {
    const total = items.reduce((suma, it) => suma + it.copias, 0);
    nodos.vacio.hidden = items.length > 0;
    nodos.contador.textContent = items.length ? String(total) : '';
    nodos.contador.hidden = items.length === 0;
    nodos.lista.replaceChildren(...items.map(filaItem));
    if (!persistente && items.length) {
      nodos.resumen.textContent =
        'Este navegador no permite guardar el grupo: se perderá al cerrar la página.';
    }
  }

  function filaItem(item) {
    const fila = document.createElement('li');
    fila.className = 'grupo__item';

    const texto = document.createElement('div');
    texto.className = 'grupo__texto';
    const nombre = document.createElement('strong');
    nombre.textContent = item.nombre || 'Sin nombre';
    const detalle = document.createElement('span');
    detalle.textContent = [
      item.codigoInterno,
      `${item.formato.anchoMm} x ${item.formato.altoMm} mm (${item.formato.id})`,
    ]
      .filter(Boolean)
      .join(' · ');
    texto.append(nombre, detalle);

    const copias = document.createElement('input');
    copias.type = 'number';
    copias.min = '1';
    copias.max = '500';
    copias.value = String(item.copias);
    copias.className = 'grupo__copias';
    copias.setAttribute('aria-label', `Copias de ${item.nombre}`);
    copias.addEventListener('change', () => {
      item.copias = Math.max(1, Math.min(500, Number.parseInt(copias.value, 10) || 1));
      cambio();
    });

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'enlace grupo__quitar';
    quitar.textContent = 'Quitar';
    quitar.setAttribute('aria-label', `Quitar ${item.nombre} del grupo`);
    quitar.addEventListener('click', () => {
      items = items.filter((it) => it.id !== item.id);
      cambio();
    });

    const etiquetaCopias = document.createElement('label');
    etiquetaCopias.className = 'grupo__copias-etiqueta';
    etiquetaCopias.append('Copias', copias);

    fila.append(texto, etiquetaCopias, quitar);
    return fila;
  }

  pintar();

  return {
    /** Agrega una etiqueta ya revisada. */
    agregar({ datos, formato, borde, cuadroLote, copias }) {
      items.push({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        nombre: datos.nombreProducto,
        codigoInterno: datos.codigoInterno,
        datos,
        formato,
        borde,
        cuadroLote,
        copias: Math.max(1, Math.min(500, Math.floor(copias) || 1)),
      });
      cambio();
    },
    vaciar() {
      items = [];
      cambio();
    },
    obtener: () => ({ items: items.map((it) => ({ ...it })), hoja }),
    mostrarResumen(texto) {
      nodos.resumen.textContent = texto;
    },
  };
}
