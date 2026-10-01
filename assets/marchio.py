# -*- coding: utf-8 -*-
"""Il marchio di MediaFlow, ritagliato una volta sola e messo nei tre posti.

    python assets/marchio.py

Da dove viene
    Da ``assets/MediaFlow-originale.png``, l'immagine del nome: un play con gli
    spigoli molto arrotondati, un secondo play dentro e tre scie a destra, in
    azzurro e viola. Qui se ne ritaglia solo il segno - senza il nome, il motto
    e le icone delle sezioni - e lo si ritinge coi verdi del tema.

    Prima il segno era ridisegnato a mano con poligoni, ma gli spigoli venivano
    troppo vivi rispetto all'originale. Ritagliarlo lo tiene identico.

Come si ritinge
    Si sposta solo la tinta e si lasciano luce e saturazione: le sfumature e
    le ombre dell'originale restano dove sono. L'azzurro in alto diventa il
    verde acido (--ciano), il blu il verde di punta (--magenta), il viola in
    basso un verde piu' profondo, e un po' piu' scuro, come nell'originale.

L'alone
    Attorno al segno l'immagine ha un bagliore semitrasparente. Su fondo nero
    diventerebbe una macchia sporca, quindi la trasparenza si taglia: sotto
    ALFA_VIA sparisce, sopra ALFA_PIENO e' pieno, in mezzo resta il bordo
    sfumato. Il bagliore nella finestra lo rifa' il CSS con drop-shadow.

Dove finisce
    - ``assets/MediaDex.ico`` e ``assets/MediaDex.png``: l'eseguibile, la
      finestra, l'installatore. Quadrati, con un filo di margine.
    - ``client/marchio.png``: la barra laterale e il velo di avvio. Stretto
      sul segno, perche' li' un quadrato lascerebbe fasce vuote.
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
RADICE = os.path.dirname(QUI)
ORIGINALE = os.path.join(QUI, 'MediaFlow-originale.png')
ICO = os.path.join(QUI, 'MediaDex.ico')
PNG = os.path.join(QUI, 'MediaDex.png')
PAGINA = os.path.join(RADICE, 'client', 'marchio.png')

# Il riquadro del segno dentro l'originale (1254x1254): sinistra, alto,
# destra, basso. Sotto c'e' gia' il nome, che qui non va.
RITAGLIO = (421, 202, 862, 567)

# Il taglio dell'alone, su 0-255.
ALFA_VIA, ALFA_PIENO = 110, 235

# Le tinte, in gradi. L'originale va dall'azzurro (190) al viola (275); il
# tema va dal verde acido (104) al verde di punta (145).
TINTA_DA, TINTA_A = 190, 108          # l'azzurro diventa acido...
TINTA_PASSO = 0.45                    # ...e ogni grado verso il viola ne vale meno di mezzo
TINTA_MIN, TINTA_MAX = 104, 148
# Il viola si scurisce fino a questa frazione, da 230 gradi in su.
SCURO_VIOLA = 0.22

# Le misure che Windows si aspetta dentro un .ico. La piu' piccola e' quella
# della barra delle applicazioni, la piu' grande quella delle anteprime grandi
# di Esplora risorse.
MISURE = [16, 24, 32, 48, 64, 128, 256]
LATO = 256
MARGINE = 0.04                        # sul lato del quadrato, per parte


def segno() -> Image.Image:
    """Il segno ritagliato e ritinto, stretto, su fondo trasparente."""
    img = Image.open(ORIGINALE).convert('RGBA').crop(RITAGLIO)
    a = np.array(img).astype(np.float32)
    alfa = np.clip((a[..., 3] - ALFA_VIA) / (ALFA_PIENO - ALFA_VIA), 0, 1)

    hsv = np.array(img.convert('RGB').convert('HSV')).astype(np.float32)
    tinta = hsv[..., 0] * 360 / 255
    nuova = np.clip(TINTA_A + (tinta - TINTA_DA) * TINTA_PASSO, TINTA_MIN, TINTA_MAX)
    hsv[..., 0] = nuova * 255 / 360
    hsv[..., 2] *= 1 - SCURO_VIOLA * np.clip((tinta - 230) / 45, 0, 1)

    rgb = np.array(Image.fromarray(hsv.astype(np.uint8), 'HSV').convert('RGB'))
    return Image.fromarray(np.dstack([rgb, (alfa * 255).astype(np.uint8)]), 'RGBA')


def quadrato(s: Image.Image, lato: int = LATO) -> Image.Image:
    """Il segno centrato su un quadrato trasparente, per le icone."""
    larg, alt = s.size
    tela = round(max(larg, alt) * (1 + 2 * MARGINE))
    q = Image.new('RGBA', (tela, tela), (0, 0, 0, 0))
    q.paste(s, ((tela - larg) // 2, (tela - alt) // 2), s)
    return q.resize((lato, lato), Image.LANCZOS)


def scrivi() -> None:
    s = segno()
    s.save(PAGINA)
    icona = quadrato(s)
    icona.save(PNG)
    # Pillow ricampiona da solo le misure richieste, partendo dalla piu' grande.
    icona.save(ICO, sizes=[(m, m) for m in MISURE])
    print('  {}  {}x{}'.format(PAGINA, *s.size))
    print('  {}  {}x{}'.format(PNG, LATO, LATO))
    print('  {}  {}'.format(ICO, ', '.join(str(m) for m in MISURE)))


if __name__ == '__main__':
    scrivi()
