"""I ritocchi che si possono chiedere a un brano appena scaricato.

Cosa fa
    Mono, frequenza di campionamento, volume normalizzato e - per l'M4A - un
    bitrate diverso da quello di YouTube. Sono tutte cose che richiedono di
    ricodificare l'audio, e per questo stanno insieme: si fanno in un solo
    passaggio di FFmpeg, non in quattro.

Perche' un passaggio a parte
    yt-dlp, quando la sorgente e' gia' nel codec richiesto, copia l'audio byte
    per byte senza ricodificare: e' il caso dell'M4A, ed e' la cosa giusta
    finche' non si chiede altro. Ma a un flusso copiato non si puo' applicare
    nessun filtro. Rifarlo qui, a file gia' arrivato e verificato, vale allo
    stesso modo per tutti i formati.

Cosa resta com'e'
    I tag e la copertina che il file ha gia': si ricodifica solo l'audio, il
    resto viene copiato.
"""
from __future__ import annotations

import logging
import os
import subprocess

from server.config.settings import FORMATI_CON_BITRATE

log = logging.getLogger('audiodex')

# Il codificatore di FFmpeg per ogni estensione.
_CODEC = {
    'm4a': 'aac',
    'mp3': 'libmp3lame',
    'opus': 'libopus',
    'flac': 'flac',
    'wav': 'pcm_s16le',
}

# Quando si ricodifica senza che sia stato chiesto un bitrate: abbastanza da
# non aggiungere una perdita che si senta a quella che YouTube ha gia' fatto.
BITRATE_PREDEFINITO = 192

# Opus lavora solo a queste frequenze: le altre le rifiuta.
_FREQUENZE_OPUS = (8000, 12000, 16000, 24000, 48000)

# Il volume di riferimento dei servizi di ascolto: -14 LUFS, con un margine di
# un decibel e mezzo sotto lo zero perche' la ricodifica non faccia tosare i
# picchi.
NORMALIZZA = 'loudnorm=I=-14:TP=-1.5:LRA=11'


def servono(ritocchi: dict | None, estensione: str) -> bool:
    """Se le richieste obbligano a ricodificare il file."""
    r = ritocchi or {}
    if r.get('mono') or r.get('frequenza') or r.get('normalizza'):
        return True
    # Il bitrate, da solo, obbliga a rifare soltanto l'M4A: gli altri formati
    # yt-dlp li ha gia' codificati alla qualita' chiesta.
    return bool(r.get('bitrate')) and estensione == 'm4a'


def ritocca(percorso: str, ritocchi: dict | None) -> bool:
    """Ricodifica ``percorso`` sul posto con i ritocchi chiesti.

    Torna True se il file e' stato rifatto. Se FFmpeg fallisce il file resta
    quello di prima: un brano non ritoccato e' meglio di un brano perso.
    """
    r = ritocchi or {}
    estensione = os.path.splitext(percorso)[1].lstrip('.').lower()
    codec = _CODEC.get(estensione)
    if not codec or not servono(r, estensione):
        return False

    frequenza = int(r.get('frequenza') or 0)
    if estensione == 'opus' and frequenza and frequenza not in _FREQUENZE_OPUS:
        frequenza = 48000

    comando = ['ffmpeg', '-v', 'error', '-y', '-i', percorso,
               # Tutti i flussi e tutti i tag: la copertina e' un flusso video
               # di un fotogramma, e va copiata com'e'.
               '-map', '0', '-map_metadata', '0', '-c:v', 'copy', '-c:a', codec]
    if estensione in FORMATI_CON_BITRATE:
        comando += ['-b:a', f"{int(r.get('bitrate') or BITRATE_PREDEFINITO)}k"]
    if r.get('mono'):
        comando += ['-ac', '1']
    if r.get('normalizza'):
        comando += ['-af', NORMALIZZA]
    # ``loudnorm`` lavora a 192 kHz e li lascia in uscita: senza dirgli una
    # frequenza il file ne uscirebbe gonfio, e l'Opus non lo accetterebbe.
    if frequenza or r.get('normalizza'):
        comando += ['-ar', str(frequenza or 48000)]

    base, coda = os.path.splitext(percorso)
    provvisorio = f'{base}.ritocco{coda}'
    comando.append(provvisorio)
    try:
        esito = subprocess.run(
            comando, capture_output=True, text=True, encoding='utf-8',
            errors='replace', timeout=900,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.warning('Ritocco non riuscito per %s: %s', percorso, exc)
        esito = None

    if (esito is None or esito.returncode != 0
            or not os.path.isfile(provvisorio) or os.path.getsize(provvisorio) < 10_000):
        if esito is not None:
            log.warning('Ritocco non riuscito per %s: %s', percorso,
                        (esito.stderr or '').strip()[-300:])
        if os.path.exists(provvisorio):
            os.remove(provvisorio)
        return False
    os.replace(provvisorio, percorso)
    return True
