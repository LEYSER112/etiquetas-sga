/**
 * Zona para arrastrar o elegir el PDF de la hoja de seguridad.
 */

/**
 * @param {HTMLElement} zona
 * @param {HTMLInputElement} entrada
 * @param {(archivo: File) => void} alRecibir
 */
export function configurarZonaCarga(zona, entrada, alRecibir) {
  const recibir = (archivo) => {
    if (archivo) alRecibir(archivo);
  };

  entrada.addEventListener('change', () => {
    recibir(entrada.files?.[0]);
    entrada.value = '';
  });

  for (const evento of ['dragenter', 'dragover']) {
    zona.addEventListener(evento, (e) => {
      e.preventDefault();
      zona.classList.add('activa');
    });
  }
  for (const evento of ['dragleave', 'drop']) {
    zona.addEventListener(evento, () => zona.classList.remove('activa'));
  }
  zona.addEventListener('drop', (e) => {
    e.preventDefault();
    recibir(e.dataTransfer?.files?.[0]);
  });

  // Evita que el navegador abra el PDF si se suelta fuera de la zona.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}
