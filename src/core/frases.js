/**
 * Lectura, normalización y armado de frases H y P.
 */
import { FRASES_H } from '../data/frases-h.js';
import { FRASES_P, COMBINACIONES_P } from '../data/frases-p.js';
import { compactar } from './texto.js';

/** @typedef {{codigo: string, texto: string}} Frase */

// H + 3 dígitos + sufijo opcional de toxicidad reproductiva (H360FD, H361d...)
const PATRON_H = /\bH([234]\d{2})(FD|Fd|Df|fd|F|D|f|d)?(?!\p{L}|\d)/gu;
// P + 3 dígitos, con combinaciones "+P351" o "+351"
const PATRON_P = /\bP(\d{3})((?:\+P?\d{3})*)(?!\d)/g;

/**
 * Extrae los códigos H en orden de aparición, sin repetir.
 * Las combinaciones (H300+H310) se separan en códigos individuales.
 * @param {string} texto  Texto ya normalizado.
 * @returns {string[]}
 */
export function extraerCodigosH(texto) {
  const codigos = [];
  for (const m of texto.matchAll(PATRON_H)) {
    const base = `H${m[1]}`;
    const sufijo = m[2] ?? '';
    const codigo = FRASES_H[base + sufijo] ? base + sufijo : base;
    if (!codigos.includes(codigo)) codigos.push(codigo);
  }
  // Si aparece "H360FD" no dejar también "H360" suelto.
  return codigos.filter((c) => !(c.length === 4 && codigos.some((o) => o !== c && o.startsWith(c))));
}

/**
 * Extrae los códigos P (incluidas combinaciones) en orden, sin repetir y
 * quitando los que ya están contenidos en una combinación.
 * @param {string} texto  Texto ya normalizado.
 * @returns {string[]}
 */
export function extraerCodigosP(texto) {
  const codigos = [];
  for (const m of texto.matchAll(PATRON_P)) {
    const partes = [
      m[1],
      ...m[2]
        .split('+')
        .filter(Boolean)
        .map((p) => p.replace('P', '')),
    ];
    const codigo = partes.map((p) => `P${p}`).join('+');
    if (!codigos.includes(codigo)) codigos.push(codigo);
  }
  return quitarContenidos(codigos);
}

/** Quita códigos P cuyas partes están todas dentro de otra combinación más larga. */
function quitarContenidos(codigos) {
  const partes = codigos.map((c) => c.split('+'));
  return codigos.filter(
    (_, i) =>
      !partes.some(
        (otras, j) => j !== i && otras.length > partes[i].length && partes[i].every((p) => otras.includes(p)),
      ),
  );
}

/** Ordena por el primer número del código (H2xx antes que H3xx, P2xx antes que P3xx...). */
export function ordenarCodigos(codigos) {
  const numero = (c) => Number.parseInt(c.slice(1, 4), 10);
  return [...codigos].sort((a, b) => numero(a) - numero(b) || a.localeCompare(b));
}

/** Texto estándar de una frase H, o null si no está en el catálogo. */
export function textoFraseH(codigo) {
  return FRASES_H[codigo] ?? null;
}

/** Texto estándar de una frase P (simple o combinada), o null si falta alguna parte. */
export function textoFraseP(codigo) {
  if (COMBINACIONES_P[codigo]) return COMBINACIONES_P[codigo];
  const textos = codigo.split('+').map((p) => FRASES_P[p]);
  if (textos.some((t) => !t)) return null;
  // Las condiciones terminan en ":" y la acción sigue a continuación.
  return textos.join(' ');
}

/**
 * Busca en el texto de la FDS la redacción que acompaña a un código
 * (se usa cuando el código no está en el catálogo).
 */
export function textoDesdeFds(texto, codigo) {
  const escapado = codigo.replace(/\+/g, '\\+');
  const m = new RegExp(`${escapado}\\s*[:.\\-–]?\\s*([^\\n]{3,220})`).exec(texto);
  if (!m) return '';
  // Cortar donde empieza el siguiente código
  return compactar(m[1].split(/\b[HP]\d{3}/)[0]).replace(/[;,]$/, '');
}

/**
 * Construye la lista de frases con su texto.
 * @param {string[]} codigos
 * @param {'H'|'P'} tipo
 * @param {string} [textoFds]  Texto de respaldo para códigos fuera del catálogo.
 * @returns {Frase[]}
 */
export function construirFrases(codigos, tipo, textoFds = '') {
  return ordenarCodigos(codigos).map((codigo) => {
    const estandar = tipo === 'H' ? textoFraseH(codigo) : textoFraseP(codigo);
    return { codigo, texto: estandar ?? textoDesdeFds(textoFds, codigo) };
  });
}

/** Convierte frases a líneas editables: "H314 Provoca ...". */
export function frasesATexto(frases) {
  return frases.map((f) => `${f.codigo} ${f.texto}`.trim()).join('\n');
}

/**
 * Lee las líneas que escribe el usuario. Si una línea trae solo el código,
 * se completa con el texto del catálogo. Líneas sin código se conservan
 * como texto libre (útil para precauciones de productos no peligrosos).
 * @param {string} texto
 * @param {'H'|'P'} tipo
 * @returns {Frase[]}
 */
export function textoAFrases(texto, tipo) {
  const patronInicio =
    tipo === 'H'
      ? /^(H[234]\d{2}(?:FD|Fd|Df|fd|F|D|f|d)?(?:\+H\d{3})*)\b\s*[:.\-–]?\s*(.*)$/
      : /^(P\d{3}(?:\s*\+\s*P?\d{3})*)\s*[:.\-–]?\s*(.*)$/;
  return texto
    .split('\n')
    .map((linea) => compactar(linea))
    .filter(Boolean)
    .map((linea) => {
      const m = patronInicio.exec(linea);
      if (!m) return { codigo: '', texto: linea };
      const codigo = m[1].replace(/\s+/g, '').replace(/\+(\d)/g, `+${tipo}$1`);
      const libre = m[2].trim();
      const estandar = tipo === 'H' ? textoFraseH(codigo) : textoFraseP(codigo);
      return { codigo, texto: libre || estandar || '' };
    });
}
