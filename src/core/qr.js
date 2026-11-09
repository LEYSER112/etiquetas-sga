/**
 * Código QR a partir de un texto libre.
 *
 * - `validarQr` revisa el texto (vacío, demasiado largo).
 * - `matrizQr` devuelve la matriz de módulos (true = negro).
 * - `maquetarQr` devuelve los rectángulos en mm para dibujarlo.
 *
 * Se usa corrección de errores "M" (recupera ~15 % del código dañado), que
 * es el equilibrio habitual entre tamaño y resistencia a rayones o manchas.
 */
import qrcode from '../../vendor/qrcode-generator/qrcode.mjs';

// UTF-8 para que las tildes y la ñ se lean bien en cualquier celular.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

export const QR = Object.freeze({
  correccion: 'M',
  /** Margen en blanco alrededor del código, en módulos (la norma pide 4). */
  margenModulos: 4,
  /** Módulo mínimo recomendado para leerlo bien impreso (mm). */
  moduloMinMm: 0.33,
  /** Largo máximo permitido en el formulario (caracteres). */
  largoMax: 300,
});

/**
 * @param {string} texto
 * @returns {boolean[][]} Filas de módulos.
 */
export function matrizQr(texto) {
  const codigo = qrcode(0, QR.correccion);
  codigo.addData(texto);
  codigo.make();
  const n = codigo.getModuleCount();
  return Array.from({ length: n }, (_, fila) =>
    Array.from({ length: n }, (__, col) => codigo.isDark(fila, col)),
  );
}

/**
 * @param {string} texto
 * @returns {{vacio: boolean, valido: boolean, texto: string, modulos: number, mensaje: string}}
 */
export function validarQr(texto) {
  const limpio = (texto ?? '').trim();
  if (!limpio) return { vacio: true, valido: false, texto: '', modulos: 0, mensaje: '' };
  if ([...limpio].length > QR.largoMax) {
    return {
      vacio: false,
      valido: false,
      texto: '',
      modulos: 0,
      mensaje: `El texto del QR tiene ${[...limpio].length} caracteres; el máximo es ${QR.largoMax} para que se pueda leer impreso.`,
    };
  }
  try {
    const modulos = matrizQr(limpio).length;
    return {
      vacio: false,
      valido: true,
      texto: limpio,
      modulos,
      mensaje: `QR de ${modulos} x ${modulos} módulos (${[...limpio].length} caracteres).`,
    };
  } catch {
    return {
      vacio: false,
      valido: false,
      texto: '',
      modulos: 0,
      mensaje: 'El texto es demasiado largo para un QR.',
    };
  }
}

/** Lado mínimo (mm) para que el módulo no baje del recomendado, con su margen en blanco. */
export function ladoMinimoQr(modulos) {
  return (modulos + 2 * QR.margenModulos) * QR.moduloMinMm;
}

/**
 * Elementos para dibujar el QR, incluido su margen en blanco.
 * @param {string} texto
 * @param {number} x      Borde izquierdo del área (con margen) en mm.
 * @param {number} y      Borde superior del área (con margen) en mm.
 * @param {number} lado   Lado total del área en mm.
 * @returns {{elementos: object[], ancho: number, alto: number, moduloMm: number}}
 */
export function maquetarQr(texto, x, y, lado) {
  const matriz = matrizQr(texto);
  const n = matriz.length;
  const modulo = lado / (n + 2 * QR.margenModulos);
  const inicio = QR.margenModulos * modulo;
  const elementos = [];

  // Une los módulos negros consecutivos de cada fila en un solo rectángulo.
  matriz.forEach((fila, r) => {
    let c = 0;
    while (c < n) {
      if (!fila[c]) {
        c += 1;
        continue;
      }
      let fin = c;
      while (fin + 1 < n && fila[fin + 1]) fin += 1;
      elementos.push({
        tipo: 'relleno',
        x: x + inicio + c * modulo,
        y: y + inicio + r * modulo,
        ancho: (fin - c + 1) * modulo,
        // Un poco más alto para que no queden líneas blancas entre filas al imprimir.
        alto: modulo + 0.01,
      });
      c = fin + 1;
    }
  });

  return { elementos, ancho: lado, alto: lado, moduloMm: modulo };
}
