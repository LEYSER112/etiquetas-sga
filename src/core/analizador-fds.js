/**
 * Analizador de Fichas de Datos de Seguridad (FDS / hojas de seguridad).
 * Recibe el texto plano del PDF y devuelve los datos para la etiqueta.
 *
 * Las FDS no tienen un formato único, así que todo lo que se extrae aquí
 * es una propuesta que el usuario revisa antes de imprimir.
 */
import { normalizarTextoFds, compactar, claveComparacion } from './texto.js';
import { extraerCodigosH, extraerCodigosP, construirFrases } from './frases.js';
import { pictogramasDesdeH, palabraDesdeH } from './reglas-sga.js';

/** Títulos con los que suelen empezar las secciones 1 a 4 de una FDS. */
const TITULOS_SECCION = {
  1: 'identificaci[oó]n\\s+(?:del|de\\s+la|de)\\s+(?:producto|sustancia|mezcla|empresa)',
  2: 'identificaci[oó]n\\s+(?:de\\s+los|del|de\\s+las|de)\\s+peligros?',
  3: 'composici[oó]n',
  4: 'primeros\\s+auxilios',
};

/**
 * Busca dónde empieza la sección `n` de la FDS.
 * @returns {number} posición o -1
 */
function inicioSeccion(texto, n, desde = 0) {
  const resto = texto.slice(desde);
  const patrones = [
    new RegExp(`^[ \\t]*(?:secci[oó]n|section|cap[ií]tulo)\\s*${n}(?!\\d)`, 'im'),
    new RegExp(`^[ \\t]*${n}\\s*[.):\\-]?\\s*(?:${TITULOS_SECCION[n] ?? '\\p{Lu}{4,}'})`, 'imu'),
  ];
  const posiciones = patrones
    .map((p) => p.exec(resto))
    .filter(Boolean)
    .map((m) => m.index + desde);
  return posiciones.length ? Math.min(...posiciones) : -1;
}

/** Texto de la sección `n` (hasta donde empieza la siguiente). */
export function extraerSeccion(texto, n) {
  const inicio = inicioSeccion(texto, n);
  if (inicio < 0) return '';
  const fin = inicioSeccion(texto, n + 1, inicio + 5);
  return texto.slice(inicio, fin > inicio ? fin : undefined);
}

/** Líneas que son títulos de sección y no campos. */
const esEncabezado = (linea) =>
  /^\s*(?:secci[oó]n|section|cap[ií]tulo)\s*\d/i.test(linea) ||
  /^\s*\d{1,2}\s*[.):-]?\s*\p{Lu}{5,}\s+\p{Lu}/u.test(linea);

/** Toma el valor de "Etiqueta: valor" o, si está vacío, la línea siguiente. */
function valorDeCampo(texto, patronEtiqueta) {
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i += 1) {
    if (esEncabezado(lineas[i])) continue;
    const m = patronEtiqueta.exec(lineas[i]);
    if (!m) continue;
    let valor = lineas[i].slice(m.index + m[0].length);
    valor = valor.replace(/^[\s:.\-–]+/, '');
    // Si la línea trae varias "celdas" separadas por espacios largos, tomar la primera.
    valor = valor.split(/\s{3,}|\s\|\s/)[0];
    if (compactar(valor).length < 2 && i + 1 < lineas.length) {
      valor = lineas[i + 1].split(/\s{3,}|\s\|\s/)[0];
    }
    valor = compactar(valor);
    if (valor.length >= 2) return valor;
  }
  return '';
}

const CAMPOS_NOMBRE = [
  /nombre\s+(?:comercial|del\s+producto|de\s+la\s+sustancia|de\s+la\s+mezcla|qu[ií]mico)\b/i,
  /identificador\s+(?:sga\s+)?del\s+producto\b/i,
  /^\s*producto\b/i,
  /^\s*nombre\b/i,
];

