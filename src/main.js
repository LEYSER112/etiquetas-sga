/**
 * Punto de entrada: conecta la interfaz con el análisis de la FDS y el PDF.
 */
import { analizarFds } from './core/analizador-fds.js';
import { pictogramasDesdeH } from './core/reglas-sga.js';
import { validarEtiqueta } from './core/validaciones.js';
import { nombreArchivo } from './core/texto.js';
import { TAMANOS_ETIQUETA } from './config/tamanos-etiqueta.js';
import { formatosCandidatos } from './core/ajuste-tamano.js';
import { IMPRESION } from './config/empresa.js';
import { validarEan13 } from './core/ean13.js';
import { pictogramaPorCodigo } from './data/pictogramas.js';
import { generarPdf, generarHojasPdf } from './services/generador-pdf.js';
import { svgAPng } from './services/rasterizador-svg.js';
import { leerFormulario, escribirAnalisis } from './ui/formulario.js';
import { crearSelectorPictogramas } from './ui/selector-pictogramas.js';
import { mostrarAvisos } from './ui/avisos.js';
import { configurarZonaCarga } from './ui/zona-carga.js';
import { crearVistaPrevia } from './ui/vista-previa.js';
import { crearPanelGrupo } from './ui/panel-grupo.js';

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
/** Última etiqueta generada: PDF, datos, formato elegido y avisos. */
let ultimoPdf = null;
/** true mientras la vista previa muestra las hojas del grupo. */
let mostrandoHojas = false;

const grupo = crearPanelGrupo(
  {
    lista: $('grupo-lista'),
    vacio: $('grupo-vacio'),
    resumen: $('grupo-resumen'),
    hoja: $('hoja'),
    contador: $('grupo-contador'),
  },
  () => {
    grupo.mostrarResumen('');
    if (mostrandoHojas) verHojas();
  },
);
const obtenerPictograma = (codigo, ladoMm) =>
  svgAPng(pictogramaPorCodigo(codigo).archivo, ladoMm, IMPRESION.dpiPictogramas);
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
$('guardar').addEventListener('click', guardarEnGrupo);
$('descargar').addEventListener('click', descargar);
$('limpiar').addEventListener('click', reiniciar);
$('grupo-ver').addEventListener('click', verHojas);
$('grupo-descargar').addEventListener('click', async () => {
  const pdf = await verHojas();
  if (pdf)
    descargarBytes(pdf.bytes, `etiquetas-sga-${pdf.papel.nombre.toLowerCase().replace(/\s+/g, '-')}.pdf`);
});
$('grupo-imprimir').addEventListener('click', async () => {
  if (await verHojas()) setTimeout(() => vista.imprimir(), 400);
});
// Vaciar pide un segundo clic para confirmar (evita perder el grupo por error).
let confirmarVaciado = null;
$('grupo-vaciar').addEventListener('click', (evento) => {
  const boton = evento.currentTarget;
  if (!grupo.obtener().items.length) return;
  if (!confirmarVaciado) {
    boton.textContent = 'Clic de nuevo para vaciar';
    confirmarVaciado = setTimeout(() => {
      boton.textContent = 'Vaciar grupo';
      confirmarVaciado = null;
    }, 4000);
    return;
  }
  clearTimeout(confirmarVaciado);
  confirmarVaciado = null;
  boton.textContent = 'Vaciar grupo';
  grupo.vaciar();
  if (mostrandoHojas) {
    mostrandoHojas = false;
    actualizar();
  }
});

function llenarSelectorTamanos() {
  const opciones = [new Option('Automático (se ajusta al texto)', 'auto')];
  for (const t of TAMANOS_ETIQUETA) {
    opciones.push(new Option(`${t.anchoMm} x ${t.altoMm} mm · ${t.nombre}`, t.id));
  }
  $('tamano').replaceChildren(...opciones);
}

