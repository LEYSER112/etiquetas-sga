"""Genera los 9 pictogramas SGA como SVG (rombo rojo, fondo blanco, símbolo negro).

Uso: python3 scripts/generar-pictogramas.py assets/pictogramas

import math
import pathlib
import sys

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)

RED = "#E30613"


def star(cx, cy, r_out, r_in, n, rot=-90, jitter=None):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        if jitter and i % 2 == 0:
            r *= jitter[(i // 2) % len(jitter)]
        a = math.radians(rot + i * 180 / n)
        pts.append(f"{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}")
    return " ".join(pts)


def wrap(code, title, body):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-labelledby="t">
  <title id="t">{code} - {title}</title>
  <polygon points="100,9 191,100 100,191 9,100" fill="#FFFFFF" stroke="{RED}" stroke-width="12" stroke-linejoin="miter"/>
  <g fill="#000000" stroke="none">
{body}
  </g>
</svg>
"""


FLAME = ("M100,130 C76,130 68,114 72,100 C75,90 82,85 81,73 C90,79 92,88 91,96 "
         "C97,88 100,76 98,58 C113,70 121,85 118,100 C123,96 125,90 125,85 "
         "C133,98 132,116 123,123 C117,128 109,130 100,130 Z")
FLAME_INNER = ("M100,126 C90,126 85,118 88,110 C91,104 96,102 96,96 C103,101 107,108 106,114 "
               "C109,112 111,109 111,106 C116,114 113,126 100,126 Z")

pictos = {
    "ghs01-explosivo": ("GHS01", "Explosivo", f"""
    <polygon points="{star(100, 88, 30, 13, 11, jitter=[1, .8, 1.1, .85, 1, .75, 1.05, .9, .8, 1.1, .9])}"/>
    <polygon points="{star(100, 88, 15, 7, 7, rot=-70)}" fill="#FFFFFF"/>
    <circle cx="100" cy="127" r="13"/>
    <rect x="97" y="107" width="6" height="8"/>
    <polygon points="64,74 72,70 70,79"/>
    <polygon points="134,72 140,79 131,80"/>
    <polygon points="66,108 74,104 74,113"/>
    <polygon points="132,106 140,110 132,114"/>
    <polygon points="96,52 104,52 100,45"/>"""),
    "ghs02-inflamable": ("GHS02", "Inflamable", f"""
    <path d="{FLAME}"/>
    <path d="{FLAME_INNER}" fill="#FFFFFF"/>
    <rect x="66" y="133" width="68" height="7"/>"""),
    "ghs03-comburente": ("GHS03", "Comburente", f"""
    <g transform="translate(100 120) scale(1.05) translate(-100 -130)"><path d="{FLAME}"/></g>
    <circle cx="100" cy="114" r="15" fill="#FFFFFF" stroke="#000000" stroke-width="7"/>
    <rect x="66" y="134" width="68" height="6"/>"""),
    "ghs04-gas-presion": ("GHS04", "Gas a presión", """
    <g transform="rotate(-28 100 112)">
      <rect x="60" y="99" width="64" height="27" rx="13.5"/>
      <rect x="123" y="105" width="9" height="15"/>
      <rect x="131" y="101" width="9" height="23" rx="2"/>
      <rect x="70" y="104" width="44" height="3.5" rx="1.75" fill="#FFFFFF"/>
    </g>"""),
    "ghs05-corrosivo": ("GHS05", "Corrosivo", """
    <g transform="rotate(-35 80 70)"><rect x="74" y="50" width="12" height="38" rx="5"/><rect x="71" y="85" width="18" height="4" rx="1"/></g>
    <g transform="rotate(35 120 70)"><rect x="114" y="50" width="12" height="38" rx="5"/><rect x="111" y="85" width="18" height="4" rx="1"/></g>
    <ellipse cx="91" cy="98" rx="2.6" ry="4"/><ellipse cx="91" cy="109" rx="2.2" ry="3.4"/>
    <ellipse cx="109" cy="98" rx="2.6" ry="4"/><ellipse cx="109" cy="109" rx="2.2" ry="3.4"/>
    <path d="M64,121 L84,121 L86,127 L92,127 L94,121 L96,121 L96,133 L64,133 Z"/>
    <path d="M104,133 L104,124 C104,121 106,120 108,120 L106,120 L108,126 L113,126 L115,120 L131,120 C134,120 135,123 132,124 L136,124 C139,124 139,128 136,128 L136,128 C139,128 139,132 136,133 Z"/>
    <rect x="64" y="135" width="72" height="5"/>"""),
    "ghs06-toxicidad-aguda": ("GHS06", "Toxicidad aguda", """
    <g stroke="#000000" stroke-width="8" stroke-linecap="round">
      <line x1="70" y1="112" x2="130" y2="138"/>
      <line x1="70" y1="138" x2="130" y2="112"/>
    </g>
    <circle cx="67" cy="108" r="5"/><circle cx="72" cy="106" r="5"/>
    <circle cx="133" cy="108" r="5"/><circle cx="128" cy="106" r="5"/>
    <circle cx="67" cy="142" r="5"/><circle cx="72" cy="144" r="5"/>
    <circle cx="133" cy="142" r="5"/><circle cx="128" cy="144" r="5"/>
    <circle cx="100" cy="80" r="24"/>
    <rect x="87" y="92" width="26" height="20" rx="5"/>
    <circle cx="91" cy="82" r="7" fill="#FFFFFF"/>
    <circle cx="109" cy="82" r="7" fill="#FFFFFF"/>
    <polygon points="100,90 96,98 104,98" fill="#FFFFFF"/>
    <g fill="#FFFFFF"><rect x="92" y="104" width="2.5" height="8"/><rect x="98.75" y="104" width="2.5" height="8"/><rect x="105.5" y="104" width="2.5" height="8"/></g>"""),
    "ghs07-irritacion": ("GHS07", "Irritación / nocivo", """
    <path d="M92,62 C92,56 108,56 108,62 L104,120 L96,120 Z"/>
    <circle cx="100" cy="134" r="7.5"/>"""),
    "ghs08-peligro-salud": ("GHS08", "Peligro para la salud", f"""
    <circle cx="100" cy="64" r="11"/>
    <path d="M74,140 L74,100 C74,85 85,79 100,79 C115,79 126,85 126,100 L126,140 Z"/>
    <polygon points="{star(100, 112, 17, 6.5, 8)}" fill="#FFFFFF"/>"""),
    "ghs09-medio-ambiente": ("GHS09", "Peligro para el medio ambiente", """
    <g stroke="#000000" stroke-width="5" stroke-linecap="round" fill="none">
      <line x1="82" y1="136" x2="82" y2="66"/>
      <line x1="82" y1="96" x2="66" y2="80"/>
      <line x1="82" y1="86" x2="98" y2="70"/>
      <line x1="82" y1="110" x2="96" y2="98"/>
      <line x1="82" y1="76" x2="72" y2="62"/>
      <line x1="66" y1="138" x2="134" y2="138"/>
    </g>
    <ellipse cx="114" cy="126" rx="15" ry="7"/>
    <polygon points="127,126 137,119 137,133"/>
    <g stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round">
      <line x1="104" y1="122" x2="108" y2="126"/><line x1="108" y1="122" x2="104" y2="126"/>
    </g>"""),
}

for name, (code, title, body) in pictos.items():
    (OUT / f"{name}.svg").write_text(wrap(code, title, body), encoding="utf-8")
    print("ok", name)