const PALABRAS_NO_NOMBRE = /^(?:ficha|hoja|fds|msds|sds|de datos|secci[oó]n|versi[oó]n|fecha|p[aá]gina)/i;

/** Nombre del producto. */
export function extraerNombre(texto) {
  const seccion1 = extraerSeccion(texto, 1) || texto.slice(0, 4000);
  for (const patron of CAMPOS_NOMBRE) {
    const valor = valorDeCampo(seccion1, patron);
    if (valor && !PALABRAS_NO_NOMBRE.test(valor)) return limpiarNombre(valor);
  }
  return '';
}

function limpiarNombre(nombre) {
  return nombre
    .replace(/\s*(?:c[oó]digo|referencia|ref\.|n[uú]mero cas|cas)\b.*$/i, '')
    .replace(/[;,]+$/, '')
    .trim();
}

/** Palabra de advertencia escrita en la FDS. */
export function extraerPalabraAdvertencia(texto) {
  const m =
    /palabra\s+(?:de\s+)?(?:advertencia|se[ñn]al)[^\n]{0,20}?[:.\-–]?\s*(?:\n\s*)?(peligro|atenci[oó]n|ninguna|no\s+aplica|n\/a)/i.exec(
      texto,
    );
  if (!m) return null;
  const valor = claveComparacion(m[1]);
  if (valor.startsWith('peligro')) return 'Peligro';
  if (valor.startsWith('atencion')) return 'Atención';
  return '';
}

/** Pictogramas mencionados por código en el texto (GHS05, SGA05...). */
export function extraerPictogramasMencionados(texto) {
  const codigos = new Set();
  for (const m of texto.matchAll(/\b(?:GHS|SGA)\s*-?\s*0?([1-9])\b/g)) codigos.add(`GHS0${m[1]}`);
  return [...codigos].sort();
}

// Teléfono: grupos de dígitos separados por un espacio, punto o guion, con
// indicativo opcional ("+57", "(601)"). Se exigen entre 7 y 15 dígitos.
const PATRON_TELEFONO = /(?:\+\d{1,3}\s?)?(?:\(\d{1,4}\)\s?)?\d+(?:[ .-]\d+)*/g;
const PARECE_FECHA = /^\d{1,4}[-./]\d{1,2}[-./]\d{1,4}$/;

/** Todos los números telefónicos de un fragmento de texto, sin repetir. */
export function extraerTelefonos(fragmento) {
  const telefonos = [];
  for (const m of fragmento.matchAll(PATRON_TELEFONO)) {
    const telefono = compactar(m[0]);
    const digitos = telefono.replace(/\D/g, '').length;
    if (digitos < 7 || digitos > 15 || PARECE_FECHA.test(telefono)) continue;
    if (!telefonos.includes(telefono)) telefonos.push(telefono);
  }
  return telefonos;
}

// Una línea que continúa la información telefónica de la anterior.
const CONTINUA_TELEFONO = /^\s*(?:[(+\d]|l[ií]nea|bogot[aá]|nacional|fuera|resto|celular|whats)/i;

/**
 * Teléfono de emergencia. Primero busca CISPROQUIM (línea de emergencias
 * químicas en Colombia) y sus números; si la FDS no lo menciona, toma el
 * "teléfono de emergencia" que traiga.
 * @returns {{telefono: string, esCisproquim: boolean}}
 */
export function extraerTelefonoEmergencia(texto) {
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i += 1) {
    if (!/cisproquim/i.test(lineas[i])) continue;
    let numeros = extraerTelefonos(lineas[i]);
    const siguiente = lineas[i + 1] ?? '';
    if (!numeros.length || CONTINUA_TELEFONO.test(siguiente)) {
      numeros = [...numeros, ...extraerTelefonos(siguiente)];
    }
    if (!numeros.length) numeros = extraerTelefonos(lineas[i - 1] ?? '');
    if (numeros.length) {
      return { telefono: `CISPROQUIM ${[...new Set(numeros)].join(' - ')}`, esCisproquim: true };
    }
  }

  const emergencia =
    /(?:tel[eé]fono|n[uú]mero|l[ií]nea|tel\.?)\s+(?:de\s+)?(?:emergencias?|urgencias?)[^\n]*(?:\n[^\n]*)?/i.exec(
      texto,
    );
  const numeros = emergencia ? extraerTelefonos(emergencia[0]).slice(0, 2) : [];
  return { telefono: numeros.join(' - '), esCisproquim: false };
}

