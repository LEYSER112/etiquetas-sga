# Etiquetas SGA

Aplicación web interna que convierte la **hoja de seguridad (FDS) en PDF** de una materia prima en una
**etiqueta SGA imprimible en PDF**, con las medidas de la **Resolución 773 de 2021**.

Reemplaza el generador en Google Sheets: ya no hace falta digitar la base de datos; se sube la FDS, se revisa
y se imprime.

## Cómo se usa

1. **Hoja de seguridad**: arrastra el PDF de la FDS. Se lee en el navegador; el archivo no sale del equipo.
2. **Revisa la etiqueta**: la app propone nombre, palabra de advertencia, pictogramas y frases H y P.
   Todo es editable. Agrega el **código Odoo** y, si quieres, un **código de barras EAN-13** o un
   **código QR**. En las frases basta con escribir el código (`H314`, `P305+P351+P338`)
   y se completa con el texto estándar.
3. **Guarda la etiqueta** en el grupo de impresión (o descárgala sola, a su medida exacta). El formulario
   queda limpio para subir la siguiente FDS.
4. **Grupo de impresión**: ajusta las copias de cada etiqueta, elige la hoja (Carta, Oficio, A4, Legal,
   Media carta o A3) y descarga o imprime. Las etiquetas se acomodan juntas en cada hoja.

> Imprime siempre al **100 %** / tamaño real (desactiva "Ajustar a la página") para conservar las medidas.

## Grupo de impresión

- Junta etiquetas de distintos productos y tamaños para imprimirlas en las mismas hojas.
- Entre etiquetas quedan **6 mm** con **marcas de corte** en las esquinas, y **7 mm** de margen en el borde
  de la hoja (lo que la mayoría de impresoras no imprime más el espacio de las marcas). Se cambian en
  `IMPRESION` dentro de `src/config/empresa.js`.
- Las etiquetas se giran 90° cuando así caben más. Se prueban dos formas de acomodarlas (por filas y por
  espacios libres) y se usa la que gasta menos hojas. Ejemplo: en Carta caben 5 etiquetas de 105 x 74 mm
  y en Oficio 6.
- Solo se pueden guardar etiquetas sin errores (por ejemplo, un EAN-13 inválido o texto que no cabe).
- El grupo se guarda en el navegador: no se pierde si se recarga la página, pero es de ese equipo y ese
  navegador. Se guardan los datos de cada etiqueta; los PDF se vuelven a generar al imprimir.

## Tamaño automático

El programa elige el tamaño más pequeño en el que **todo el texto cabe con letra legible (5 pt o más)**:

1. Empieza en el tamaño mínimo que exige la norma para la capacidad del envase (si no se indica la
   capacidad, empieza en A8).
2. En cada tamaño prueba primero **horizontal** y luego vertical.
3. Si no cabe, sube al siguiente tamaño.

En horizontal se prueban dos diseños (pictogramas en columna a la izquierda y texto a la derecha, o todo
en flujo) y se usa el que deja la letra más grande. El tamaño elegido se muestra debajo de las opciones de
impresión; también se puede fijar a mano.

## Contenido de la etiqueta

```
 MP-0158      │ HIPOCLORITO DE SODIO AL 15%        ← código Odoo y nombre en la misma fila
 ─────────────┼──────────────────────────────────
  pictogramas │ Indicaciones de peligro (H)
              │ Consejos de prudencia (P)
   PELIGRO    │ ┌ EMERGENCIAS · CISPROQUIM ┐  ┌ LOTE ┐
              │ │ Línea gratuita nacional  │  │      │
              │ │ Bogotá                   │  └──────┘
              │ │ ║║│║║│║│ EAN-13  o  ▣ QR  │
```

- **Código Odoo**: va encima de la columna de pictogramas; el nombre, después de la línea, en la misma fila.
  Si no se escribe código, el nombre ocupa la fila solo.
- **Teléfonos de CISPROQUIM**: se imprimen siempre, en un recuadro con título negro y números grandes:
  línea gratuita nacional `018000-916012` y Bogotá `(601) 2886012`. Se cambian en `src/config/empresa.js`.
- **EAN-13**: se escriben 12 dígitos y el dígito de control se calcula solo (con 13 se verifica). El código
  se dibuja en vectores debajo de los teléfonos, al 100 % del tamaño GS1 o más en etiquetas grandes (nunca por
  debajo del 80 % sin avisar). Si el campo está vacío no se imprime nada; si el número es inválido, la etiqueta
  se genera sin código y se muestra el error.
- **Código QR** (alternativa al EAN-13): se elige "Código QR" y se escribe cualquier texto (código, enlace a
  la FDS, etc.; máximo 300 caracteres, con tildes y ñ). Va en el mismo lugar que el código de barras, centrado
  debajo de los teléfonos. Usa corrección de errores M (~15 %), margen en blanco de 4 módulos y módulos de
  al menos 0,33 mm; si el texto es muy largo para el tamaño, avisa. El tipo elegido se conserva entre
  etiquetas.
- **Cuadro punteado de 32 x 15 mm para pegar el sticker del lote** (se puede desactivar).

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
- Valida la etiqueta: pictogramas faltantes o sin justificación, palabra de advertencia, EAN-13 inválido
  y tamaño mínimo según la capacidad.

## Estructura del proyecto

```
etiquetas-sga/
├── index.html                  Página única de la aplicación
├── styles/main.css             Estilos
├── assets/pictogramas/         Los 9 pictogramas SGA en SVG (GHS01 … GHS09)
├── vendor/                     Librerías incluidas (sin CDN ni compilación)
│   ├── pdfjs/                  pdf.js: lee el texto de la FDS
│   ├── pdf-lib/                pdf-lib: genera el PDF de la etiqueta
│   └── qrcode-generator/       qrcode-generator: arma la matriz del código QR
├── src/
│   ├── main.js                 Punto de entrada: conecta interfaz y lógica
│   ├── config/                 Parámetros que se ajustan sin tocar la lógica
│   │   ├── tamanos-etiqueta.js Tamaños de la Res. 773
│   │   └── empresa.js          Teléfonos de CISPROQUIM, hojas, márgenes y separación
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
│   │   ├── ean13.js            Validación y dibujo del código de barras EAN-13
│   │   ├── qr.js               Validación y dibujo del código QR
│   │   ├── acomodo-hoja.js     Acomodo de etiquetas en hojas (filas y MaxRects)
│   │   ├── medidas.js          Conversión de puntos a milímetros
│   │   ├── lineas-pdf.js       Reconstruye renglones del texto de pdf.js
│   │   └── texto.js            Utilidades de texto
│   ├── services/               Integración con librerías y APIs del navegador
│   │   ├── lector-pdf.js       Lectura del PDF con pdf.js
│   │   ├── generador-pdf.js    PDF de una etiqueta y de las hojas del grupo (pdf-lib)
│   │   ├── almacen-grupo.js    Guarda el grupo de impresión en el navegador
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

- **Teléfonos de CISPROQUIM**: `src/config/empresa.js`. Verifica de vez en cuando que sigan vigentes.
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

pdf.js (Apache 2.0), pdf-lib (MIT) y qrcode-generator (MIT) se incluyen en `vendor/` con sus licencias.
"QR Code" es marca registrada de DENSO WAVE INCORPORATED.