function reiniciar() {
  form.reset();
  selector.establecer([]);
  avisosAnalisis = [];
  ultimoPdf = null;
  mostrarEstado('');
  $('tamano-elegido').textContent = '';
  $('estado-guardado').textContent = '';
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

    escribirAnalisis(form, resultado);
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

async function actualizar() {
  const id = ++generacion;
  mostrandoHojas = false;
  const datos = leerFormulario(form, selector.obtener());
  const ean = validarEan13(datos.ean13Texto);
  datos.ean13 = ean.valido ? ean.codigo : '';
  mostrarAyudaEan(ean);

  const sugeridos = pictogramasSugeridos();
  botonSugeridos.hidden = sugeridos.join() === datos.pictogramas.join();

  const vacio = !datos.nombreProducto && datos.frasesH.length === 0 && datos.frasesP.length === 0;
  if (vacio) {
    ultimoPdf = null;
    vista.limpiar();
    mostrarAvisos(listaAvisos, avisosAnalisis);
    return;
  }

  // Tamaños candidatos: desde el mínimo de la norma, horizontal primero.
  const candidatos = formatosCandidatos(datos);
  try {
    const { bytes, avisos, formato } = await generarPdf(datos, candidatos, {
      borde: datos.borde,
      cuadroLote: datos.cuadroLote,
      obtenerPictograma,
    });
    if (id !== generacion) return; // llegó una versión más reciente

    datos.tamanoId = formato.id;
    mostrarTamanoElegido(formato, datos);
    vista.mostrar(bytes, formato);
    const avisoCapacidad = datos.capacidadL
      ? []
      : [
          {
            nivel: 'info',
            mensaje: 'Indica la capacidad del envase para respetar el tamaño mínimo de la norma.',
          },
        ];
    const todos = [...validarEtiqueta(datos), ...avisos, ...avisoCapacidad, ...avisosAnalisis];
    ultimoPdf = {
      bytes,
      datos,
      formato,
      avisos: todos,
      nombre: nombreArchivo(`etiqueta-${datos.nombreProducto}`),
    };
    mostrarAvisos(listaAvisos, todos);
  } catch (error) {
    console.error(error);
    if (id === generacion) {
      mostrarAvisos(listaAvisos, [
        { nivel: 'error', mensaje: `No se pudo generar el PDF: ${error.message}` },
      ]);
    }
  }
}

function mostrarAyudaEan(ean) {
  const ayuda = $('ayuda-ean');
  ayuda.textContent = ean.vacio ? 'Opcional. Escribe 12 dígitos y el último se calcula solo.' : ean.mensaje;
  ayuda.dataset.tipo = ean.vacio ? '' : ean.valido ? 'ok' : 'error';
}

function mostrarTamanoElegido(formato, datos) {
  const automatico = datos.tamano === 'auto' || datos.orientacion === 'auto';
  const texto = `${formato.anchoMm} x ${formato.altoMm} mm (${formato.id}, ${formato.orientacion})`;
  $('tamano-elegido').textContent = automatico ? `Tamaño elegido: ${texto}.` : `Tamaño: ${texto}.`;
}

function descargar() {
  if (!ultimoPdf) {
    mostrarAvisos(listaAvisos, [
      { nivel: 'error', mensaje: 'Primero carga una FDS o escribe el nombre del producto.' },
    ]);
    return;
  }
  descargarBytes(ultimoPdf.bytes, ultimoPdf.nombre);
}

function descargarBytes(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const enlace = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// --- Grupo de impresión ---------------------------------------------------

/** Guarda la etiqueta revisada en el grupo y deja el formulario listo para la siguiente. */
async function guardarEnGrupo() {
  const boton = $('guardar');
  if (boton.disabled) return;
  boton.disabled = true;
  boton.textContent = 'Guardando…';
  try {
    await guardarEnGrupoSinBloqueo();
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar en el grupo';
  }
}

async function guardarEnGrupoSinBloqueo() {
  clearTimeout(temporizador);
  await actualizar(); // asegura que se guarda lo último que se escribió
  const aviso = $('estado-guardado');
  if (!ultimoPdf) {
    aviso.textContent = 'Primero carga una FDS o escribe el nombre del producto.';
    aviso.dataset.tipo = 'error';
    return;
  }
  const errores = ultimoPdf.avisos.filter((a) => a.nivel === 'error');
  if (errores.length) {
    aviso.textContent = `Corrige ${errores.length === 1 ? 'el error' : `los ${errores.length} errores`} de la lista antes de guardar.`;
    aviso.dataset.tipo = 'error';
    return;
  }

  const { datos, formato } = ultimoPdf;
  grupo.agregar({ datos, formato, borde: datos.borde, cuadroLote: datos.cuadroLote, copias: datos.copias });
  const nombre = datos.nombreProducto;
  reiniciar();
  aviso.textContent = `«${nombre}» se guardó en el grupo. Sube la siguiente FDS.`;
  aviso.dataset.tipo = 'ok';
  $('zona-carga').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Genera el PDF con las hojas del grupo y lo muestra en la vista previa. */
async function verHojas() {
  const { items, hoja } = grupo.obtener();
  if (!items.length) {
    grupo.mostrarResumen('El grupo está vacío. Guarda al menos una etiqueta.');
    return null;
  }
  grupo.mostrarResumen('Acomodando etiquetas…');
  try {
    const pdf = await generarHojasPdf(items, { hoja, obtenerPictograma });
    generacion += 1; // invalida una vista previa de etiqueta que esté en camino
    mostrandoHojas = true;
    vista.mostrar(pdf.bytes, pdf.papel);
    mostrarAvisos(listaAvisos, [
      {
        nivel: 'info',
        mensaje: 'Imprime al 100 % (tamaño real, sin "Ajustar a la página") para conservar las medidas.',
      },
    ]);
    grupo.mostrarResumen(`${pdf.etiquetas} etiqueta(s) en ${pdf.hojas} hoja(s) ${pdf.papel.nombre}.`);
    return pdf;
  } catch (error) {
    console.error(error);
    grupo.mostrarResumen(`No se pudo armar el PDF: ${error.message}`);
    return null;
  }
}
