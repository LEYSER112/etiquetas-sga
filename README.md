# Etiquetas SGA

Aplicación web interna que convierte la **hoja de seguridad (FDS) en PDF** de una materia prima en una
**etiqueta SGA imprimible en PDF**, con las medidas de la **Resolución 773 de 2021**.

Reemplaza el generador en Google Sheets: ya no hace falta digitar la base de datos; se sube la FDS, se revisa
y se imprime.

## Cómo se usa

1. **Hoja de seguridad**: arrastra el PDF de la FDS. Se lee en el navegador; el archivo no sale del equipo.
2. **Revisa la etiqueta**: la app propone nombre, palabra de advertencia, pictogramas, frases H y P y el
   teléfono de emergencia de CISPROQUIM. Todo es editable. En las frases basta con escribir el código (`H314`, `P305+P351+P338`)
   y se completa con el texto estándar.
3. **Imprime**: por defecto el tamaño y la orientación son automáticos (ver abajo). Elige la salida:
   - _Una etiqueta por página_: el PDF mide exactamente lo que mide la etiqueta (para impresoras de etiquetas).
   - _Varias en una hoja_: Carta, A4 u Oficio con marcas de corte.

> Imprime siempre al **100 %** (desactiva "Ajustar a la página") para conservar las medidas.

## Tamaño automático

El programa elige el tamaño más pequeño en el que **todo el texto cabe con letra legible (5 pt o más)**:

1. Empieza en el tamaño mínimo que exige la norma para la capacidad del envase (si no se indica la
   capacidad, empieza en A8).
2. En cada tamaño prueba primero **horizontal** y luego vertical.
3. Si no cabe, sube al siguiente tamaño.

En horizontal se prueban dos diseños (pictogramas en columna a la izquierda y texto a la derecha, o todo
en flujo) y se usa el que deja la letra más grande. El tamaño elegido se muestra debajo de las opciones de
impresión; también se puede fijar a mano.

Cada etiqueta lleva abajo a la derecha un **cuadro punteado de 32 x 15 mm para pegar el sticker del lote**
(se puede desactivar).

## Tamaños (Res. 773 de 2021)

| Capacidad del envase | Etiqueta mínima | Pictograma usado | Formato |
| -------------------- | --------------- | ---------------- | ------- |
| Hasta 3 L            | 52 x 74 mm      | 16 x 16 mm \*    | A8      |
| Más de 3 L a 50 L    | 74 x 105 mm     | 23 x 23 mm       | A7      |
| Más de 50 L a 500 L  | 105 x 148 mm    | 32 x 32 mm       | A6      |
| Más de 500 L         | 148 x 210 mm    | 46 x 46 mm       | A5      |

\* La tabla de la norma dice 10 mm para A8, pero la regla de que cada pictograma cubra al menos 1/15 de la
superficie de la etiqueta da 16 mm. Se usa el mayor. Se cambia en `src/config/tamanos-etiqueta.js`.

## Qué hace automáticamente

- Toma las frases H y P **solo de la Sección 2** de la FDS (las secciones 3 y 16 traen frases de los
  componentes que no van en la etiqueta de la mezcla). Si no encuentra la sección 2, usa todo el texto y avisa.
- Une combinaciones (`P305 + 351 + 338` → `P305+P351+P338`) y quita las frases sueltas repetidas.
- Reemplaza el texto de cada frase por la redacción estándar del SGA (corrige errores de digitación de la FDS).
- **Deduce los pictogramas a partir de las frases H** y aplica las reglas de precedencia del SGA
  (con calavera no va exclamación; con corrosivo no va exclamación por irritación; etc.).
- Busca **CISPROQUIM** en la FDS y toma sus números de emergencia. Si la FDS no lo menciona, usa el
  teléfono de emergencia que traiga; si no hay ninguno, usa el de `src/config/empresa.js`.
- Valida la etiqueta: pictogramas faltantes o sin justificación, palabra de advertencia, teléfono de
  emergencia y tamaño mínimo según la capacidad.

## Estructura del proyecto

