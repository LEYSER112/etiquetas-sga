/**
 * Código de barras EAN-13 (GS1).
 *
 * - `validarEan13` revisa lo que escribe el usuario: 12 dígitos (se calcula el
 *   dígito de control) o 13 dígitos (se verifica el dígito de control).
 * - `patronEan13` devuelve los 95 módulos (1 = barra, 0 = espacio).
 * - `maquetarEan13` devuelve los rectángulos y textos en mm para dibujarlo.
 */
import { PT_A_MM } from './medidas.js';

/** Codificación de los dígitos: conjuntos A (impar), B (par) y C (derecha). */
const CONJUNTO_A = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const CONJUNTO_C = CONJUNTO_A.map((p) => [...p].map((b) => (b === '1' ? '0' : '1')).join(''));
const CONJUNTO_B = CONJUNTO_C.map((p) => [...p].reverse().join(''));

/** Paridad de los 6 dígitos izquierdos según el primer dígito. */
const PARIDAD = [
  'AAAAAA',
  'AABABB',
  'AABBAB',
  'AABBBA',
  'ABAABB',
  'ABBAAB',
  'ABBBAA',
  'ABABAB',
  'ABABBA',
  'ABBABA',
];

/** Medidas GS1 al 100 %: módulo 0,33 mm y márgenes en blanco de 11 y 7 módulos. */
export const EAN13 = Object.freeze({
  moduloMm: 0.33,
  margenIzquierdo: 11,
  margenDerecho: 7,
  modulos: 95,
  magnificacionMin: 0.8,
});

/** Dígito de control de los 12 primeros dígitos. */
export function digitoControlEan13(doce) {
  const suma = [...doce].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (suma % 10)) % 10);
}

/**
 * @param {string} texto  Lo que escribió el usuario (se ignoran espacios y guiones).
 * @returns {{vacio: boolean, valido: boolean, codigo: string, mensaje: string}}
 */
export function validarEan13(texto) {
  const limpio = (texto ?? '').replace(/[\s-]/g, '');
  if (!limpio) return { vacio: true, valido: false, codigo: '', mensaje: '' };
  if (!/^\d+$/.test(limpio)) {
    return { vacio: false, valido: false, codigo: '', mensaje: 'El EAN-13 solo puede tener números.' };
  }
  if (limpio.length === 12) {
    const codigo = limpio + digitoControlEan13(limpio);
    return { vacio: false, valido: true, codigo, mensaje: `Código completo: ${codigo}` };
  }
  if (limpio.length === 13) {
    const esperado = digitoControlEan13(limpio.slice(0, 12));
    if (limpio[12] !== esperado) {
      return {
        vacio: false,
        valido: false,
        codigo: '',
        mensaje: `El dígito de control no coincide: debería terminar en ${esperado} (${limpio.slice(0, 12)}${esperado}).`,
      };
    }
    return { vacio: false, valido: true, codigo: limpio, mensaje: 'Código válido.' };
  }
  return {
    vacio: false,
    valido: false,
    codigo: '',
    mensaje: `El EAN-13 lleva 12 dígitos (el último se calcula) o 13. Tiene ${limpio.length}.`,
  };
}

/** Los 95 módulos del código: guarda, 6 dígitos, guarda central, 6 dígitos, guarda. */
export function patronEan13(codigo) {
  if (!/^\d{13}$/.test(codigo)) throw new Error('El EAN-13 debe tener 13 dígitos.');
  const paridad = PARIDAD[Number(codigo[0])];
  let patron = '101';
  for (let i = 1; i <= 6; i += 1) {
    const conjunto = paridad[i - 1] === 'A' ? CONJUNTO_A : CONJUNTO_B;
    patron += conjunto[Number(codigo[i])];
  }
  patron += '01010';
  for (let i = 7; i <= 12; i += 1) patron += CONJUNTO_C[Number(codigo[i])];
  return patron + '101';
}

/** Índices de los módulos que pertenecen a las guardas (barras más largas). */
const esGuarda = (i) => i < 3 || (i >= 45 && i < 50) || i >= 92;

/** Ancho total (mm) del código con sus márgenes en blanco. */
export function anchoEan13(magnificacion) {
  return (EAN13.margenIzquierdo + EAN13.modulos + EAN13.margenDerecho) * EAN13.moduloMm * magnificacion;
}

/**
 * Elementos para dibujar el código.
 * @param {string} codigo   13 dígitos válidos.
 * @param {number} x        Borde izquierdo, incluido el margen en blanco (mm).
 * @param {number} y        Borde superior de las barras (mm).
 * @param {number} magnificacion  1 = 100 % (módulo de 0,33 mm).
 * @param {number} altoBarras     Alto de las barras normales (mm).
 * @param {{ancho: (texto:string, pt:number, negrita:boolean) => number}} medidor
 * @returns {{elementos: object[], ancho: number, alto: number}}
 */
export function maquetarEan13(codigo, x, y, magnificacion, altoBarras, medidor) {
  const modulo = EAN13.moduloMm * magnificacion;
  const patron = patronEan13(codigo);
  const xBarras = x + EAN13.margenIzquierdo * modulo;
  const extraGuarda = 5 * modulo;
  const elementos = [];

  // Une módulos negros consecutivos del mismo tipo en un solo rectángulo.
  let i = 0;
  while (i < patron.length) {
    if (patron[i] !== '1') {
      i += 1;
      continue;
    }
    const guarda = esGuarda(i);
    let fin = i;
    while (fin + 1 < patron.length && patron[fin + 1] === '1' && esGuarda(fin + 1) === guarda) fin += 1;
    elementos.push({
      tipo: 'relleno',
      x: xBarras + i * modulo,
      y,
      ancho: (fin - i + 1) * modulo,
      alto: altoBarras + (guarda ? extraGuarda : 0),
    });
    i = fin + 1;
  }

  // Números legibles: el primero fuera de la guarda, luego dos grupos de 6
  // centrados bajo cada mitad (entre las guardas, que bajan más).
  const pt = 7.5 * magnificacion;
  const base = y + altoBarras + pt * PT_A_MM * 0.9;
  const texto = (contenido, xCentro) => ({
    tipo: 'texto',
    x: xCentro - medidor.ancho(contenido, pt, false) / 2,
    y: base,
    pt,
    tramos: [{ texto: contenido, negrita: false, x: 0 }],
  });
  elementos.push(texto(codigo[0], x + (EAN13.margenIzquierdo - 3.5) * modulo));
  elementos.push(texto(codigo.slice(1, 7), xBarras + 24 * modulo));
  elementos.push(texto(codigo.slice(7), xBarras + 71 * modulo));

  return {
    elementos,
    ancho: anchoEan13(magnificacion),
    alto: altoBarras + Math.max(extraGuarda, pt * PT_A_MM * 1.05),
  };
}
