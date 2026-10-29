import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from '../vendor/pdf-lib/pdf-lib.esm.min.js';
import { formatosCandidatos, elegirFormato } from '../src/core/ajuste-tamano.js';
import { PT_A_MM } from '../src/core/diseno-etiqueta.js';
import { textoAFrases } from '../src/core/frases.js';

const pdf = await PDFDocument.create();
const normal = await pdf.embedFont(StandardFonts.Helvetica);
const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
const medidor = { ancho: (t, pt, n) => (n ? negrita : normal).widthOfTextAtSize(t, pt) * PT_A_MM };

const datos = (h, p, pictogramas) => ({
  nombreProducto: 'Producto de prueba',
  palabraAdvertencia: 'Peligro',
  pictogramas,
  frasesH: textoAFrases(h.join('\n'), 'H'),
  frasesP: textoAFrases(p.join('\n'), 'P'),
  telefonoEmergencia: 'CISPROQUIM 01 8000 916012',
  contenido: '20 L',
});

test('candidatos: desde el mínimo de la norma y horizontal primero', () => {
  const c = formatosCandidatos({ capacidadL: 20 });
  assert.deepEqual(
    c.map((f) => `${f.id}-${f.orientacion}`),
    ['A7-horizontal', 'A7-vertical', 'A6-horizontal', 'A6-vertical', 'A5-horizontal', 'A5-vertical'],
  );
  assert.deepEqual([c[0].anchoMm, c[0].altoMm], [105, 74]);
});

test('candidatos: sin capacidad empieza en A8; con tamaño y orientación fijos hay uno solo', () => {
  assert.equal(formatosCandidatos({ capacidadL: null })[0].id, 'A8');
  assert.equal(formatosCandidatos({ capacidadL: 20, tamano: 'A6', orientacion: 'vertical' }).length, 1);
});

test('texto corto: se queda en el tamaño mínimo horizontal', () => {
  const { formato, diseno } = elegirFormato(
    datos(['H315'], ['P280'], ['GHS07']),
    formatosCandidatos({ capacidadL: 20 }),
    medidor,
  );
  assert.equal(`${formato.id}-${formato.orientacion}`, 'A7-horizontal');
  assert.equal(diseno.desborde, false);
});

test('texto largo: sube de tamaño hasta que todo cabe', () => {
  const h = ['H225', 'H301', 'H311', 'H314', 'H331', 'H351', 'H373', 'H410'];
  const p = [
    'P201',
    'P210',
    'P233',
    'P240',
    'P241',
    'P260',
    'P273',
    'P280',
    'P301+P310',
    'P303+P361+P353',
    'P304+P340',
    'P305+P351+P338',
    'P308+P313',
    'P370+P378',
    'P403+P233',
    'P405',
    'P501',
  ];
  const { formato, diseno } = elegirFormato(
    datos(h, p, ['GHS02', 'GHS05', 'GHS06', 'GHS08', 'GHS09']),
    formatosCandidatos({ capacidadL: 20 }),
    medidor,
  );
  assert.notEqual(formato.id, 'A7');
  assert.equal(diseno.desborde, false);
  assert.ok(diseno.tamanoCuerpoPt >= 5);
});
