/**
 * Generación del PDF imprimible con pdf-lib.
 * Funciona en el navegador y en Node (pruebas), porque los pictogramas se
 * reciben ya convertidos a PNG mediante `obtenerPictograma`.
 */
import { PDFDocument, StandardFonts, rgb, degrees } from '../../vendor/pdf-lib/pdf-lib.esm.min.js';
import { PT_A_MM } from '../core/diseno-etiqueta.js';
import { elegirFormato } from '../core/ajuste-tamano.js';
import { aWinAnsi } from '../core/texto.js';
import { HOJAS, IMPRESION } from '../config/empresa.js';
import { acomodarEnHojas } from '../core/acomodo-hoja.js';

const mmAPt = (mm) => mm / PT_A_MM;
const NEGRO = rgb(0, 0, 0);
const BLANCO = rgb(1, 1, 1);

/**
 * @typedef {object} OpcionesPdf
 * @property {number} [copias]               Páginas iguales (una etiqueta por página).
 * @property {boolean} [borde]              Línea de contorno de la etiqueta.
 * @property {boolean} [cuadroLote]         Cuadro de 32 x 15 mm para el sticker del lote.
 * @property {(codigo:string, ladoMm:number) => Promise<Uint8Array>} obtenerPictograma
 */

/**
 * @param {object} datos
 * @param {object|object[]} formatos  Un formato {anchoMm, altoMm, pictogramaMm} o una lista
 *   ordenada de candidatos; en ese caso se usa el primero donde todo el texto cabe.
 * @param {OpcionesPdf} opciones
 */
export async function generarPdf(datos, formatos, opciones) {
  const { copias = 1, borde = true, cuadroLote = true, obtenerPictograma } = opciones;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Etiqueta SGA - ${datos.nombreProducto || 'producto'}`);
  pdf.setSubject('Etiqueta SGA - Resolución 773 de 2021');
  pdf.setCreator('Generador de etiquetas SGA');
  pdf.setProducer('pdf-lib');

  const fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const medidor = {
    ancho: (texto, pt, negrita) =>
      (negrita ? fuentes.negrita : fuentes.normal).widthOfTextAtSize(aWinAnsi(texto), pt) * PT_A_MM,
  };

  const candidatos = Array.isArray(formatos) ? formatos : [formatos];
  const { formato, diseno } = elegirFormato(datos, candidatos, medidor, { borde, cuadroLote });

  const imagenes = new Map();
  for (const codigo of datos.pictogramas) {
    const png = await obtenerPictograma(codigo, formato.pictogramaMm);
    imagenes.set(codigo, await pdf.embedPng(png));
  }

  const dibujar = (pagina, origenX, origenY) =>
    dibujarElementos(pagina, diseno.elementos, origenX, origenY, fuentes, imagenes);

  const avisos = [...diseno.avisos];
  const totalCopias = Math.max(1, Math.min(500, Math.floor(copias) || 1));

  for (let n = 0; n < totalCopias; n += 1) {
    const pagina = pdf.addPage([mmAPt(formato.anchoMm), mmAPt(formato.altoMm)]);
    dibujar(pagina, 0, 0);
  }

  return { bytes: await pdf.save(), avisos, diseno, formato };
}

/**
 * @typedef {object} EtiquetaGrupo
 * @property {object} datos     Datos de la etiqueta (como los arma el formulario).
 * @property {{anchoMm:number, altoMm:number, pictogramaMm:number}} formato  Tamaño ya elegido.
 * @property {boolean} [borde]
 * @property {boolean} [cuadroLote]
 * @property {number} [copias]
 */

/**
 * PDF con varias etiquetas acomodadas en hojas de impresión.
 * Cada etiqueta se genera a su medida y se coloca en la hoja (girada 90° si
 * así caben más), con separación y marcas de corte.
 * @param {EtiquetaGrupo[]} etiquetas
 * @param {{hoja?: string, obtenerPictograma: OpcionesPdf['obtenerPictograma']}} opciones
 * @returns {Promise<{bytes: Uint8Array, hojas: number, etiquetas: number, papel: object}>}
 */
export async function generarHojasPdf(etiquetas, { hoja = 'carta', obtenerPictograma }) {
  if (!etiquetas.length) throw new Error('No hay etiquetas en el grupo.');
  const papel = HOJAS[hoja] ?? HOJAS.carta;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Etiquetas SGA - ${etiquetas.length} producto(s)`);
  pdf.setSubject('Etiquetas SGA - Resolución 773 de 2021');
  pdf.setCreator('Generador de etiquetas SGA');
  pdf.setProducer('pdf-lib');

  // Una pieza por copia; todas las copias comparten la misma página incrustada.
  const piezas = [];
  for (const etiqueta of etiquetas) {
    const { bytes, formato } = await generarPdf(etiqueta.datos, etiqueta.formato, {
      borde: etiqueta.borde ?? true,
      cuadroLote: etiqueta.cuadroLote ?? true,
      obtenerPictograma,
    });
    const [pagina] = await pdf.embedPdf(bytes, [0]);
    const copias = Math.max(1, Math.min(500, Math.floor(etiqueta.copias) || 1));
    for (let c = 0; c < copias; c += 1) {
      piezas.push({ anchoMm: formato.anchoMm, altoMm: formato.altoMm, pagina });
    }
  }

  const hojas = acomodarEnHojas(piezas, papel, {
    margen: IMPRESION.margenHojaMm,
    separacion: IMPRESION.separacionMm,
  });

  for (const ubicaciones of hojas) {
    const pagina = pdf.addPage([mmAPt(papel.anchoMm), mmAPt(papel.altoMm)]);
    const altoPagina = pagina.getHeight();
    for (const u of ubicaciones) {
      const abajo = altoPagina - mmAPt(u.y + u.alto);
      if (u.girada) {
        // Girada 90° antihoraria alrededor de (x, y): se dibuja desde la esquina inferior derecha.
        pagina.drawPage(u.pieza.pagina, {
          x: mmAPt(u.x + u.ancho),
          y: abajo,
          width: mmAPt(u.pieza.anchoMm),
          height: mmAPt(u.pieza.altoMm),
          rotate: degrees(90),
        });
      } else {
        pagina.drawPage(u.pieza.pagina, {
          x: mmAPt(u.x),
          y: abajo,
          width: mmAPt(u.ancho),
          height: mmAPt(u.alto),
        });
      }
      dibujarMarcasCorte(pagina, u.x, u.y, u.ancho, u.alto);
    }
  }

  return { bytes: await pdf.save(), hojas: hojas.length, etiquetas: piezas.length, papel, acomodo: hojas };
}

