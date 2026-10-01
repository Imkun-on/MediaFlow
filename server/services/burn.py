"""La procedura di masterizzazione, dall'inizio alla fine.

Leggere la cartella, ordinare, misurare, scegliere unita' e velocita',
decodificare, incidere: una sequenza sola, senza domande. Le scelte arrivano
gia' fatte dalla finestra (velocita', unita', livellamento, rifilatura), e
nessuna riga di questo file si mette in attesa di una risposta.

Quello che si stampa con Rich finisce nel diario del lavoro, che la finestra
mostra quando qualcosa va storto: e' il racconto di cosa e' successo, non
un dialogo.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile

from rich.box import DOUBLE, HEAVY_HEAD, ROUNDED
from rich.markup import escape
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from server.config import i18n
from server.utils.console import (
    LARGHEZZA, SYM_ARROW, SYM_FAIL, SYM_OK, console, setup_logger)
from server.burn.redbook import (
    CD_NOMINALE, PREGAP_SECTORS, SAFE_MINUTES, SECTORS_PER_SECOND,
    format_duration, sectors_to_minutes, settori_totali, velocita_x)
from server.burn.order import durata_traccia, ordina_tracce
from server.burn.encode import (
    _decodifica, _guadagno_livellamento, _misura_loudness)
from server.burn.drives import (
    _HAS_PYWIN32, _info_sistema, _leggi_supporto, _lettera_unita,
    _scegli_velocita, _valuta_supporto, elenca_unita, nome_unita)
from server.burn.writer import (
    DEFAULT_SPEED_X, _crea_writer, _masterizza, _progress, pythoncom)

t = i18n.t

log = setup_logger('burndex', 'burndex.log')


                          # compatibilita' con autoradio e lettori vecchi
MIN_FREE_MB = 1200        # Spazio temporaneo per il PCM: ~10 MB al minuto


def _avvisa_spazio_temp() -> None:
    """Avvisa se lo spazio per i file PCM temporanei (~850 MB per un CD pieno) e' poco.

    Avvisa soltanto: e' un controllo accessorio, e se lo spazio non basta
    davvero se ne accorge la decodifica, che fallisce dicendo su quale
    traccia. Un errore di lettura non blocca nulla.
    """
    try:
        free_mb = shutil.disk_usage(tempfile.gettempdir()).free / 1048576
    except OSError:
        return
    if free_mb < MIN_FREE_MB:
        log.warning('Spazio temporaneo basso: %.0f MB liberi', free_mb)
        console.print(t('temp.low', free=f'{free_mb:.0f}', need=MIN_FREE_MB))


def _barra_capienza(usati: int, capienza: int, larghezza: int = 40) -> Text:
    """Indicatore grafico di quanto disco si occupa.

    Un numero in minuti dice poco a chi non ha in mente che un CD ne regge 80:
    la barra rende immediato quanto margine resta, e cambia colore man mano
    che ci si avvicina al limite oltre il quale i lettori iniziano a sbagliare.
    """
    quota = min(usati / capienza, 1.0) if capienza else 0.0
    pieni = round(quota * larghezza)

    if usati >= SAFE_MINUTES * 60 * SECTORS_PER_SECOND:
        colore = 'red'
    elif quota >= 0.85:
        colore = 'yellow'
    else:
        colore = 'bright_green'

    barra = Text()
    barra.append('█' * pieni, style=colore)
    barra.append('░' * (larghezza - pieni), style='grey37')
    barra.append(f'  {sectors_to_minutes(usati):.1f}', style='bold white')
    barra.append(f" / {sectors_to_minutes(capienza):.0f} {t('common.min')}", style='dim')
    return barra


def _mostra_scaletta(tracce: list[str], durate: list[float | None],
                     criterio: str, titolo: str, capienza: int = CD_NOMINALE) -> int:
    """Stampa la scaletta numerata e ritorna i settori totali stimati.

    Con ``capienza`` (settori del disco inserito) aggiunge sotto la tabella
    la barra di riempimento: e' il colpo d'occhio che dice se ci sta.
    """
    totale = settori_totali(durate)
    minuti = sectors_to_minutes(totale)
    tabella = Table(
        box=HEAVY_HEAD, border_style='bright_blue', width=LARGHEZZA,
        title=f'[bold bright_magenta]{escape(titolo)}[/bold bright_magenta]',
        title_justify='center', header_style='bold bright_blue',
        show_footer=True, footer_style='bold', padding=(0, 1),
    )
    tabella.add_column('#', style='dim_label', justify='right', width=2, footer='')
    tabella.add_column(t('tracklist.column'), style='white', overflow='ellipsis',
                       no_wrap=True, ratio=1, footer=t('tracklist.count', n=len(tracce)))
    tabella.add_column(t('tracklist.duration'), justify='right', style='info', width=9,
                       footer=f"[bold white]{minuti:.1f} {t('common.min')}[/bold white]")

    for i, (path, dur) in enumerate(zip(tracce, durate), 1):
        tabella.add_row(str(i), escape(os.path.basename(path)), format_duration(dur))

    console.print()
    console.print(tabella)

    if capienza:
        console.print(_barra_capienza(totale, capienza, LARGHEZZA - 24))

    console.print(t('tracklist.order_note', criterion=escape(criterio)))
    return totale


def _pannello_unita(recorder, supporto: dict, sistema: dict | None = None) -> None:
    """Scheda dell'unita' e del disco inserito, pronta per la scrittura.

    Raccoglie in un unico riquadro quello che prima erano righe sparse:
    masterizzatore, tipo di disco, capienza e velocita' disponibili. E' la
    conferma visiva che il programma sta parlando con l'unita' giusta —
    dettaglio non ovvio quando ce n'e' piu' d'una collegata.

    Il parametro ``sistema`` e' opzionale perche' la ricognizione WMI puo'
    fallire o non essere stata fatta: quando c'e', accanto alla lettera
    compare l'etichetta (USB) che segnala un'unita' esterna, cioe' quella
    esposta al calo di tensione in scrittura.
    """
    tabella = Table(show_header=False, box=None, padding=(0, 1), expand=True)
    tabella.add_column('Campo', style='dim_label', no_wrap=True, width=14)
    tabella.add_column('Valore', style='white', ratio=1, overflow='ellipsis')

    lettera = _lettera_unita(recorder)
    collegamento = ((sistema or {}).get('unita', {}).get(lettera) or {}).get('connessione')
    nota_usb = '  [warning](USB)[/warning]' if collegamento == 'USB' else ''

    tabella.add_row(t('drive.burner'),
                    f'[bold]{escape(nome_unita(recorder))}[/bold]'
                    f'  [dim]{escape(lettera)}[/dim]{nota_usb}')
    tabella.add_row(t('drive.disc'),
                    f"[bold]{supporto['tipo']}[/bold] "
                    + t('drive.capacity',
                        min=f"{sectors_to_minutes(supporto['settori']):.0f}"))
    if supporto['velocita']:
        tabella.add_row(t('drive.speed'), '[dim]' +
                        ', '.join(velocita_x(v) for v in supporto['velocita']) + '[/dim]')

    console.print()
    console.print(Panel(
        tabella,
        title=t('drive.panel_title'),
        border_style='bright_blue',
        box=ROUNDED,
        width=LARGHEZZA,
        padding=(1, 1),
    ))


def _scegli_unita(indice: int | None = None):
    """Sceglie il masterizzatore da usare.

    ``indice`` e' l'unita' scelta nel menu della finestra. Senza, con
    un'unica unita' collegata - il caso normale - la prende da sola; con
    piu' unita' prende la prima e lo dice. Un indice fuori intervallo
    produce un errore esplicito invece di ricadere sulla prima unita'.

    Ritorna None quando non c'e' nulla da usare o la scelta non e' valida.
    """
    unita = elenca_unita()
    if not unita:
        console.print(t('drive.none_detected'))
        return None

    if indice is not None:
        if not 0 <= indice < len(unita):
            console.print(t('drive.index_missing', index=indice, total=len(unita)))
            return None
        return unita[indice]

    if len(unita) == 1:
        # Senza scelta da fare non serve annunciarla: l'unita' viene comunque
        # mostrata subito dopo dalla scheda _pannello_unita().
        return unita[0]

    console.print(t('drive.available'))
    for i, rec in enumerate(unita):
        console.print(f'  [accent]{i}[/accent]  {escape(nome_unita(rec))}'
                      f'  [dim]{escape(_lettera_unita(rec))}[/dim]')
    # Detto, non chiesto: chi guarda la finestra ha il menu delle unita' e
    # puo' rifare la scelta.
    console.print(t('drive.auto_first', name=escape(nome_unita(unita[0]))))
    return unita[0]


def _mostra_riepilogo(scritte: int, totali: int, minuti: float, esito: bool) -> None:
    """Pannello finale con l'esito della masterizzazione.

    Riporta le tracce **effettivamente incise**, non quelle preparate: e' la
    differenza che dice se il disco e' ancora utilizzabile. A zero tracce il
    CD-R e' rimasto vergine e si puo' riprovare; a meta' e' compromesso in
    modo irreversibile e va sostituito. Sono due situazioni molto diverse, e
    confonderle costa un disco.

    La durata totale compare solo in caso di successo: dopo un fallimento
    indicherebbe quanto *sarebbe* durato il disco, un dato senza significato
    che si presterebbe a essere letto come quanto e' stato scritto.
    """
    tabella = Table(show_header=False, box=None, padding=(0, 1), expand=True)
    tabella.add_column('Label', style='dim_label', no_wrap=True, width=16)
    tabella.add_column('Value', ratio=1)

    tabella.add_row(t('result.tracks_written'),
                    f'[bold]{scritte}[/bold] ' + t('result.out_of', total=totali))
    if esito:
        tabella.add_row(t('result.total_duration'),
                        f"[bold]{minuti:.1f} {t('common.min')}[/bold]")
        tabella.add_row(t('result.outcome'), f"{SYM_OK} {t('result.finalised')}")
        tabella.add_row('', t('result.ready_to_play'))
    else:
        tabella.add_row(t('result.outcome'), f"{SYM_FAIL} {t('result.aborted')}")
        tabella.add_row(t('result.disc'),
                        t('result.disc_still_good') if scritte == 0
                        else t('result.disc_ruined'))

    console.print()
    console.print(Panel(
        tabella,
        title=t('result.ok_title') if esito else t('result.fail_title'),
        border_style='bright_green' if esito else 'red',
        box=DOUBLE,
        width=LARGHEZZA,
        padding=(1, 2),
    ))


def masterizza_cartella(cartella: str, *, speed_x: int | None, dry_run: bool,
                        espelli: bool, indice_unita: int | None,
                        livella: bool = True, rifila: bool = False) -> int:
    """Prepara e masterizza il contenuto di una cartella. Ritorna il codice di uscita.

    Tutte le tracce della cartella, nell'ordine della scaletta; velocita'
    ``speed_x`` o, senza, quella predefinita.
    """
    nome_raccolta = os.path.basename(cartella) or t('collection.default_name')
    tracce, criterio = ordina_tracce(cartella)
    if not tracce:
        console.print(t('collection.no_audio', path=cartella))
        return 1

    # Percorso accorciato in testa invece che mandato a capo: la coda e' la
    # parte che identifica la raccolta, l'inizio si intuisce.
    percorso = (cartella if len(cartella) <= LARGHEZZA
                else '…' + cartella[-(LARGHEZZA - 1):])
    console.print(f'[dim]{escape(percorso)}[/dim]')

    durate = [durata_traccia(p) for p in tracce]
    if any(d is None for d in durate):
        illeggibili = [os.path.basename(p) for p, d in zip(tracce, durate) if d is None]
        console.print(t('tracklist.unreadable', files=', '.join(illeggibili)))
        return 1

    stimati = _mostra_scaletta(tracce, durate, criterio, nome_raccolta)
    minuti = sectors_to_minutes(stimati)

    if minuti > SAFE_MINUTES:
        console.print(t('disc.too_long', limit=SAFE_MINUTES,
                        over=f'{minuti - SAFE_MINUTES:.1f}'))
        console.print(t('disc.trim_hint'))
        return 1

    if not _HAS_PYWIN32:
        if dry_run:
            console.print(t('dry.tracklist_ok', ok=SYM_OK))
            console.print(t('tools.no_pywin32_skip'))
            return 0
        console.print(t('tools.no_pywin32_burn'))
        console.print(t('tools.install_pywin32'))
        return 1

    pythoncom.CoInitialize()

    recorder = _scegli_unita(indice_unita)
    if recorder is None:
        return 1

    # Tutti i controlli sul disco vengono prima della decodifica: accorgersi
    # che manca il CD dopo due minuti di ffmpeg sarebbe solo tempo buttato.
    supporto = _leggi_supporto(recorder)
    if supporto is None:
        console.print(t('drive.no_readable_disc'))
        console.print(t('drive.insert_blank'))
        return 1

    liberi = supporto['settori']

    utilizzabile, descrizione, spiegazione = _valuta_supporto(supporto)
    if not utilizzabile:
        console.print(t('disc.unusable', reason=descrizione))
        console.print(f'[dim]{spiegazione}[/dim]\n')
        return 1

    sistema = _info_sistema()
    _pannello_unita(recorder, supporto, sistema)

    if spiegazione:
        console.print(f'[warning]{spiegazione}[/warning]')

    # Avviso sull'alimentazione solo dove serve davvero, cioe' su un'unita'
    # esterna: su una interna sarebbe rumore inutile a ogni masterizzazione.
    if (sistema['unita'].get(_lettera_unita(recorder)) or {}).get('connessione') == 'USB':
        console.print(t('drive.external_warning'))

    if stimati > liberi:
        console.print(t('disc.does_not_fit', need=f'{minuti:.1f}',
                        have=f'{sectors_to_minutes(liberi):.1f}'))
        return 1

    # Velocita': quella scelta nella finestra, o la predefinita.
    velocita = _scegli_velocita(supporto['velocita'], speed_x or DEFAULT_SPEED_X)

    if dry_run:
        console.print(t(
            'speed.would_use',
            arrow=SYM_ARROW,
            speed=velocita_x(velocita) if velocita else t('common.automatic'),
            supported=', '.join(velocita_x(v) for v in supporto['velocita']) or t('speed.none'),
        ))
        console.print(t('dry.passed', ok=SYM_OK))
        console.print(t('dry.nothing_touched'))
        return 0

    _avvisa_spazio_temp()

    audio = _crea_writer(recorder, velocita)
    if audio is None:
        return 1

    # Il livellamento richiede una passata di sola analisi su ogni traccia,
    # prima di decodificare: si deve conoscere la loudness di *tutte* per
    # sapere di quanto spostare ciascuna. E' il motivo per cui e' opzionale —
    # su un disco pieno sono alcuni minuti in piu'.
    guadagni: dict[str, float] = {}
    if livella:
        with _progress() as progress:
            task = progress.add_task(t('burn.measuring'), total=len(tracce))
            for src in tracce:
                progress.update(task, description=os.path.basename(src))
                guadagni[src] = _guadagno_livellamento(_misura_loudness(src))
                progress.advance(task)
            progress.update(task, description=t('burn.measured'))

    with tempfile.TemporaryDirectory(prefix='burndex_') as tmp:
        pcm_files, totale = [], 0
        with _progress() as progress:
            task = progress.add_task(t('burn.decoding'), total=len(tracce))
            for i, src in enumerate(tracce, 1):
                progress.update(task, description=os.path.basename(src))
                dst = os.path.join(tmp, f'{i:03d}.pcm')
                try:
                    totale += _decodifica(src, dst, guadagni.get(src, 0.0),
                                          rifila) + PREGAP_SECTORS
                except subprocess.CalledProcessError as exc:
                    log.error('ffmpeg fallito su %s: %s', src, exc.stderr)
                    console.print(t('burn.decode_failed', file=os.path.basename(src)))
                    return 1
                pcm_files.append(dst)
                progress.advance(task)
            progress.update(task, description=t('burn.decoded'))

        # Ricontrollo con i valori esatti: la stima da ffprobe puo' scostarsi
        # di qualche settore, e qui non c'e' piu' margine di errore.
        if totale > liberi:
            console.print(t('disc.does_not_fit_exact',
                            need=f'{sectors_to_minutes(totale):.1f}',
                            have=f'{sectors_to_minutes(liberi):.1f}'))
            return 1

        nomi = [os.path.basename(p) for p in tracce]
        esito, scritte = _masterizza(audio, pcm_files, nomi)

    _mostra_riepilogo(scritte, len(pcm_files), sectors_to_minutes(totale), esito)

    if esito and espelli:
        try:
            recorder.EjectMedia()
        except Exception as exc:
            log.warning('Espulsione fallita: %s', exc)

    log.info('Masterizzazione %s: %d/%d tracce scritte da %s',
             'riuscita' if esito else 'fallita', scritte, len(pcm_files), cartella)
    return 0 if esito else 1
