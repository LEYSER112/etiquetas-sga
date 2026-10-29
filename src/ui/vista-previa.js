/**
 * Vista previa del PDF con cotas de medida alrededor, como en un plano.
 */

/**
 * @param {{marco: HTMLElement, iframe: HTMLIFrameElement, vacia: HTMLElement, cota: HTMLElement}} nodos
 */
export function crearVistaPrevia({ marco, iframe, vacia, cota }) {
  let urlActual = null;
  let medidas = null;
  const pliego = marco.parentElement;
  const cotaH = cota.querySelector('.cota__h');
  const cotaV = cota.querySelector('.cota__v');

  const ubicarCotas = () => {
    if (!medidas) {
      cota.hidden = true;
      return;
    }
    cota.hidden = false;
    const base = pliego.getBoundingClientRect();
    const r = marco.getBoundingClientRect();
    Object.assign(cotaH.style, {
      left: `${r.left - base.left}px`,
      width: `${r.width}px`,
      top: `${r.top - base.top - 26}px`,
    });
    Object.assign(cotaV.style, {
      top: `${r.top - base.top}px`,
      height: `${r.height}px`,
      left: `${r.left - base.left - 30}px`,
    });
    cotaH.replaceChildren(texto(`${formatear(medidas.anchoMm)} mm`));
    cotaV.replaceChildren(texto(`${formatear(medidas.altoMm)} mm`));
  };

  new ResizeObserver(ubicarCotas).observe(pliego);

  return {
    /**
     * @param {Uint8Array} bytes
     * @param {{anchoMm:number, altoMm:number}} pagina  Medidas de la página del PDF.
     */
    mostrar(bytes, pagina) {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      marco.style.setProperty('--ancho', pagina.anchoMm);
      marco.style.setProperty('--alto', pagina.altoMm);
      iframe.src = `${url}#toolbar=0&navpanes=0&view=Fit`;
      iframe.hidden = false;
      vacia.hidden = true;
      if (urlActual) setTimeout(() => URL.revokeObjectURL(urlActual), 2000);
      urlActual = url;
      medidas = pagina;
      requestAnimationFrame(ubicarCotas);
    },
    limpiar() {
      iframe.removeAttribute('src');
      iframe.hidden = true;
      vacia.hidden = false;
      medidas = null;
      ubicarCotas();
    },
    /** Imprime el PDF mostrado. */
    imprimir() {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        if (urlActual) window.open(urlActual, '_blank', 'noopener');
      }
    },
  };
}

const texto = (contenido) => {
  const span = document.createElement('span');
  span.textContent = contenido;
  return span;
};

const formatear = (mm) => (Number.isInteger(mm) ? String(mm) : mm.toFixed(1)).replace('.', ',');