/** Dibuja los elementos del diseño con origen (mm) en la esquina superior izquierda. */
function dibujarElementos(pagina, elementos, origenX, origenY, fuentes, imagenes) {
  const altoPagina = pagina.getHeight();
  const X = (mm) => mmAPt(origenX + mm);
  const Y = (mm) => altoPagina - mmAPt(origenY + mm);

  for (const el of elementos) {
    switch (el.tipo) {
      case 'rect':
        pagina.drawRectangle({
          x: X(el.x),
          y: Y(el.y + el.alto),
          width: mmAPt(el.ancho),
          height: mmAPt(el.alto),
          borderColor: NEGRO,
          borderWidth: mmAPt(el.grosor),
          borderDashArray: el.guion ? [mmAPt(1.2), mmAPt(0.8)] : undefined,
        });
        break;
      case 'relleno':
        pagina.drawRectangle({
          x: X(el.x),
          y: Y(el.y + el.alto),
          width: mmAPt(el.ancho),
          height: mmAPt(el.alto),
          color: NEGRO,
        });
        break;
      case 'linea':
        pagina.drawLine({
          start: { x: X(el.x1), y: Y(el.y1) },
          end: { x: X(el.x2), y: Y(el.y2) },
          thickness: mmAPt(el.grosor),
          color: NEGRO,
        });
        break;
      case 'pictograma': {
        const imagen = imagenes.get(el.codigo);
        if (imagen) {
          pagina.drawImage(imagen, {
            x: X(el.x),
            y: Y(el.y + el.lado),
            width: mmAPt(el.lado),
            height: mmAPt(el.lado),
          });
        }
        break;
      }
      case 'texto':
        for (const tramo of el.tramos) {
          pagina.drawText(aWinAnsi(tramo.texto), {
            x: X(el.x + tramo.x),
            y: Y(el.y),
            size: el.pt,
            font: tramo.negrita ? fuentes.negrita : fuentes.normal,
            color: el.color === 'blanco' ? BLANCO : NEGRO,
          });
        }
        break;
      default:
        break;
    }
  }
}

/** Marcas de corte en las esquinas, por fuera de la etiqueta. */
function dibujarMarcasCorte(pagina, x, y, ancho, alto) {
  const altoPagina = pagina.getHeight();
  const { largoMm: largo, distanciaMm: separacion } = IMPRESION.marcaCorte;
  const gris = rgb(0.45, 0.45, 0.45);
  const linea = (x1, y1, x2, y2) =>
    pagina.drawLine({
      start: { x: mmAPt(x1), y: altoPagina - mmAPt(y1) },
      end: { x: mmAPt(x2), y: altoPagina - mmAPt(y2) },
      thickness: 0.3,
      color: gris,
    });
  for (const [cx, dx] of [
    [x, -1],
    [x + ancho, 1],
  ]) {
    for (const [cy, dy] of [
      [y, -1],
      [y + alto, 1],
    ]) {
      linea(cx + dx * separacion, cy, cx + dx * (separacion + largo), cy);
      linea(cx, cy + dy * separacion, cx, cy + dy * (separacion + largo));
    }
  }
}
