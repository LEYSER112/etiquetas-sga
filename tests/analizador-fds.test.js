import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analizarFds, extraerSeccion, extraerTelefonoEmergencia } from '../src/core/analizador-fds.js';
import { normalizarTextoFds } from '../src/core/texto.js';

const fds = readFileSync(new URL('./fixtures/fds-hipoclorito.txt', import.meta.url), 'utf8');

test('extrae el nombre del producto sin el código', () => {
  assert.equal(analizarFds(fds).nombreProducto, 'HIPOCLORITO DE SODIO AL 15%');
});

test('toma solo las frases H de la sección 2 (ignora secciones 3 y 16)', () => {
  const codigos = analizarFds(fds).frasesH.map((f) => f.codigo);
  assert.deepEqual(codigos, ['H290', 'H314', 'H400']);
});

test('normaliza el texto de las frases H con el catálogo', () => {
  const h400 = analizarFds(fds).frasesH.find((f) => f.codigo === 'H400');
  assert.equal(h400.texto, 'Muy tóxico para los organismos acuáticos.');
});

test('agrupa las combinaciones P y elimina las sueltas que ya contienen', () => {
  const codigos = analizarFds(fds).frasesP.map((f) => f.codigo);
  assert.deepEqual(codigos, [
    'P260',
    'P280',
    'P301+P330+P331',
    'P303+P361+P353',
    'P305+P351+P338',
    'P310',
    'P405',
    'P501',
  ]);
});

test('arma el texto de una combinación P', () => {
  const p = analizarFds(fds).frasesP.find((f) => f.codigo === 'P301+P330+P331');
  assert.equal(p.texto, 'EN CASO DE INGESTIÓN: Enjuagarse la boca. NO provocar el vómito.');
});

test('palabra de advertencia y pictogramas', () => {
  const r = analizarFds(fds);
  assert.equal(r.palabraAdvertencia, 'Peligro');
  assert.deepEqual(r.pictogramas, ['GHS05', 'GHS09']);
});

test('extrae el teléfono de CISPROQUIM', () => {
  assert.equal(analizarFds(fds).telefonoEmergencia, 'CISPROQUIM 01 8000 916012');
});

test('CISPROQUIM con varios números y en la línea siguiente', () => {
  assert.deepEqual(
    extraerTelefonoEmergencia('Teléfono de emergencia: CISPROQUIM\n018000916012 - (601) 2886012 (24 horas)'),
    { telefono: 'CISPROQUIM 018000916012 - (601) 2886012', esCisproquim: true },
  );
  assert.equal(
    extraerTelefonoEmergencia('CISPROQUIM (Colombia): 01 8000 916012 / Bogotá: (601) 288 6012').telefono,
    'CISPROQUIM 01 8000 916012 - (601) 288 6012',
  );
});

test('sin CISPROQUIM usa el teléfono de emergencia de la FDS', () => {
  assert.deepEqual(extraerTelefonoEmergencia('Teléfono de emergencia: +57 604 444 1234\nFecha: 2024-05-10'), {
    telefono: '+57 604 444 1234',
    esCisproquim: false,
  });
});

test('delimita la sección 2', () => {
  const s2 = extraerSeccion(normalizarTextoFds(fds), 2);
  assert.match(s2, /^SECCIÓN 2/);
  assert.doesNotMatch(s2, /SECCIÓN 3/);
});

test('sin sección 2 usa todo el texto y avisa', () => {
  const texto = `Nombre comercial: ALCOHOL ETÍLICO 70%\n${'x '.repeat(120)}\nH225 Líquido y vapores muy inflamables.\nH319\nP210`;
  const r = analizarFds(texto);
  assert.deepEqual(
    r.frasesH.map((f) => f.codigo),
    ['H225', 'H319'],
  );
  assert.deepEqual(r.pictogramas, ['GHS02', 'GHS07']);
  assert.equal(r.palabraAdvertencia, 'Peligro');
  assert.ok(r.avisos.some((a) => a.mensaje.includes('Sección 2')));
});

test('PDF sin texto genera error', () => {
  const r = analizarFds('   ');
  assert.equal(r.avisos[0].nivel, 'error');
});

test('reconoce H360FD y H361d sin duplicar el código base', () => {
  const texto = `SECCIÓN 2: IDENTIFICACIÓN DE LOS PELIGROS\nH360FD\nH361d Se sospecha\nSECCIÓN 3: COMPOSICIÓN\n${'x '.repeat(120)}`;
  assert.deepEqual(
    analizarFds(texto).frasesH.map((f) => f.codigo),
    ['H360FD', 'H361d'],
  );
});
