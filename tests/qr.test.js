import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarQr, matrizQr, maquetarQr, ladoMinimoQr, QR } from '../src/core/qr.js';
import { generarPdf } from '../src/services/generador-pdf.js';
import { obtenerTamano } from '../src/config/tamanos-etiqueta.js';
import { validarEtiqueta } from '../src/core/validaciones.js';

const obtenerPictograma = async () => new Uint8Array();
const datosBase = {
  nombreProducto: 'Hipoclorito de sodio al 15%',
  palabraAdvertencia: 'Peligro',
  pictogramas: [],
  frasesH: [{ codigo: 'H314', texto: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' }],
  frasesP: [{ codigo: 'P280', texto: 'Llevar guantes, prendas, gafas y máscara de protección.' }],
  capacidadL: 20,
  tamanoId: 'A6',
};

test('validación del texto del QR', () => {
  assert.equal(validarQr('   ').vacio, true);
  const ok = validarQr('  MP-0158 Hipoclorito de sodio ñ  ');
  assert.equal(ok.valido, true);
  assert.equal(ok.texto, 'MP-0158 Hipoclorito de sodio ñ');
  assert.ok(ok.modulos >= 21);
  assert.equal(validarQr('x'.repeat(QR.largoMax + 1)).valido, false);
});

test('la matriz es cuadrada y crece con el texto', () => {
  const corto = matrizQr('MP-0158');
  const largo = matrizQr('https://ejemplo.com/fds/'.repeat(5));
  assert.equal(corto.length, corto[0].length);
  assert.ok(largo.length > corto.length);
});

test('maquetarQr respeta el margen en blanco y el lado pedido', () => {
  const lado = 20;
  const { elementos, moduloMm } = maquetarQr('MP-0158', 10, 10, lado);
  const margen = QR.margenModulos * moduloMm;
  for (const r of elementos) {
    assert.ok(r.x >= 10 + margen - 1e-6 && r.y >= 10 + margen - 1e-6);
    assert.ok(r.x + r.ancho <= 10 + lado - margen + 1e-6);
  }
  assert.ok(ladoMinimoQr(21) < lado);
});

test('el QR se dibuja dentro del recuadro de emergencias y no se mezcla con el EAN', async () => {
  const datos = { ...datosBase, qr: 'MP-0158 | Hipoclorito de sodio al 15%', ean13: '' };
  const { diseno } = await generarPdf(datos, obtenerTamano('A6'), { obtenerPictograma });
  const recuadro = diseno.elementos.find((e) => e.tipo === 'rect' && e.grosor === 0.4);
  const modulos = diseno.elementos.filter((e) => e.tipo === 'relleno').slice(1); // el primero es el título
  assert.ok(modulos.length > 50);
  for (const m of modulos) {
    assert.ok(m.x >= recuadro.x && m.x + m.ancho <= recuadro.x + recuadro.ancho + 1e-6);
    assert.ok(m.y >= recuadro.y && m.y + m.alto <= recuadro.y + recuadro.alto + 0.02);
  }
  // Sin dígitos de EAN debajo
  assert.ok(!diseno.elementos.some((e) => e.tipo === 'texto' && /^\d{6}$/.test(e.tramos[0].texto)));
});

test('validación: QR demasiado largo es error; vacío no', () => {
  const largo = validarEtiqueta({ ...datosBase, codigoTipo: 'qr', qrTexto: 'x'.repeat(400) });
  assert.ok(largo.some((a) => a.nivel === 'error' && a.mensaje.includes('QR')));
  const vacio = validarEtiqueta({ ...datosBase, codigoTipo: 'qr', qrTexto: '' });
  assert.ok(!vacio.some((a) => a.mensaje.includes('QR')));
  // Con QR elegido, un EAN viejo inválido no molesta
  const mezcla = validarEtiqueta({ ...datosBase, codigoTipo: 'qr', qrTexto: 'ok', ean13Texto: '123' });
  assert.ok(!mezcla.some((a) => a.mensaje.includes('barras')));
});
