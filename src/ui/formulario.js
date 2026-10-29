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
    nombreProducto: valor(form, 'nombre'),
    palabraAdvertencia: valor(form, 'palabra'),
    capacidadL: Number.isFinite(capacidad) ? capacidad : null,
    contenido: Number.isFinite(capacidad) ? `${String(capacidad).replace('.', ',')} L` : '',
    pictogramas,
    frasesH: textoAFrases(valor(form, 'frasesH'), 'H'),
    frasesP: textoAFrases(valor(form, 'frasesP'), 'P'),
    proveedor: {
      nombre: valor(form, 'proveedorNombre'),
      direccion: valor(form, 'proveedorDireccion'),
      telefono: valor(form, 'proveedorTelefono'),
    },
    telefonoEmergencia: valor(form, 'telefonoEmergencia'),
    lote: valor(form, 'lote'),
    fechaFabricacion: valor(form, 'fechaFabricacion'),
    fechaVencimiento: valor(form, 'fechaVencimiento'),
    tamano: valor(form, 'tamano'),
    orientacion: valor(form, 'orientacion') || 'vertical',
    modo: valor(form, 'modo') || 'individual',
    hoja: valor(form, 'hoja') || 'carta',
    copias: Number.parseInt(valor(form, 'copias'), 10) || 1,
    borde: form.elements.namedItem('borde')?.checked ?? true,
  };
}

/**
 * Llena el formulario con el resultado del análisis de la FDS.
 * @param {HTMLFormElement} form
 * @param {ReturnType<import('../core/analizador-fds.js').analizarFds>} r
 * @param {{telefonoEmergencia?: string}} respaldo  Valores por defecto de la empresa.
 */
export function escribirAnalisis(form, r, respaldo = {}) {
  const poner = (nombre, texto) => {
    const campo = form.elements.namedItem(nombre);
    if (campo) campo.value = texto ?? '';
  };
  poner('nombre', r.nombreProducto);
  poner('palabra', r.palabraAdvertencia);
  poner('frasesH', frasesATexto(r.frasesH));
  poner('frasesP', frasesATexto(r.frasesP));
  poner('proveedorNombre', r.proveedor.nombre);
  poner('proveedorDireccion', r.proveedor.direccion);
  poner('proveedorTelefono', r.proveedor.telefono);
  poner('telefonoEmergencia', r.proveedor.telefonoEmergencia || respaldo.telefonoEmergencia);
}
