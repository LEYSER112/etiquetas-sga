/**
 * Utilidades de texto puras (sin dependencias del navegador).
 */

/** Quita tildes y pasa a minúsculas para comparar sin importar la escritura. */
export function claveComparacion(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Limpia el texto extraído de un PDF: espacios raros, ligaduras,
 * guiones de corte de línea y espacios dentro de los códigos H/P.
 * @param {string} texto
 */
export function normalizarTextoFds(texto) {
  return (
    texto
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
      .replace(/\ufb01/g, 'fi')
      .replace(/\ufb02/g, 'fl')
      .replace(/[\u2010-\u2013\u2212]/g, '-')
      // Palabras cortadas con guion al final de la línea
      .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
      // "H 314" -> "H314", "P 305" -> "P305"
      .replace(/\b([HP])\s+(\d{3})\b/g, '$1$2')
      // "P305 + P351" -> "P305+P351"
      .replace(/(\d)\s*\+\s*(?=[HP]?\d{3})/g, '$1+')
      .replace(/[ \t]+\n/g, '\n')
  );
}

/** Une espacios múltiples en uno y recorta. */
export function compactar(texto) {
  return texto.replace(/\s+/g, ' ').trim();
}

/** Pone en mayúscula la primera letra. */
export function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

// Caracteres codificables con las fuentes estándar del PDF (WinAnsi / CP1252).
const EXTRA_WIN_ANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const REEMPLAZOS = {
  '≤': '<=',
  '≥': '>=',
  '−': '-',
  '\u2010': '-',
  '‑': '-',
  '·': '·',
  '→': '->',
  '≈': '~',
  '\t': ' ',
};

/**
 * Convierte el texto a caracteres que la fuente Helvetica del PDF puede dibujar.
 * Los que no tienen equivalente se eliminan.
 * @param {string} texto
 */
export function aWinAnsi(texto) {
  let salida = '';
  for (const caracter of texto.normalize('NFC')) {
    const codigo = caracter.codePointAt(0);
    if (REEMPLAZOS[caracter] !== undefined) salida += REEMPLAZOS[caracter];
    else if ((codigo >= 0x20 && codigo <= 0x7e) || (codigo >= 0xa0 && codigo <= 0xff)) salida += caracter;
    else if (EXTRA_WIN_ANSI.includes(caracter)) salida += caracter;
    else if (caracter === '\n') salida += '\n';
  }
  return salida;
}

/** Formatea una fecha ISO (aaaa-mm-dd) como dd/mm/aaaa. */
export function formatearFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '');
}

/** Nombre de archivo seguro a partir de un texto. */
export function nombreArchivo(texto, extension = 'pdf') {
  const base =
    claveComparacion(texto || 'etiqueta')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'etiqueta';
  return `${base}.${extension}`;
}
