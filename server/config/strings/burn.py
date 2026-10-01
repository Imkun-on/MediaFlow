"""Le frasi di BurnDex: unita', dischi, scaletta, diagnosi degli errori.

Stessa forma degli altri cataloghi, ``'chiave': 'frase'``, con i segnaposto di
``str.format``.

Qui le frasi sono piu' lunghe che altrove, ed e' voluto: su un CD-R non si
torna indietro, quindi ogni diagnosi non dice solo cosa e' andato storto ma
anche cosa fare. La struttura a elenco numerato e' quella che si segue davvero
mentre si cerca di capire perche' una masterizzazione e' fallita.
"""
from __future__ import annotations

TESTI: dict[str, str] = {

    # ── Voci comuni ──────────────────────────────────────────────────────────
    'common.min': 'min',
    'common.automatic': 'automatica',

    # ── Tipi di disco ────────────────────────────────────────────────────────
    'media.unknown': 'sconosciuto',
    'media.disc': 'disco',

    # ── Strumenti esterni ────────────────────────────────────────────────────
    'tools.missing': '\n[error]{tools} non trovato nel PATH.[/error]',
    # 'tools.install_ffmpeg' stava anche qui, e diceva solo «installa con
    # winget». Adesso a stamparla e' una funzione sola - check_ffmpeg in
    # server/utils/ffmpeg.py - quindi la versione che resta e' una: quella di
    # PixDex e ClipDex, che spiega anche perche' pip non basta.
    'tools.no_pywin32': '\n[error]pywin32 non installato.[/error]',
    'tools.no_pywin32_burn': '\n[error]pywin32 non installato: impossibile masterizzare.[/error]',
    'tools.no_pywin32_skip': '[dim]pywin32 non installato: controllo dell\'unita\' saltato.[/dim]\n',
    'tools.install_pywin32': '[dim]Installa con: pip install pywin32[/dim]\n',

    # ── Spazio temporaneo ────────────────────────────────────────────────────
    'temp.low': '\n[warning]ATTENZIONE: solo {free} MB liberi per i file '
                'temporanei (ne servono ~{need}).[/warning]',

    # ── Ordinamento delle tracce ─────────────────────────────────────────────
    'order.file': 'ordine.txt',
    'order.number': 'numero di traccia nel nome',
    'order.created': 'data di creazione',
    'order.missing_file': '[error]ordine.txt cita un file inesistente: {name}[/error]',

    # ── Scelta della raccolta ────────────────────────────────────────────────
    'collection.default_name': 'Raccolta',
    'collection.no_audio': '[error]Nessun file audio in {path}[/error]',

    # ── Scaletta ─────────────────────────────────────────────────────────────
    'tracklist.column': 'Traccia',
    'tracklist.duration': 'Durata',
    'tracklist.count': '[dim]{n} tracce[/dim]',
    'tracklist.order_note': '[dim]Ordine: {criterion}  ·  stacchi da 2 s inclusi nel totale[/dim]',
    'tracklist.unreadable': '[error]File illeggibili: {files}[/error]',

    # ── Unita' e disco ───────────────────────────────────────────────────────
    'drive.panel_title': '[bold bright_blue]Unita\' pronta[/bold bright_blue]',
    'drive.burner': 'Masterizzatore',
    'drive.disc': 'Disco',
    'drive.speed': 'Velocita\'',
    'drive.capacity': '[dim]vuoto · {min} min di capienza[/dim]',
    'drive.none_detected': '[error]Nessun masterizzatore rilevato. Collegalo e riprova.[/error]',
    'drive.index_missing': '[error]Unita\' {index} inesistente (ne risultano {total}).[/error]',
    'drive.available': '\n[dim_label]Masterizzatori disponibili:[/dim_label]',
    # Quando non c'e' un terminale a cui chiedere (l'interfaccia grafica): si
    # prende la prima e lo si dice, invece di restare fermi ad aspettare una
    # risposta che non puo' arrivare.
    'drive.auto_first': 'Piu\' di un masterizzatore: uso il primo, [accent]{name}[/accent].',
    'drive.no_readable_disc': '\n[error]Nessun disco leggibile nell\'unita\'.[/error]',
    'drive.insert_blank': '[dim]Inserisci un CD-R vuoto e riprova.[/dim]\n',
    'drive.external_warning': '[dim]Unita\' esterna: se la scrittura si interrompe a meta\', '
                              'e\' quasi sempre\nla porta USB che non regge l\'assorbimento del '
                              'laser.[/dim]',

    # ── Scelta della velocita' ───────────────────────────────────────────────
    'speed.writing_at': '{arrow} [dim_label]Velocita\' di scrittura:[/dim_label] [info]{speed}[/info]',
    'speed.refused': '[warning]L\'unita\' rifiuta l\'impostazione: uso la velocita\' '
                     'automatica.[/warning]',
    'speed.would_use': '\n{arrow} [dim_label]Velocita\' che verrebbe usata:[/dim_label] '
                       '[info]{speed}[/info] [dim](supportate: {supported})[/dim]',
    'speed.none': 'n/d',

    # ── Valutazione del disco inserito ───────────────────────────────────────
    'disc.unusable': '\n[error]Disco non utilizzabile: {reason}.[/error]',
    'disc.unknown_type': 'tipo non riconosciuto',
    'disc.unknown_type_why': 'L\'unita\' non e\' riuscita a identificare il disco. Puo\' essere '
                             'graffiato,\ninserito male, oppure di un tipo che questo '
                             'masterizzatore non gestisce.\nProva a estrarlo e reinserirlo.',
    'disc.not_a_cd_why': 'Il CD audio esiste solo sui CD: lo standard Red Book non e\' '
                         'definito\nper DVD e Blu-ray, e nessun lettore da auto saprebbe '
                         'leggerlo.\nServe un CD-R, anche se questo disco ha molto piu\' '
                         'spazio.',
    'disc.pressed_cdrom': 'CD-ROM stampato',
    'disc.pressed_cdrom_why': 'E\' un CD prodotto in fabbrica, di sola lettura. Serve un CD-R vuoto.',
    'disc.cdrw_written': 'CD-RW gia\' scritto',
    'disc.cdrw_written_why': 'Essendo riscrivibile puoi svuotarlo: Esplora risorse, tasto destro\n'
                             'sull\'unita\', "Cancella questo disco". Poi rilancia BurnDex.',
    'disc.cdr_written': 'CD-R gia\' scritto',
    'disc.cdr_written_why': 'Su un CD-R la scrittura e\' definitiva: non si cancella. Serve un '
                            'disco nuovo.',
    'disc.cdrw_blank': 'CD-RW vuoto',
    'disc.cdrw_blank_why': 'Riscrivibile, ma riflette meno luce di un CD-R: molte autoradio e\n'
                           'gli stereo datati non lo leggono. Per l\'auto conviene un CD-R.',
    'disc.cdr_blank': 'CD-R vuoto',
    'disc.not_writable_audio': '\n[error]Questo disco non e\' scrivibile come CD audio.[/error]',
    'disc.too_long': '\n[error]Troppo lungo: il limite prudenziale e\' {limit} min '
                     '({over} min di troppo).[/error]',
    'disc.trim_hint': '[dim]Togli qualche brano, oppure usa ordine.txt per fissare '
                      'cosa masterizzare.[/dim]\n',
    'disc.does_not_fit': '\n[error]Non ci sta: servono {need} min ma il disco ne regge '
                         '{have}.[/error]\n',
    'disc.does_not_fit_exact': '\n[error]Non ci sta sul disco: servono {need} min ma ce ne sono '
                               '{have}.[/error]',

    # ── Prova a vuoto ────────────────────────────────────────────────────────
    'dry.tracklist_ok': '\n{ok} [success]Scaletta valida: ci sta su un CD-R.[/success]',
    'dry.passed': '\n{ok} [success]Prova a vuoto superata: scaletta valida, disco '
                  'idoneo, spazio sufficiente.[/success]',
    'dry.nothing_touched': '[dim]Nessun disco e\' stato toccato. Togli --dry-run per '
                           'masterizzare davvero.[/dim]\n',

    # ── Decodifica e scrittura ───────────────────────────────────────────────
    'burn.measuring': 'Misura del volume...',
    'burn.measured': '[bright_green]Volume misurato[/bright_green]',
    'burn.decoding': 'Decodifica in corso...',
    'burn.decoded': '[bright_green]Decodifica completata[/bright_green]',
    'burn.decode_failed': '\n[error]Decodifica fallita: {file}[/error]',
    'burn.starting': 'Avvio scrittura...',
    'burn.all_written': '[bright_green]Tutte le tracce scritte[/bright_green]',
    'burn.closing': '\n[dim]Chiusura della sessione...[/dim]',
    'burn.close_failed': '[warning]L\'unita\' non ha risposto nemmeno alla chiusura: '
                         'scollegala e ricollegala prima di riprovare.[/warning]',
    'burn.timeout': '\n[error]L\'unita\' non ha risposto al comando di scrittura.[/error]',
    'burn.timeout_why': '[dim]Tipico dei masterizzatori USB alimentati dalla sola porta dati: quando il\n'
                        'laser passa in potenza di scrittura l\'assorbimento sale di colpo e l\'unita\'\n'
                        'si riavvia. Da provare, in quest\'ordine:\n'
                        '  1. se il cavo ha due spinotti USB, collegarli entrambi (uno e\' solo corrente)\n'
                        '  2. porta USB diretta sul PC, mai un hub non alimentato\n'
                        '  3. un hub USB con alimentatore esterno[/dim]',
    'burn.write_error': '\n[error]Errore durante la scrittura: {error}[/error]',

    # ── Riepilogo finale ─────────────────────────────────────────────────────
    'result.ok_title': '[bold bright_green]✓  Masterizzazione completata[/bold bright_green]',
    'result.fail_title': '[bold red]✗  Masterizzazione fallita[/bold red]',
    'result.tracks_written': 'Tracce scritte',
    'result.out_of': '[dim]su {total}[/dim]',
    'result.total_duration': 'Durata totale',
    'result.outcome': 'Esito',
    'result.finalised': '[success]disco finalizzato[/success]',
    'result.ready_to_play': '[dim]pronto da provare nel lettore[/dim]',
    'result.aborted': '[error]interrotto[/error]',
    'result.disc': 'Disco',
    'result.disc_still_good': '[info]nessun dato audio scritto: e\' ancora buono[/info]',
    'result.disc_ruined': '[warning]scritto a meta\': non e\' recuperabile[/warning]',

}
