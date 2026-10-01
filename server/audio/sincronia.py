"""I tempi di un testo semplice, ricavati ascoltando il brano.

Molti brani su LRCLIB hanno solo il testo, senza i tempi delle righe. Per
chi vuole impararlo mentre lo ascolta, un testo fermo serve a poco: bisogna
cercare con gli occhi il punto in cui si e'. Qui i tempi si ricavano dal
brano stesso.

Come: Whisper (lo stesso dei sottotitoli, modello «small») trascrive la
voce con il tempo di ogni parola. La trascrizione di una canzone e' piena di
errori - la musica copre, le parole si allungano - ma non serve che sia
giusta: serve solo ritrovarci le parole del testo vero. Si allineano le due
sequenze di parole (quella del testo e quella sentita) e ogni riga prende il
tempo della sua prima parola ritrovata. Le righe in cui non si ritrova
niente prendono un tempo in mezzo alle vicine, in proporzione alle parole.

Perche' non librosa (onset, energia): dice *quando* c'e' un suono, non
*quale* parola e'. Per mettere il tempo sulla riga giusta bisogna
riconoscere le parole, e cioe' un modello del parlato.

Se si ritrovano troppo poche righe il risultato non si usa: un testo che
scorre sfasato e' peggio di un testo fermo.

E' lento: su un Ryzen 5 3500U circa due volte e mezzo la durata del brano
(un brano di 2 minuti, 8 minuti). Per questo e' un'opzione a parte, e scatta
solo per i brani che su LRCLIB non hanno gia' i tempi.

Il file audio non viene toccato: il testo va solo nel tag ©lyr, e la
masterizzazione su CD legge il solo flusso audio.
"""
from __future__ import annotations

import difflib
import os
import re
import threading
import unicodedata

from server.utils.console import setup_logger

log = setup_logger('audiodex', 'audiodex.log')

# Sotto questa quota di righe ritrovate nella voce, il testo resta semplice.
QUOTA_MINIMA = 0.5

# Whisper occupa mezzo giga e tutti i core: con tre download in parallelo,
# uno alla volta. Il modello si carica una volta sola e resta pronto.
_serratura = threading.Lock()
_modello = None


def _whisper():
    global _modello
    if _modello is None:
        from faster_whisper import WhisperModel

        from server.video.sottotitoli import MODELLO_WHISPER, _cartella_modelli
        _modello = WhisperModel(
            MODELLO_WHISPER, device='cpu', compute_type='int8',
            cpu_threads=os.cpu_count() or 4,
            download_root=os.path.join(_cartella_modelli(), 'whisper'))
    return _modello


def _nuda(parola: str) -> str:
    """La parola ridotta all'osso: minuscola, senza accenti ne' punteggiatura."""
    parola = unicodedata.normalize('NFKD', parola.lower())
    parola = ''.join(c for c in parola if not unicodedata.combining(c))
    return re.sub(r"[^\w]", '', parola)


def _parole(riga: str) -> list[str]:
    return [p for p in (_nuda(x) for x in re.split(r"[\s'’\-]+", riga)) if p]


def _tempo_lrc(secondi: float) -> str:
    m, s = divmod(max(secondi, 0.0), 60)
    return f'[{int(m):02d}:{s:05.2f}]'


def sentite(file: str, suggerimento: str = '') -> list[tuple[float, str]]:
    """Le parole cantate nel brano, ognuna col tempo d'inizio."""
    from server.video.sottotitoli import estrai_audio

    campioni = estrai_audio(file)
    with _serratura:
        segmenti, _info = _whisper().transcribe(
            campioni, word_timestamps=True, vad_filter=False, beam_size=5,
            condition_on_previous_text=False,
            # L'inizio del testo vero orienta Whisper sul lessico del brano:
            # sbaglia meno, e le parole si ritrovano meglio.
            initial_prompt=suggerimento[:200] or None,
            # Con una passata sola e la ricerca «golosa» il tempo era lo
            # stesso e l'errore medio saliva da 0,8 a 5 secondi.
            temperature=[0.0, 0.4])
        uscita = []
        for seg in segmenti:
            for p in seg.words or []:
                for pezzo in _parole(p.word):
                    uscita.append((p.start, pezzo))
    return uscita


