"""Le frasi di PixDex: diagnosi, trattamenti, quanto si puo' ingrandire.

Stessa forma degli altri cataloghi, ``'chiave': 'frase'``, con i segnaposto di
``str.format``.

Qui ricorre un tema che negli altri non c'e': dire con chiarezza cosa il
programma *non* fa. Chi arriva alla rimasterizzazione dopo aver visto un video
di ingrandimento con l'intelligenza artificiale si aspetta un dettaglio che non
puo' arrivare, e una frase onesta al momento giusto vale piu' di dieci opzioni
in piu'.
"""
from __future__ import annotations

TESTI: dict[str, str] = {

    # ── Scelta della risoluzione ─────────────────────────────────────────────
    # Le note accanto a ogni voce sono il punto di tutta la schermata: la
    # stessa tabella che offre il 4K dice, sulla stessa riga, quando quel 4K
    # non porterebbe un solo dettaglio in piu'.
    'quality.auto': 'Automatica',
    'quality.none': 'Solo pulizia',
    'quality.hd': 'HD  1080p',
    'quality.2k': '2K  1440p',
    'quality.4k': '4K  2160p',
    # I commenti stanno in una colonna da 18 caratteri: devono restare corti
    # o il riquadro spezza le parole a meta'. La spiegazione lunga sta nella
    # riga di aiuto sotto la tabella, dove c'e' spazio.
    'quality.note_native': 'originale',
    'quality.note_ok': 'credibile',
    'quality.note_soft': 'si ammorbidisce',
    'quality.note_fake': 'solo piu\' pesante',

    # ── Strumenti esterni ────────────────────────────────────────────────────
    'tools.no_ffmpeg': '[error]Manca all\'appello:[/error] {tools}',
    'tools.install_ffmpeg': '[dim]FFmpeg non e\' installabile con pip. Su Windows:[/dim]\n'
                            '  [accent]winget install Gyan.FFmpeg[/accent]\n'
                            '[dim]poi riapri il terminale, cosi\' il PATH viene riletto.[/dim]',

    # ── Diagnosi ─────────────────────────────────────────────────────────────
    'diag.lowres': 'Risoluzione bassa ({h}p): l\'ingrandimento aiuta la resa a schermo '
                   'intero, ma il dettaglio resta quello di partenza.',
    'diag.compressed': 'Compressione marcata ({bpp} bit per pixel): quadretti nelle scene '
                       'scure e aloni intorno ai contorni.',
    'diag.very_compressed': 'Compressione estrema ({bpp} bit per pixel): il file e\' stato '
                            'strizzato al punto che i difetti si vedono anche in movimento.',
    'diag.interlaced': 'Immagine interlacciata: va separata in fotogrammi interi prima di '
                       'qualunque altra lavorazione.',
    'diag.banding_risk': 'Colore a 8 bit: cieli e dissolvenze tendono a mostrare bande a '
                         'scalini, che la lavorazione a 10 bit appiana.',
    'diag.clean': 'Niente di grave: il file e\' gia\' in buono stato, basta una '
                  'passata leggera.',

    # ── Preset ───────────────────────────────────────────────────────────────
    'preset.pulito.name': 'Pulito',
    'preset.pulito.desc': 'Toglie quadretti e bande, non ingrandisce. Il piu\' veloce.',
    'preset.standard.name': 'Standard',
    'preset.standard.desc': 'Il caso normale di un video YouTube: pulizia misurata e '
                            'ingrandimento.',
    'preset.forte.name': 'Forte',
    'preset.forte.desc': 'Sorgente molto rovinata. Accetta di perdere micro-dettaglio pur '
                         'di togliere il disturbo.',
    'preset.animazione.name': 'Animazione',
    'preset.animazione.desc': 'Cartoni e anime: mano leggera sul disturbo per non mangiare le '
                              'linee, mano pesante sulle bande.',
    'preset.vecchio.name': 'Vecchio',
    'preset.vecchio.desc': 'Materiale televisivo o da nastro: prima separa i semiquadri, poi '
                           'pulisce a fondo.',

    # ── Lavorazione ──────────────────────────────────────────────────────────
    'run.working': 'Rimasterizzo',
    'run.failed': '\n[error]FFmpeg si e\' fermato.[/error]\n[dim]{reason}[/dim]',
    'run.interrupted': '\n[warning]Interrotto.[/warning] [dim]Il file parziale resta sul disco.[/dim]',

    # ── Risultato ────────────────────────────────────────────────────────────
    'result.title': ' Fatto ',
    'result.size': 'Peso',
    'result.file': 'File',

    # ── Riga di comando ──────────────────────────────────────────────────────
    'cli.desc.pix': 'PixDex — rimasterizza un video: toglie i difetti della '
                    'compressione, appiana le bande e ingrandisce.',
}
