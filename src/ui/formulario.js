/**
 * Lectura y escritura del formulario <-> objeto de datos de la etiqueta.
 */
import { textoAFrases, frasesATexto } from '../core/frases.js';

const valor = (form, nombre) => (form.elements.namedItem(nombre)?.value ?? '').trim();

/**
 * @param {HTMLFormElement} form
 * @param {string[]} pictogramas  Seleccionados en el selector.
 */
export function leerFormulario(form, pictogramas) {
  const capacidad = Number.parseFloat(valor(form, 'capacidad').replace(',', '.'));
  return {
    codigoInterno: valor(form, 'codigoInterno'),
    nombreProducto: valor(form, 'nombre'),
    palabraAdvertencia: valor(form, 'palabra'),
    capacidadL: Number.isFinite(capacidad) ? capacidad : null,
    contenido: Number.isFinite(capacidad) ? `${String(capacidad).replace('.', ',')} L` : '',
    pictogramas,
    frasesH: textoAFrases(valor(form, 'frasesH'), 'H'),
    frasesP: textoAFrases(valor(form, 'frasesP'), 'P'),
    codigoTipo: valor(form, 'codigoTipo') === 'qr' ? 'qr' : 'ean13',
    ean13Texto: valor(form, 'ean13'),
    qrTexto: valor(form, 'qrTexto'),
    fechaFabricacion: valor(form, 'fechaFabricacion'),
    fechaVencimiento: valor(form, 'fechaVencimiento'),
    tamano: valor(form, 'tamano') || 'auto',
    orientacion: valor(form, 'orientacion') || 'auto',
    copias: Number.parseInt(valor(form, 'copias'), 10) || 1,
    borde: form.elements.namedItem('borde')?.checked ?? true,
    cuadroLote: form.elements.namedItem('cuadroLote')?.checked ?? true,
  };
}

/**
 * Llena el formulario con el resultado del análisis de la FDS.
 * @param {HTMLFormElement} form
 * @param {ReturnType<import('../core/analizador-fds.js').analizarFds>} r
 */
export function escribirAnalisis(form, r) {
  const poner = (nombre, texto) => {
    const campo = form.elements.namedItem(nombre);
    if (campo) campo.value = texto ?? '';
  };
  poner('nombre', r.nombreProducto);
  poner('palabra', r.palabraAdvertencia);
  poner('frasesH', frasesATexto(r.frasesH));
  poner('frasesP', frasesATexto(r.frasesP));
  // El código interno, el EAN y el texto del QR son de cada producto: se limpian
  // con cada FDS nueva (el tipo de código elegido se conserva).
  poner('codigoInterno', '');
  poner('ean13', '');
  poner('qrTexto', '');
}