def allinea(righe: list[str], sentite_: list[tuple[float, str]],
            durata: float | None = None) -> list[float] | None:
    """Il tempo di ogni riga, o None se se ne ritrovano troppo poche.

    ``righe`` sono le righe non vuote del testo; ``sentite_`` le parole di
    Whisper, in ordine, col tempo d'inizio.
    """
    testo: list[tuple[int, str]] = [(i, p) for i, r in enumerate(righe)
                                    for p in _parole(r)]
    if not testo or not sentite_:
        return None
    blocchi = difflib.SequenceMatcher(
        None, [p for _, p in testo], [p for _, p in sentite_],
        autojunk=False).get_matching_blocks()

    # Il tempo di ogni parola del testo ritrovata nella voce.
    tempo_parola: dict[int, float] = {}
    for a, b, n in blocchi:
        for k in range(n):
            tempo_parola[a + k] = sentite_[b + k][0]

    tempi: list[float | None] = [None] * len(righe)
    for k, (riga, _) in enumerate(testo):
        if k in tempo_parola and tempi[riga] is None:
            # Se la prima parola ritrovata non e' la prima della riga, si
            # arretra di un tanto per ogni parola saltata.
            prima = next(j for j, (r, _) in enumerate(testo) if r == riga)
            tempi[riga] = max(tempo_parola[k] - 0.35 * (k - prima), 0.0)

    ritrovate = sum(t is not None for t in tempi)
    if ritrovate < QUOTA_MINIMA * len(righe):
        log.info('Sincronia: ritrovate %d righe su %d, testo lasciato semplice',
                 ritrovate, len(righe))
        return None

    # I tempi devono crescere: un'ancora fuori ordine (un ritornello
    # agganciato alla ripetizione sbagliata) si scarta e si ricalcola.
    ultimo = -1.0
    for i, t in enumerate(tempi):
        if t is not None:
            if t <= ultimo:
                tempi[i] = None
            else:
                ultimo = t

    # Le righe senza ancora: in mezzo alle vicine, in proporzione alle parole.
    pesi = [max(len(_parole(r)), 1) for r in righe]
    fine = durata or (sentite_[-1][0] + 2.0)
    i = 0
    while i < len(tempi):
        if tempi[i] is not None:
            i += 1
            continue
        j = i
        while j < len(tempi) and tempi[j] is None:
            j += 1
        da = tempi[i - 1] if i > 0 else max(sentite_[0][0] - 1.0, 0.0)
        a = tempi[j] if j < len(tempi) else fine
        if i == 0:
            # Le righe in testa, prima della prima ancora, finiscono li'.
            pesi_tratto = pesi[i:j]
        else:
            pesi_tratto = pesi[i - 1:j]
        passo = (a - da) / (sum(pesi_tratto) or 1)
        cursore = da if i == 0 else da + passo * pesi[i - 1]
        for k in range(i, j):
            tempi[k] = cursore
            cursore += passo * pesi[k]
        i = j
    return [float(t) for t in tempi]


def sincronizza(file: str, testo: str, durata: float | None = None) -> str | None:
    """Il testo semplice ``testo`` con i tempi presi dal brano, in formato LRC.

    Restituisce None se la voce non combacia abbastanza col testo, o se
    qualcosa va storto: il chiamante tiene allora il testo semplice.
    """
    righe = [r.strip() for r in testo.splitlines() if r.strip()]
    if not righe:
        return None
    try:
        tempi = allinea(righe, sentite(file, ' '.join(righe)), durata)
    except Exception as e:                  # noqa: BLE001
        log.warning('Sincronia non riuscita per %s: %s', file, e)
        return None
    if not tempi:
        return None
    return '\n'.join(f'{_tempo_lrc(t)}{r}' for t, r in zip(tempi, righe))