```
etiquetas-sga/
├── index.html                  Página única de la aplicación
├── styles/main.css             Estilos
├── assets/pictogramas/         Los 9 pictogramas SGA en SVG (GHS01 … GHS09)
├── vendor/                     Librerías incluidas (sin CDN ni compilación)
│   ├── pdfjs/                  pdf.js: lee el texto de la FDS
│   └── pdf-lib/                pdf-lib: genera el PDF de la etiqueta
├── src/
│   ├── main.js                 Punto de entrada: conecta interfaz y lógica
│   ├── config/                 Parámetros que se ajustan sin tocar la lógica
│   │   ├── tamanos-etiqueta.js Tamaños de la Res. 773
│   │   └── empresa.js          Teléfono de emergencia por defecto, hojas e impresión
│   ├── data/                   Catálogos
│   │   ├── frases-h.js         Indicaciones de peligro
│   │   ├── frases-p.js         Consejos de prudencia
│   │   └── pictogramas.js      Catálogo de pictogramas
│   ├── core/                   Lógica pura, sin navegador (se prueba en Node)
│   │   ├── analizador-fds.js   Extrae los datos del texto de la FDS
│   │   ├── reglas-sga.js       Frase H → pictograma y palabra de advertencia
│   │   ├── frases.js           Lectura y armado de frases H/P
│   │   ├── validaciones.js     Revisión contra la norma
│   │   ├── diseno-etiqueta.js  Maquetación de la etiqueta en mm
│   │   ├── ajuste-tamano.js    Elección automática de tamaño y orientación
│   │   ├── lineas-pdf.js       Reconstruye renglones del texto de pdf.js
│   │   └── texto.js            Utilidades de texto
│   ├── services/               Integración con librerías y APIs del navegador
│   │   ├── lector-pdf.js       Lectura del PDF con pdf.js
│   │   ├── generador-pdf.js    Dibujo del PDF con pdf-lib
│   │   └── rasterizador-svg.js SVG → PNG a 600 dpi para imprimir
│   └── ui/                     Componentes de la interfaz
├── tests/                      Pruebas con el runner nativo de Node
├── scripts/generar-pictogramas.py
└── .nojekyll                   Indica a GitHub Pages que publique los archivos tal cual
```

La lógica (`core/`) no depende del navegador ni de la interfaz, por eso se puede probar y reutilizar
(por ejemplo, para un procesamiento por lotes en el futuro).

## Trabajar en local

No hay paso de compilación: son módulos ES nativos.

```bash
npm run dev      # sirve la carpeta en http://localhost:3000
npm test         # pruebas (Node 22+)
npm install      # solo si vas a usar lint/format
npm run lint
npm run format
```

> Abrir `index.html` con doble clic **no funciona** (los módulos ES necesitan un servidor).

## Publicar en GitHub Pages (Deploy from a branch)

1. Crea el repositorio y sube el contenido de esta carpeta a la rama `main`.
2. En GitHub: **Settings → Pages → Build and deployment**.
   - **Source**: _Deploy from a branch_.
   - **Branch**: `main` y carpeta `/ (root)` → **Save**.
3. En uno o dos minutos la página queda en `https://<usuario>.github.io/<repositorio>/`.

Cada `push` a `main` vuelve a publicar automáticamente. Antes de subir cambios, corre `npm test`.

Si el repositorio es privado, GitHub Pages requiere un plan que lo permita, y la página publicada es
pública salvo que la organización tenga Pages con control de acceso (GitHub Enterprise).

## Personalizar

- **Teléfono de emergencia por defecto (CISPROQUIM)**: `src/config/empresa.js`. Verifica de vez en cuando
  que los números sigan vigentes.
- **Letra mínima legible para el ajuste automático**: `CUERPO_LEGIBLE_PT` en `src/core/ajuste-tamano.js`.
- **Pictogramas**: puedes reemplazar los SVG de `assets/pictogramas/` por los oficiales de la ONU
  (o los del Google Sheets) manteniendo el mismo nombre de archivo.
- **Textos estándar de las frases**: `src/data/frases-h.js` y `src/data/frases-p.js`.

## Limitaciones conocidas

- Las FDS **escaneadas** (imagen, sin texto) no se pueden leer; la app avisa y los datos se llenan a mano.
  Se puede agregar OCR (Tesseract.js) más adelante.
- Cada proveedor arma su FDS distinto: el nombre del producto es el campo que más puede requerir
  corrección manual. **Siempre revisa la etiqueta contra la FDS.**

## Licencias

pdf.js (Apache 2.0) y pdf-lib (MIT) se incluyen en `vendor/` con sus licencias.
