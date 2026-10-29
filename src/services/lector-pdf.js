/**
 * Lectura del texto de un PDF en el navegador con pdf.js.
 */
import { getDocument, GlobalWorkerOptions } from '../../vendor/pdfjs/pdf.min.mjs';
import { reconstruirLineas } from '../core/lineas-pdf.js';

GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

/**
 * @param {ArrayBuffer} contenido  Bytes del PDF.
 * @returns {Promise<{texto: string, paginas: number}>}
 */
export async function extraerTextoPdf(contenido) {
  const tarea = getDocument({ data: new Uint8Array(contenido) });
  const documento = await tarea.promise;
  try {
    const textos = [];
    for (let n = 1; n <= documento.numPages; n += 1) {
      const pagina = await documento.getPage(n);
      const contenidoTexto = await pagina.getTextContent();
      textos.push(reconstruirLineas(contenidoTexto.items));
      pagina.cleanup();
    }
    return { texto: textos.join('\n'), paginas: documento.numPages };
  } finally {
    await tarea.destroy();
  }
}
