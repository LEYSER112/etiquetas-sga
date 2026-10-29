import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictogramasDesdeH, palabraDesdeH } from '../src/core/reglas-sga.js';

test('corrosivo + medio ambiente', () => {
  assert.deepEqual(pictogramasDesdeH(['H314', 'H400']), ['GHS05', 'GHS09']);
});

test('con calavera no va el signo de exclamación', () => {
  assert.deepEqual(pictogramasDesdeH(['H301', 'H315', 'H335']), ['GHS06']);
});

test('con corrosivo no va exclamación por irritación, pero sí por H335', () => {
  assert.deepEqual(pictogramasDesdeH(['H314', 'H315', 'H319']), ['GHS05']);
  assert.deepEqual(pictogramasDesdeH(['H314', 'H319', 'H335']), ['GHS05', 'GHS07']);
});

test('con sensibilización respiratoria no va exclamación por sensibilización cutánea', () => {
  assert.deepEqual(pictogramasDesdeH(['H334', 'H317']), ['GHS08']);
});

test('H241 lleva explosivo e inflamable; H227 no lleva pictograma', () => {
  assert.deepEqual(pictogramasDesdeH(['H241']), ['GHS01', 'GHS02']);
  assert.deepEqual(pictogramasDesdeH(['H227', 'H303', 'H412']), []);
});

test('variantes H360FD y combinaciones H300+H310', () => {
  assert.deepEqual(pictogramasDesdeH(['H360FD']), ['GHS08']);
  assert.deepEqual(pictogramasDesdeH(['H300+H310']), ['GHS06']);
});

test('palabra de advertencia', () => {
  assert.equal(palabraDesdeH(['H315', 'H319']), 'Atención');
  assert.equal(palabraDesdeH(['H315', 'H318']), 'Peligro');
  assert.equal(palabraDesdeH([]), '');
});
