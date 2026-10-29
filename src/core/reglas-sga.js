/**
 * Reglas del SGA: qué pictograma y qué palabra de advertencia corresponden
 * a cada indicación de peligro (frase H).
 */

/** Pictogramas que exige cada frase H. Las que no aparecen no llevan pictograma. */
const PICTOGRAMAS_POR_H = Object.freeze({
  H200: ['GHS01'],
  H201: ['GHS01'],
  H202: ['GHS01'],
  H203: ['GHS01'],
  H204: ['GHS01'],
  H205: ['GHS01'],
  H240: ['GHS01'],
  H241: ['GHS01', 'GHS02'],

  H206: ['GHS02'],
  H207: ['GHS02'],
  H208: ['GHS02'],
  H220: ['GHS02'],
  H222: ['GHS02'],
  H223: ['GHS02'],
  H224: ['GHS02'],
  H225: ['GHS02'],
  H226: ['GHS02'],
  H228: ['GHS02'],
  H232: ['GHS02'],
  H242: ['GHS02'],
  H250: ['GHS02'],
  H251: ['GHS02'],
  H252: ['GHS02'],
  H260: ['GHS02'],
  H261: ['GHS02'],
  H282: ['GHS02', 'GHS04'],
  H283: ['GHS02', 'GHS04'],

  H270: ['GHS03'],
  H271: ['GHS03'],
  H272: ['GHS03'],

  H280: ['GHS04'],
  H281: ['GHS04'],
  H284: ['GHS04'],

  H290: ['GHS05'],
  H314: ['GHS05'],
  H318: ['GHS05'],

  H300: ['GHS06'],
  H301: ['GHS06'],
  H310: ['GHS06'],
  H311: ['GHS06'],
  H330: ['GHS06'],
  H331: ['GHS06'],

  H302: ['GHS07'],
  H312: ['GHS07'],
  H332: ['GHS07'],
  H315: ['GHS07'],
  H317: ['GHS07'],
  H319: ['GHS07'],
  H335: ['GHS07'],
  H336: ['GHS07'],
  H420: ['GHS07'],

  H304: ['GHS08'],
  H334: ['GHS08'],
  H340: ['GHS08'],
  H341: ['GHS08'],
  H350: ['GHS08'],
  H351: ['GHS08'],
  H360: ['GHS08'],
  H361: ['GHS08'],
  H370: ['GHS08'],
  H371: ['GHS08'],
  H372: ['GHS08'],
  H373: ['GHS08'],

  H400: ['GHS09'],
  H410: ['GHS09'],
  H411: ['GHS09'],
});

/** Frases H que siempre llevan "Peligro". El resto se asume "Atención". */
const H_CON_PELIGRO = new Set([
  'H200',
  'H201',
  'H202',
  'H203',
  'H205',
  'H206',
  'H207',
  'H220',
  'H222',
  'H224',
  'H225',
  'H230',
  'H231',
  'H232',
  'H240',
  'H241',
  'H250',
  'H251',
  'H260',
  'H270',
  'H271',
  'H300',
  'H301',
  'H304',
  'H310',
  'H311',
  'H314',
  'H318',
  'H330',
  'H331',
  'H334',
  'H340',
  'H350',
  'H360',
  'H370',
  'H372',
  'H282',
  'H283',
]);

/** Quita el sufijo de toxicidad reproductiva: H360FD -> H360. */
export function codigoBase(codigoH) {
  return codigoH.slice(0, 4);
}

/** Separa "H300+H310" en sus partes. */
function partesH(codigos) {
  return codigos.flatMap((c) => c.split('+')).map(codigoBase);
}

/**
 * Pictogramas que corresponden a las frases H, aplicando las reglas de
 * precedencia del SGA (1.4.10.5.3.1):
 *  a) Si aplica la calavera (GHS06) no se usa el signo de exclamación (GHS07).
 *  b) Si aplica corrosión (GHS05) no se usa GHS07 para irritación cutánea u ocular.
 *  c) Si aplica peligro para la salud (GHS08) por sensibilización respiratoria (H334),
 *     no se usa GHS07 para sensibilización cutánea ni irritación cutánea u ocular.
 * @param {string[]} codigosH
 * @returns {string[]} Códigos GHS ordenados.
 */
export function pictogramasDesdeH(codigosH) {
  const codigos = partesH(codigosH);
  const resultado = new Set(codigos.flatMap((c) => PICTOGRAMAS_POR_H[c] ?? []));

  if (resultado.has('GHS07')) {
    let disparadores = codigos.filter((c) => (PICTOGRAMAS_POR_H[c] ?? []).includes('GHS07'));
    if (resultado.has('GHS06')) disparadores = [];
    if (resultado.has('GHS05')) disparadores = disparadores.filter((c) => !['H315', 'H319'].includes(c));
    if (codigos.includes('H334')) {
      disparadores = disparadores.filter((c) => !['H315', 'H317', 'H319'].includes(c));
    }
    if (disparadores.length === 0) resultado.delete('GHS07');
  }
  return [...resultado].sort();
}

/**
 * Palabra de advertencia deducida de las frases H (respaldo cuando la FDS no la indica).
 * @returns {'Peligro'|'Atención'|''}
 */
export function palabraDesdeH(codigosH) {
  const codigos = partesH(codigosH);
  if (codigos.length === 0) return '';
  return codigos.some((c) => H_CON_PELIGRO.has(c)) ? 'Peligro' : 'Atención';
}

/** Frases H que justifican un pictograma dado. */
export function frasesQueExigen(pictograma, codigosH) {
  return partesH(codigosH).filter((c) => (PICTOGRAMAS_POR_H[c] ?? []).includes(pictograma));
}
