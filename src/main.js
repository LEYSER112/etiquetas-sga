/**
 * Punto de entrada: conecta la interfaz con el análisis de la FDS y el PDF.
 */
import { analizarFds } from './core/analizador-fds.js';
import { pictogramasDesdeH } from './core/reglas-sga.js';
import { validarEtiqueta } from './core/validaciones.js';
import { nombreArchivo } from './core/texto.js';
import {
  TAMANOS_ETIQUETA,
  obtenerTamano,
  tamanoPorCapacidad,
  dimensionesOrientadas,
} from './config/tamanos-etiqueta.js';
import { EMPRESA, HOJAS, IMPRESION } from './config/empresa.js';
import { pictogramaPorCodigo } from './data/pictogramas.js';
import { generarPdf } from './services/generador-pdf.js';
import { svgAPng } from './services/rasterizador-svg.js';
import { leerFormulario, escribirAnalisis } from './ui/formulario.js';
import { crearSelectorPictogramas } from './ui/selector-pictogramas.js';
import { mostrarAvisos } from './ui/avisos.js';
import { configurarZonaCarga } from './ui/zona-carga.js';
import { crearVistaPrevia } from './ui/vista-previa.js';

const $ = (id) => document.getElementById(id);

const form = /** @type {HTMLFormElement} */ ($('formulario'));
const estado = $('estado-carga');
const botonSugeridos = $('usar-sugeridos');
const listaAvisos = $('avisos');

const vista = crearVistaPrevia({
  marco: $('marco'),
  iframe: $('vista-pdf'),
  vacia: $('vista-vacia'),
  cota: $('cota'),
});
const selector = crearSelectorPictogramas($('pictogramas'), programarActualizacion);

let avisosAnalisis = [];
let ultimoPdf = null;
let temporizador = null;
let generacion = 0;

// --- Inicio --------------------------------------------------------------

llenarSelectorTamanos();
reiniciar();
configurarZonaCarga($('zona-carga'), $('archivo-fds'), cargarFds);
form.addEventListener('input', programarActualizacion);
form.addEventListener('change', programarActualizacion);
botonSugeridos.addEventListener('click', () => {
  selector.establecer(pictogramasSugeridos());
  programarActualizacion();
});
$('descargar').addEventListener('click', descargar);
$('imprimir').addEventListener('click', () => ultimoPdf && vista.imprimir());
$('limpiar').addEventListener('click', reiniciar);

function llenarSelectorTamanos() {
  const opciones = [new Option('Automático según capacidad', 'auto')];
  for (const t of TAMANOS_ETIQUETA) {
    opciones.push(new Option(`${t.anchoMm} x ${t.altoMm} mm · ${t.nombre}`, t.id));
  }
  $('tamano').replaceChildren(...opciones);
}

function reiniciar() {
  form.reset();
  selector.establecer([]);
  $('telefono-emergencia').value = EMPRESA.telefonoEmergencia;
  avisosAnalisis = [];
  ultimoPdf = null;
  mostrarEstado('');
  vista.limpiar();
  actualizar();
}

// --- Carga de la FDS -----------------------------------------------------

async function cargarFds(archivo) {
  if (!/\.pdf$/i.test(archivo.name) && archivo.type !== 'application/pdf') {
    mostrarEstado('El archivo debe ser un PDF.', 'error');
    return;
  }
  mostrarEstado(`Leyendo ${archivo.name}…`);
  try {
    // pdf.js se carga solo cuando se necesita (pesa ~2 MB).
    const { extraerTextoPdf } = await import('./services/lector-pdf.js');
    const { texto, paginas } = await extraerTextoPdf(await archivo.arrayBuffer());
    const resultado = analizarFds(texto);

    escribirAnalisis(form, resultado, EMPRESA);
    selector.establecer(resultado.pictogramas);
    avisosAnalisis = resultado.avisos;
    mostrarEstado(
      `Se leyeron ${paginas} página(s) de ${archivo.name}: ${resultado.frasesH.length} frases H, ` +
        `${resultado.frasesP.length} frases P y ${resultado.pictogramas.length} pictograma(s). Revisa los datos.`,
      'ok',
    );
    actualizar();
  } catch (error) {
    console.error(error);
    mostrarEstado(`No se pudo leer el PDF (${error.message}). Diligencia los datos manualmente.`, 'error');
  }
}

function mostrarEstado(mensaje, tipo = '') {
  estado.textContent = mensaje;
  estado.dataset.tipo = tipo;
}

// --- Generación ----------------------------------------------------------

function programarActualizacion() {
  clearTimeout(temporizador);
  temporizador = setTimeout(actualizar, 350);
}

function pictogramasSugeridos() {
  const datos = leerFormulario(form, []);
  return pictogramasDesdeH(datos.frasesH.map((f) => f.codigo).filter(Boolean));
}

/** Tamaño elegido o, en automático, el que exige la capacidad (A7 si no hay capacidad). */
function resolverTamano(datos) {
  if (datos.tamano && datos.tamano !== 'auto') return obtenerTamano(datos.tamano);
  return tamanoPorCapacidad(datos.capacidadL) ?? obtenerTamano('A7');
}

async function actualizar() {
  const id = ++generacion;
  const datos = leerFormulario(form, selector.obtener());
  const tamano = resolverTamano(datos);
  datos.tamanoId = tamano.id;

  const sugeridos = pictogramasSugeridos();
  botonSugeridos.hidden = sugeridos.join() === datos.pictogramas.join();

  const vacio = !datos.nombreProducto && datos.frasesH.length === 0 && datos.frasesP.length === 0;
  if (vacio) {
    ultimoPdf = null;
    vista.limpiar();
    mostrarAvisos(listaAvisos, avisosAnalisis);
    return;
  }

  const formato = { ...dimensionesOrientadas(tamano, datos.orientacion), pictogramaMm: tamano.pictogramaMm };
  try {
    const { bytes, avisos } = await generarPdf(datos, formato, {
      modo: datos.modo,
      hoja: datos.hoja,
      copias: datos.copias,
      borde: datos.borde,
      obtenerPictograma: (codigo, ladoMm) =>
        svgAPng(pictogramaPorCodigo(codigo).archivo, ladoMm, IMPRESION.dpiPictogramas),
    });
    if (id !== generacion) return; // llegó una versión más reciente

    ultimoPdf = { bytes, nombre: nombreArchivo(`etiqueta-${datos.nombreProducto}`) };
    const pagina = datos.modo === 'hoja' ? HOJAS[datos.hoja] : formato;
    vista.mostrar(bytes, pagina);
    mostrarAvisos(listaAvisos, [...validarEtiqueta(datos), ...avisos, ...avisosAnalisis]);
  } catch (error) {
    console.error(error);
    if (id === generacion) {
      mostrarAvisos(listaAvisos, [
        { nivel: 'error', mensaje: `No se pudo generar el PDF: ${error.message}` },
      ]);
    }
  }
}

function descargar() {
  if (!ultimoPdf) {
    mostrarAvisos(listaAvisos, [
      { nivel: 'error', mensaje: 'Primero carga una FDS o escribe el nombre del producto.' },
    ]);
    return;
  }
  const url = URL.createObjectURL(new Blob([ultimoPdf.bytes], { type: 'application/pdf' }));
  const enlace = Object.assign(document.createElement('a'), { href: url, download: ultimoPdf.nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
