"""Le frasi di ClipDex: taglia, unisci, GIF e WebP.

Stessa forma degli altri cataloghi, ``'chiave': 'frase'``, con i segnaposto di
``str.format``.

Il tema ricorrente qui e' la distinzione fra copia e ricodifica: e' la scelta
che governa tempi, qualita' e vincoli di ogni operazione, e va detta a chi usa
il programma ogni volta che il programma la compie al posto suo.
"""
from __future__ import annotations

TESTI: dict[str, str] = {

    # ── Taglio ───────────────────────────────────────────────────────────────
    'cut.note_copy': 'tagliato in copia: nessuna perdita, ma l\'inizio si aggancia al '
                     'fotogramma chiave piu\' vicino',
    'cut.note_drift': 'chiesti {chiesta} s, ottenuti {reale}: {scarto} s in piu\'. In copia '
                      'l\'inizio si aggancia al fotogramma chiave precedente, e in questo '
                      'file sono distanziati. Con «Taglio preciso al fotogramma» il taglio cade dove hai detto, '
                      'al prezzo di una ricodifica',
    'cut.note_precise': 'tagliato al fotogramma esatto, quindi ricodificato',

    # ── Unione ───────────────────────────────────────────────────────────────
    'merge.mode_copy': '\n[bright_green]I file sono omogenei:[/bright_green] li unisco in '
                       'copia, senza ricodificare.',
    'merge.mode_encode': '\n[warning]I file hanno formati diversi:[/warning] li porto tutti '
                         'alla misura del primo e ricodifico. Ci vorra\' di piu\'.',
    'merge.note_chapters': 'un capitolo per ciascuno dei {n} file: il risultato resta navigabile',

    # ── GIF e WebP ───────────────────────────────────────────────────────────
    'gif.note': 'da {inizio}, {durata} s, {fps} fotogrammi al secondo, largo {w} px',

    # ── Lavorazione ──────────────────────────────────────────────────────────
    'run.cutting': 'Taglio',
    'run.merging': 'Unione',
    'run.gif': 'Creo la GIF',
    'run.webp': 'Creo il WebP',
    'run.failed': '\n[error]FFmpeg si e\' fermato.[/error]\n[dim]{reason}[/dim]',
    'run.interrupted': '\n[warning]Interrotto.[/warning] [dim]Il file parziale resta sul disco.[/dim]',

    # ── Risultato ────────────────────────────────────────────────────────────
    'result.title': ' Fatto ',
    'result.file': 'File',
    'result.size': 'Peso',
    'result.video': 'Video',

    # ── Errori ───────────────────────────────────────────────────────────────
    'error.unreadable': '[error]Nessun flusso video leggibile in[/error] {path}',
    'error.empty_range': '[error]L\'intervallo e\' vuoto:[/error] [dim]la fine deve venire '
                         'dopo l\'inizio.[/dim]',

    # ── Strumenti esterni ────────────────────────────────────────────────────
    'tools.no_ffmpeg': '[error]Manca all\'appello:[/error] {tools}',
    'tools.install_ffmpeg': '[dim]FFmpeg non e\' installabile con pip. Su Windows:[/dim]\n'
                            '  [accent]winget install Gyan.FFmpeg[/accent]\n'
                            '[dim]poi riapri il terminale, cosi\' il PATH viene riletto.[/dim]',

    # ── Riga di comando ──────────────────────────────────────────────────────
    'cli.desc.clip': 'ClipDex — taglia, unisce e converte i video: spezzoni, montaggi, '
                     'GIF e WebP.',
}
