/**
 * Catálogo de los 9 pictogramas del SGA.
 * Los archivos SVG están en /assets/pictogramas y pueden reemplazarse por los
 * oficiales de la ONU manteniendo el mismo nombre de archivo.
 */
export const PICTOGRAMAS = Object.freeze([
  { codigo: 'GHS01', nombre: 'Explosivo', archivo: 'assets/pictogramas/ghs01-explosivo.svg' },
  { codigo: 'GHS02', nombre: 'Inflamable', archivo: 'assets/pictogramas/ghs02-inflamable.svg' },
  { codigo: 'GHS03', nombre: 'Comburente', archivo: 'assets/pictogramas/ghs03-comburente.svg' },
  { codigo: 'GHS04', nombre: 'Gas a presión', archivo: 'assets/pictogramas/ghs04-gas-presion.svg' },
  { codigo: 'GHS05', nombre: 'Corrosivo', archivo: 'assets/pictogramas/ghs05-corrosivo.svg' },
  {
    codigo: 'GHS06',
    nombre: 'Toxicidad aguda',
    archivo: 'assets/pictogramas/ghs06-toxicidad-aguda.svg',
  },
  { codigo: 'GHS07', nombre: 'Irritación', archivo: 'assets/pictogramas/ghs07-irritacion.svg' },
  {
    codigo: 'GHS08',
    nombre: 'Peligro a la salud',
    archivo: 'assets/pictogramas/ghs08-peligro-salud.svg',
  },
  {
    codigo: 'GHS09',
    nombre: 'Medio ambiente',
    archivo: 'assets/pictogramas/ghs09-medio-ambiente.svg',
  },
]);

/** @param {string} codigo */
export function pictogramaPorCodigo(codigo) {
  return PICTOGRAMAS.find((p) => p.codigo === codigo) ?? null;
}
