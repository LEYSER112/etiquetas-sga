/**
 * Convierte un SVG en PNG (en el navegador) con la resolución necesaria
 * para imprimir el pictograma nítido al tamaño pedido.
 */
const cache = new Map();

/**
 * @param {string} url      Ruta del SVG.
 * @param {number} ladoMm   Lado del pictograma en mm.
 * @param {number} dpi      Resolución de impresión.
 * @returns {Promise<Uint8Array>} Bytes PNG.
 */
export function svgAPng(url, ladoMm, dpi = 600) {
  const px = Math.max(64, Math.round((ladoMm / 25.4) * dpi));
  const clave = `${url}@${px}`;
  if (!cache.has(clave)) {
    const promesa = rasterizar(url, px).catch((error) => {
      cache.delete(clave);
      throw error;
    });
    cache.set(clave, promesa);
  }
  return cache.get(clave);
}

async function rasterizar(url, px) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar el pictograma ${url}`);
  const svg = await respuesta.text();
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const imagen = new Image();
    imagen.decoding = 'async';
    imagen.src = blobUrl;
    await imagen.decode();

    const lienzo = document.createElement('canvas');
    lienzo.width = px;
    lienzo.height = px;
    lienzo.getContext('2d').drawImage(imagen, 0, 0, px, px);

    const blob = await new Promise((resolver, rechazar) =>
      lienzo.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo generar el PNG'))), 'image/png'),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
