"""Le frasi di AudioDex: download, tag, testi sincronizzati.

Una voce per frase mostrata a chi usa il programma, nella forma
``'chiave': 'frase'``. I segnaposto sono quelli di ``str.format``: chi scrive
la frase li mette dove gli servono, chi la chiama passa i valori per nome e
non deve sapere in che ordine finiranno.

Il markup Rich (``[error]``, ``[bold]``...) resta dentro le frasi quando fa
parte della frase: evidenziare una parola e' una scelta di chi la scrive, e
tenerlo fuori costringerebbe a spezzare le stringhe in pezzi senza senso
compiuto. La finestra lo toglie da sola (``t()`` in ``client/app.js``), perche'
a schermo non serve.

I commenti e i docstring del programma non stanno qui: si rivolgono a chi
legge il codice, non a chi lo usa.
"""
from __future__ import annotations

TESTI: dict[str, str] = {

    # ── Divisione di un album in tracce ──────────────────────────────────────
    'split.done': '{sym} Diviso in [bold]{n}[/bold] tracce: [dim]{cartella}[/dim]',

    # ── Verifica d'integrita' ────────────────────────────────────────────────
    # Sono messaggi che finiscono nell'elenco dei brani falliti: devono dire
    # cosa non va in modo che si capisca se val la pena ritentare.
    'verify.unreadable': 'file illeggibile: il contenitore non si apre',
    'verify.truncated': 'download troncato: dura {reale} invece di {attesa}',
    'verify.corrupt': 'audio danneggiato ({reason})',

    # ── Avvio e controlli ────────────────────────────────────────────────────
    'common.unknown': 'Sconosciuto',

}
