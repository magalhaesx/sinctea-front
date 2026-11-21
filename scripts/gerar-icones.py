"""Gera os icones da PWA (item 22): 192, 512 e o "maskable" de 512.

O sistema ainda nao tem logotipo desenhado: o icone e provisorio, feito da
identidade que ja existe — o "S" de SINCTEA em Atkinson Hyperlegible negrito,
branco sobre o teal escuro da area clinica (--color-cli-ink, #0a6c75), com
contraste acima de 4,5:1. Quando o logotipo existir, troca-se aqui e roda de
novo.

Rodar da raiz do repositorio, com o Pillow instalado:
    python scripts/gerar-icones.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / 'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff'
DESTINO = RAIZ / 'public/icones'
FUNDO = (0x0A, 0x6C, 0x75, 255)
LETRA = (255, 255, 255, 255)


def icone(lado: int, mascaravel: bool) -> Image.Image:
    # Desenha em 4x e reduz: bordas e curvas lisas.
    escala = 4
    l = lado * escala
    img = Image.new('RGBA', (l, l), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if mascaravel:
        # O sistema corta a forma: o fundo vai ate a borda, e a letra fica
        # dentro da zona segura, o circulo de 80% do lado.
        d.rectangle([0, 0, l, l], fill=FUNDO)
        altura_da_letra = l * 0.42
    else:
        d.rounded_rectangle([0, 0, l - 1, l - 1], radius=int(l * 0.2), fill=FUNDO)
        altura_da_letra = l * 0.58
    fonte = ImageFont.truetype(str(FONTE), int(altura_da_letra / 0.69))
    x0, y0, x1, y1 = d.textbbox((0, 0), 'S', font=fonte)
    d.text(((l - (x1 - x0)) / 2 - x0, (l - (y1 - y0)) / 2 - y0), 'S', font=fonte, fill=LETRA)
    return img.resize((lado, lado), Image.LANCZOS)


DESTINO.mkdir(parents=True, exist_ok=True)
for nome, lado, mascaravel in [
    ('icone-192.png', 192, False),
    ('icone-512.png', 512, False),
    ('icone-mascaravel-512.png', 512, True),
    ('icone-180.png', 180, True),  # apple-touch-icon: o iOS arredonda sozinho
]:
    icone(lado, mascaravel).save(DESTINO / nome, optimize=True)
    print(nome)
