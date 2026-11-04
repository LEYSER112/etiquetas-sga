import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '../vendor/pdf-lib/pdf-lib.esm.min.js';
import { acomodarEnHojas } from '../src/core/acomodo-hoja.js';
import { generarHojasPdf } from '../src/services/generador-pdf.js';
import { HOJAS, IMPRESION } from '../src/config/empresa.js';

const opciones = { margen: IMPRESION.margenHojaMm, separacion: IMPRESION.separacionMm };
const repetir = (n, anchoMm, altoMm) => Array.from({ length: n }, () => ({ anchoMm, altoMm }));

/** Revisa que nada se salga de la hoja ni se monte, con la separación mínima. */
function verificar(hojas, hoja, { margen, separacion }) {
  for (const ubicaciones of hojas) {
    for (const u of ubicaciones) {
      assert.ok(u.x >= margen - 1e-6 && u.y >= margen - 1e-6, 'dentro del margen superior/izquierdo');
      assert.ok(u.x + u.ancho <= hoja.anchoMm - margen + 1e-6, 'dentro del margen derecho');
      assert.ok(u.y + u.alto <= hoja.altoMm - margen + 1e-6, 'dentro del margen inferior');
    }
    for (let i = 0; i < ubicaciones.length; i += 1) {
      for (let j = i + 1; j < ubicaciones.length; j += 1) {
        const a = ubicaciones[i];
        const b = ubicaciones[j];
        const separadas =
          a.x + a.ancho + separacion <= b.x + 1e-6 ||
          b.x + b.ancho + separacion <= a.x + 1e-6 ||
          a.y + a.alto + separacion <= b.y + 1e-6 ||
          b.y + b.alto + separacion <= a.y + 1e-6;
        assert.ok(separadas, 'etiquetas separadas al menos la separación mínima');
      }
    }
  }
}

test('A7 horizontal (105 x 74): 5 por hoja carta y 6 por oficio, mezclando giros', () => {
  const carta = acomodarEnHojas(repetir(5, 105, 74), HOJAS.carta, opciones);
  assert.equal(carta.length, 1);
  verificar(carta, HOJAS.carta, opciones);
  const oficio = acomodarEnHojas(repetir(6, 105, 74), HOJAS.oficio, opciones);
  assert.equal(oficio.length, 1);
  verificar(oficio, HOJAS.oficio, opciones);
});

test('sin giro caben menos (comparación)', () => {
  const sinGiro = acomodarEnHojas(repetir(5, 105, 74), HOJAS.carta, { ...opciones, permitirGiro: false });
  assert.ok(sinGiro.length > 1);
});

test('tamaños mezclados en oficio sin montarse', () => {
  const piezas = [...repetir(2, 148, 105), ...repetir(3, 105, 74), ...repetir(4, 74, 52)];
  for (const hoja of Object.values(HOJAS)) {
    const hojas = acomodarEnHojas(piezas, hoja, opciones);
    assert.equal(hojas.flat().length, piezas.length);
    verificar(hojas, hoja, opciones);
  }
});

test('una etiqueta que no cabe en la hoja da error claro', () => {
  assert.throws(
    () => acomodarEnHojas([{ anchoMm: 210, altoMm: 148 }], HOJAS.mediaCarta, opciones),
    /no cabe/,
  );
});

test('el PDF del grupo tiene el tamaño de la hoja y reparte las copias', async () => {
  const datos = {
    nombreProducto: 'Prueba',
    palabraAdvertencia: 'Atención',
    pictogramas: [],
    frasesH: [{ codigo: 'H315', texto: 'Provoca irritación cutánea.' }],
    frasesP: [{ codigo: 'P280', texto: 'Llevar guantes.' }],
  };
  const formato = { id: 'A7', orientacion: 'horizontal', anchoMm: 105, altoMm: 74, pictogramaMm: 23 };
  const { bytes, hojas, etiquetas } = await generarHojasPdf([{ datos, formato, copias: 8 }], {
    hoja: 'carta',
    obtenerPictograma: async () => new Uint8Array(),
  });
  assert.equal(etiquetas, 8);
  assert.equal(hojas, 2); // 5 + 3
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 612) < 0.5 && Math.abs(height - 792) < 0.5);
});
