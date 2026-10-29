import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoAFrases, frasesATexto, textoFraseP, extraerCodigosP } from '../src/core/frases.js';

test('una línea con solo el código se completa con el catálogo', () => {
  assert.deepEqual(textoAFrases('H314', 'H'), [
    { codigo: 'H314', texto: 'Provoca quemaduras graves en la piel y lesiones oculares graves.' },
  ]);
});

test('respeta el texto que escribe el usuario', () => {
  assert.deepEqual(textoAFrases('P280 Usar guantes de nitrilo.', 'P'), [
    { codigo: 'P280', texto: 'Usar guantes de nitrilo.' },
  ]);
});

test('normaliza combinaciones escritas con espacios', () => {
  const [frase] = textoAFrases('P302 + 352', 'P');
  assert.equal(frase.codigo, 'P302+P352');
  assert.equal(frase.texto, 'EN CASO DE CONTACTO CON LA PIEL: Lavar con abundante agua.');
});

test('líneas sin código quedan como texto libre', () => {
  assert.deepEqual(textoAFrases('Mantener tapado\n\n', 'P'), [{ codigo: '', texto: 'Mantener tapado' }]);
});

test('ida y vuelta texto <-> frases', () => {
  const frases = [{ codigo: 'H225', texto: 'Líquido y vapores muy inflamables.' }];
  assert.deepEqual(textoAFrases(frasesATexto(frases), 'H'), frases);
});

test('combinación con redacción propia', () => {
  assert.equal(
    textoFraseP('P362+P364'),
    'Quitar las prendas contaminadas y lavarlas antes de volver a usarlas.',
  );
});

test('extrae combinaciones sin la letra P en las partes', () => {
  assert.deepEqual(extraerCodigosP('P305+351+338 texto P102'), ['P305+P351+P338', 'P102']);
});
