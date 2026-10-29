/**
 * Generación del PDF imprimible con pdf-lib.
 * Funciona en el navegador y en Node (pruebas), porque los pictogramas se
 * reciben ya convertidos a PNG mediante `obtenerPictograma`.
 */
import { PDFDocument, StandardFonts, rgb } from '../../vendor/pdf-lib/pdf-lib.esm.min.js';
import { disenarEtiqueta, PT_A_MM } from '../core/diseno-etiqueta.js';
import { aWinAnsi } from '../core/texto.js';
import { HOJAS, IMPRESION } from '../config/empresa.js';

const mmAPt = (mm) => mm / PT_A_MM;
const NEGRO = rgb(0, 0, 0);

/**
 * @typedef {object} OpcionesPdf
 * @property {'individual'|'hoja'} [modo]   Una etiqueta por página o varias en una hoja.
 * @property {'carta'|'a4'|'oficio'} [hoja]
 * @property {number} [copias]
 * @property {boolean} [borde]              Línea de contorno de la etiqueta.
 * @property {(codigo:string, ladoMm:number) => Promise<Uint8Array>} obtenerPictograma
 */

/**
 * @param {object} datos
 * @param {{anchoMm:number, altoMm:number, pictogramaMm:number}} formato
 * @param {OpcionesPdf} opciones
 */
export async function generarPdf(datos, formato, opciones) {
  const { modo = 'individual', hoja = 'carta', copias = 1, borde = true, obtenerPictograma } = opciones;

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

  const diseno = disenarEtiqueta(datos, formato, medidor, { borde });

  const imagenes = new Map();
  for (const codigo of datos.pictogramas) {
    const png = await obtenerPictograma(codigo, formato.pictogramaMm);
    imagenes.set(codigo, await pdf.embedPng(png));
  }

  const dibujar = (pagina, origenX, origenY) =>
    dibujarElementos(pagina, diseno.elementos, origenX, origenY, fuentes, imagenes);

  const avisos = [...diseno.avisos];
  const totalCopias = Math.max(1, Math.min(500, Math.floor(copias) || 1));

  if (modo === 'hoja') {
    const papel = HOJAS[hoja] ?? HOJAS.carta;
    const { margenHojaMm: margen, separacionMm: sep } = IMPRESION;
    const columnas = Math.floor((papel.anchoMm - 2 * margen + sep) / (formato.anchoMm + sep));
    const filas = Math.floor((papel.altoMm - 2 * margen + sep) / (formato.altoMm + sep));
    const porHoja = columnas * filas;
    if (porHoja < 1) throw new Error(`La etiqueta no cabe en una hoja ${papel.nombre}.`);

    const anchoGrilla = columnas * formato.anchoMm + (columnas - 1) * sep;
    const altoGrilla = filas * formato.altoMm + (filas - 1) * sep;
    const inicioX = (papel.anchoMm - anchoGrilla) / 2;
    const inicioY = (papel.altoMm - altoGrilla) / 2;

    for (let n = 0; n < totalCopias; n += 1) {
      const indice = n % porHoja;
      if (indice === 0) pdf.addPage([mmAPt(papel.anchoMm), mmAPt(papel.altoMm)]);
      const pagina = pdf.getPage(pdf.getPageCount() - 1);
      const x = inicioX + (indice % columnas) * (formato.anchoMm + sep);
      const y = inicioY + Math.floor(indice / columnas) * (formato.altoMm + sep);
      dibujar(pagina, x, y);
      dibujarMarcasCorte(pagina, x, y, formato.anchoMm, formato.altoMm);
    }
    avisos.push({
      nivel: 'info',
      mensaje: `${porHoja} etiqueta(s) por hoja ${papel.nombre}. Imprima al 100 % (sin "ajustar a la página").`,
    });
  } else {
    for (let n = 0; n < totalCopias; n += 1) {
      const pagina = pdf.addPage([mmAPt(formato.anchoMm), mmAPt(formato.altoMm)]);
      dibujar(pagina, 0, 0);
    }
  }

  return { bytes: await pdf.save(), avisos, diseno };
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
            color: NEGRO,
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
  const largo = 2.5;
  const separacion = 0.8;
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
