/**
 * Reconstruye líneas de texto a partir de los fragmentos que entrega pdf.js.
 * pdf.js devuelve trozos sueltos con su posición; aquí se agrupan por renglón
 * y se separan las "columnas" de las tablas con tres espacios.
 */

/**
 * @param {{str:string, transform:number[], width:number, hasEOL?:boolean}[]} items
 * @returns {string}
 */
export function reconstruirLineas(items) {
  const fragmentos = items
    .filter((it) => typeof it.str === 'string' && it.str.length > 0)
    .map((it) => {
      const [a, b, , , x, y] = it.transform;
      return { texto: it.str, x, y, ancho: it.width ?? 0, tamano: Math.hypot(a, b) || 10 };
    });

  // Ordenar de arriba hacia abajo y de izquierda a derecha
  fragmentos.sort((p, q) => q.y - p.y || p.x - q.x);

  /** @type {{y:number, tamano:number, partes:typeof fragmentos}[]} */
  const renglones = [];
  for (const f of fragmentos) {
    const renglon = renglones.find((r) => Math.abs(r.y - f.y) < Math.max(r.tamano, f.tamano) * 0.45);
    if (renglon) renglon.partes.push(f);
    else renglones.push({ y: f.y, tamano: f.tamano, partes: [f] });
  }
  renglones.sort((p, q) => q.y - p.y);

  return renglones
    .map((r) => {
      const partes = r.partes.sort((p, q) => p.x - q.x);
      let linea = '';
      let finAnterior = null;
      for (const p of partes) {
        if (finAnterior !== null) {
          const hueco = p.x - finAnterior;
          if (hueco > p.tamano * 2) linea += '   ';
          else if (hueco > p.tamano * 0.12 && !linea.endsWith(' ') && !p.texto.startsWith(' ')) linea += ' ';
        }
        linea += p.texto;
        finAnterior = p.x + p.ancho;
      }
      return linea.replace(/[ \t]+$/, '');
    })
    .join('\n');
}