/**
 * Analiza el texto completo de una FDS.
 * @param {string} textoBruto
 */
export function analizarFds(textoBruto) {
  const texto = normalizarTextoFds(textoBruto ?? '');
  const avisos = [];

  if (compactar(texto).length < 200) {
    avisos.push({
      nivel: 'error',
      mensaje:
        'El PDF casi no tiene texto. Puede ser un documento escaneado: diligencie los datos manualmente.',
    });
  }

  // Las frases se toman de la sección 2. Las secciones 3 y 16 suelen listar
  // frases de los componentes que NO van en la etiqueta de la mezcla.
  let seccion2 = extraerSeccion(texto, 2);
  if (!seccion2 || extraerCodigosH(seccion2).length + extraerCodigosP(seccion2).length === 0) {
    if (texto.length > 200) {
      avisos.push({
        nivel: 'advertencia',
        mensaje:
          'No se encontró la Sección 2 (Identificación de peligros). Las frases se tomaron de todo el documento: revíselas.',
      });
    }
    seccion2 = texto;
  }

  const codigosH = extraerCodigosH(seccion2);
  const codigosP = extraerCodigosP(seccion2);
  const frasesH = construirFrases(codigosH, 'H', seccion2);
  const frasesP = construirFrases(codigosP, 'P', seccion2);

  const pictogramasPorReglas = pictogramasDesdeH(codigosH);
  const pictogramasMencionados = extraerPictogramasMencionados(seccion2);
  const pictogramas = pictogramasPorReglas.length ? pictogramasPorReglas : pictogramasMencionados;

  const faltantes = pictogramasMencionados.filter((p) => !pictogramasPorReglas.includes(p));
  if (pictogramasPorReglas.length && faltantes.length) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: `La FDS menciona ${faltantes.join(', ')}, pero sus frases H no lo exigen. Verifique.`,
    });
  }

  let palabraAdvertencia = extraerPalabraAdvertencia(seccion2) ?? extraerPalabraAdvertencia(texto);
  if (palabraAdvertencia === null) {
    palabraAdvertencia = palabraDesdeH(codigosH);
    if (palabraAdvertencia) {
      avisos.push({
        nivel: 'info',
        mensaje: `La palabra de advertencia no aparece en la FDS; se dedujo "${palabraAdvertencia}" a partir de las frases H.`,
      });
    }
  }

  const nombreProducto = extraerNombre(texto);
  if (!nombreProducto) {
    avisos.push({
      nivel: 'advertencia',
      mensaje: 'No se encontró el nombre del producto. Escríbalo manualmente.',
    });
  }
  if (codigosH.length === 0) {
    avisos.push({
      nivel: 'info',
      mensaje: 'No se encontraron frases H. Si el producto no es peligroso, la etiqueta lo indicará.',
    });
  }

  const emergencia = extraerTelefonoEmergencia(texto);
  if (emergencia.telefono && !emergencia.esCisproquim) {
    avisos.push({
      nivel: 'info',
      mensaje: 'La FDS no menciona CISPROQUIM; se tomó el teléfono de emergencia que trae.',
    });
  }

  return {
    nombreProducto,
    palabraAdvertencia,
    frasesH,
    frasesP,
    pictogramas,
    telefonoEmergencia: emergencia.telefono,
    avisos,
  };
}
