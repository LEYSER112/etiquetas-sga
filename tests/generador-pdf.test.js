import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from '../vendor/pdf-lib/pdf-lib.esm.min.js';
import { generarPdf } from '../src/services/generador-pdf.js';
import { obtenerTamano } from '../src/config/tamanos-etiqueta.js';
import { validarEtiqueta } from '../src/core/validaciones.js';

// PNG blanco de 1x1 px: en Node no hay canvas para convertir los SVG.
const PNG_VACIO = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);
const obtenerPictograma = async () => PNG_VACIO;

const datosBase = {
  nombreProducto: 'Hipoclorito de sodio al 15%',
  palabraAdvertencia: 'Peligro',
  pictogramas: ['GHS05', 'GHS09'],
  frasesH: [
    { codigo: 'H314', texto: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
    { codigo: 'H400', texto: 'Muy tóxico para los organismos acuáticos.' },
  ],
  frasesP: [{ codigo: 'P280', texto: 'Llevar guantes, prendas, gafas y máscara de protección.' }],
  telefonoEmergencia: '01 8000 916012',
  capacidadL: 20,
  tamanoId: 'A7',
};

const mm = (pt) => (pt * 25.4) / 72;

test('la página mide exactamente 74 x 105 mm', async () => {
  const t = obtenerTamano('A7');
  const { bytes, diseno } = await generarPdf(datosBase, t, { obtenerPictograma });
  const pdf = await PDFDocument.load(bytes);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(mm(width) - 74) < 0.01);
  assert.ok(Math.abs(mm(height) - 105) < 0.01);
  assert.equal(diseno.desborde, false);
});

test('los pictogramas tienen el lado de la norma', async () => {
  for (const id of ['A8', 'A7', 'A6', 'A5']) {
    const t = obtenerTamano(id);
    const { diseno } = await generarPdf(datosBase, t, { obtenerPictograma });
    const pictos = diseno.elementos.filter((e) => e.tipo === 'pictograma');
    assert.equal(pictos.length, 2);
    pictos.forEach((p) => assert.equal(p.lado, t.pictogramaMm));
    // Nada se sale de la etiqueta
    pictos.forEach((p) => assert.ok(p.x >= 0 && p.x + p.lado <= t.anchoMm + 1e-6));
  }
});

test('tres pictogramas caben en una fila en 74 mm', async () => {
  const datos = { ...datosBase, pictogramas: ['GHS02', 'GHS05', 'GHS09'] };
  const { diseno } = await generarPdf(datos, obtenerTamano('A7'), { obtenerPictograma });
  const ys = new Set(diseno.elementos.filter((e) => e.tipo === 'pictograma').map((e) => e.y));
  assert.equal(ys.size, 1);
});

test('modo hoja reparte copias en hojas carta', async () => {
  const { bytes } = await generarPdf(datosBase, obtenerTamano('A7'), {
    obtenerPictograma,
    modo: 'hoja',
    hoja: 'carta',
    copias: 10,
  });
  const pdf = await PDFDocument.load(bytes);
  // En carta caben 2 x 2 etiquetas de 74 x 105 mm
  assert.equal(pdf.getPageCount(), 3);
});

test('avisa cuando el texto no cabe', async () => {
  const largo = Array.from({ length: 40 }, (_, i) => ({
    codigo: `P${300 + i}`,
    texto: 'Texto muy largo '.repeat(6),
  }));
  const { diseno } = await generarPdf({ ...datosBase, frasesP: largo }, obtenerTamano('A8'), {
    obtenerPictograma,
  });
  assert.equal(diseno.desborde, true);
  assert.ok(diseno.avisos.some((a) => a.nivel === 'error'));
});

test('validación: pictograma faltante y tamaño menor al exigido', () => {
  const avisos = validarEtiqueta({ ...datosBase, pictogramas: ['GHS05'], capacidadL: 200, tamanoId: 'A7' });
  const textos = avisos.map((a) => a.mensaje).join('\n');
  assert.match(textos, /GHS09/);
  assert.match(textos, /105 x 148/);
});

test('validación: pictograma sin frase H que lo justifique', () => {
  const avisos = validarEtiqueta({ ...datosBase, pictogramas: ['GHS01', 'GHS05', 'GHS09'] });
  assert.ok(avisos.some((a) => a.mensaje.includes('GHS01')));
});

test('cuatro pictogramas en A8 van en zigzag sin salirse', async () => {
  const t = obtenerTamano('A8');
  const datos = { ...datosBase, pictogramas: ['GHS02', 'GHS07', 'GHS08', 'GHS09'] };
  const { diseno } = await generarPdf(datos, t, { obtenerPictograma });
  const pictos = diseno.elementos.filter((e) => e.tipo === 'pictograma');
  const alturas = new Set(pictos.map((p) => p.y));
  assert.equal(alturas.size, 2);
  assert.ok(Math.max(...pictos.map((p) => p.y)) - Math.min(...pictos.map((p) => p.y)) < t.pictogramaMm);
  pictos.forEach((p) => assert.ok(p.x >= 0 && p.x + p.lado <= t.anchoMm));
});

test('el cuadro del lote mide 32 x 15 mm y queda dentro de la etiqueta', async () => {
  for (const id of ['A8', 'A7', 'A6', 'A5']) {
    const t = obtenerTamano(id);
    const { diseno } = await generarPdf(datosBase, t, { obtenerPictograma });
    const cuadro = diseno.elementos.find((e) => e.tipo === 'rect' && e.guion);
    assert.equal(cuadro.ancho, 32);
    assert.equal(cuadro.alto, 15);
    assert.ok(cuadro.x + cuadro.ancho <= t.anchoMm && cuadro.y + cuadro.alto <= t.altoMm);
  }
});
