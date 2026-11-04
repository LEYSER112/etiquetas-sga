import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarEan13,
  digitoControlEan13,
  patronEan13,
  anchoEan13,
  maquetarEan13,
} from '../src/core/ean13.js';

const medidor = { ancho: (t, pt) => t.length * pt * 0.2 };

test('calcula el dígito de control', () => {
  assert.equal(digitoControlEan13('770123456789'), '7');
  assert.equal(digitoControlEan13('400638133393'), '1');
  assert.equal(digitoControlEan13('590123412345'), '7');
});

test('con 12 dígitos completa el código', () => {
  const r = validarEan13('7701234 56789');
  assert.equal(r.valido, true);
  assert.equal(r.codigo, '7701234567897');
});

test('con 13 dígitos verifica el dígito de control', () => {
  assert.equal(validarEan13('4006381333931').valido, true);
  const malo = validarEan13('4006381333932');
  assert.equal(malo.valido, false);
  assert.match(malo.mensaje, /terminar en 1/);
});

test('vacío no es error; letras o largo incorrecto sí', () => {
  assert.deepEqual(validarEan13('  '), { vacio: true, valido: false, codigo: '', mensaje: '' });
  assert.equal(validarEan13('77012345ABC12').valido, false);
  assert.match(validarEan13('12345').mensaje, /Tiene 5/);
});

test('patrón de 95 módulos con guardas correctas (referencia GS1 5901234123457)', () => {
  const p = patronEan13('5901234123457');
  assert.equal(p.length, 95);
  assert.equal(p.slice(0, 3), '101');
  assert.equal(p.slice(45, 50), '01010');
  assert.equal(p.slice(92), '101');
  // Dígito 9 en conjunto A, 0 en B (paridad de 5 = ABBAAB)
  assert.equal(p.slice(3, 10), '0001011');
  assert.equal(p.slice(10, 17), '0100111');
  // Último dígito (7) en conjunto C
  assert.equal(p.slice(85, 92), '1000100');
});

test('medidas: 37,29 mm al 100 % y 29,83 mm al 80 %', () => {
  assert.ok(Math.abs(anchoEan13(1) - 37.29) < 0.01);
  assert.ok(Math.abs(anchoEan13(0.8) - 29.83) < 0.01);
});

test('las barras dibujadas suman 30 barras y las guardas son más largas', () => {
  const { elementos } = maquetarEan13('5901234123457', 0, 0, 1, 15, medidor);
  const barras = elementos.filter((e) => e.tipo === 'relleno');
  const modulos = barras.reduce((s, b) => s + Math.round(b.ancho / 0.33), 0);
  assert.equal(modulos, [...patronEan13('5901234123457')].filter((b) => b === '1').length);
  assert.ok(Math.max(...barras.map((b) => b.alto)) > 15);
  assert.equal(elementos.filter((e) => e.tipo === 'texto').length, 3);
});
