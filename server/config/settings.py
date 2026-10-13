"""Le manopole di AudioDex: quanti, quante volte, quanto aspettare.

Stavano sparse in cima al motore, in mezzo al codice che le usa. Le ho
raccolte qui per una ragione sola: sono le uniche cose di AudioDex che
qualcuno potrebbe voler cambiare senza voler capire come funziona il resto.

Cosa NON e' finito qui
    I numeri che spiegano una decisione restano accanto alla decisione: la
    soglia dei bit per pixel sta in ``server/video/probe.py``, i minuti del
    Red Book in ``server/burn/redbook.py``. Non sono manopole, sono premesse -
    cambiarle senza leggere il commento che le circonda significa rompere
    qualcosa senza accorgersene.
"""
from __future__ import annotations


# Parametri di funzionamento


MAX_RETRIES = 4            # Tentativi per traccia prima di dichiararla fallita


RETRY_BASE_DELAY = 3       # Secondi di base del backoff esponenziale tra i retry


REQUEST_TIMEOUT = 30       # Timeout (secondi) delle richieste HTTP





# Estensioni per tipo di media. Servono al controllo anti-duplicati: un
# brano gia' scaricato in .m4a non deve far saltare il download dello
# stesso titolo in video (e viceversa), mentre tra formati dello stesso
# tipo il file esistente vale comunque come "gia' fatto".
FORMATI_AUDIO = frozenset({'m4a', 'mp3', 'opus', 'flac', 'wav'})


FORMATI_VIDEO = frozenset({'mp4', 'mkv'})

# Flusso da chiedere a YouTube per ogni formato di uscita. Il criterio è
# scaricare il codec che YouTube serve già nativamente: quando sorgente e
# destinazione coincidono ffmpeg si limita a cambiare contenitore, copiando
# l'audio byte per byte, e non c'è nessuna seconda compressione con perdita.
#   m4a  -> AAC ~128 kbps  (itag 140), copia diretta
#   opus -> Opus ~160 kbps (itag 251), copia diretta
#   mp3  -> YouTube non lo serve mai: la conversione è inevitabile, quindi si
#           parte dal flusso di qualità più alta disponibile (di norma Opus).
#   flac, wav -> come l'mp3: si converte dal flusso migliore. Sono formati
#           senza perdita, ma la sorgente di YouTube la perdita l'ha già
#           subita: il file è più grande, non più fedele.
# Ogni voce termina con dei ripieghi progressivi, per i video che non
# espongono il codec preferito.
AUDIO_SOURCE_FORMATS = {
    'm4a': 'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best',
    'opus': 'bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio/best',
    'mp3': 'bestaudio/best',
    'flac': 'bestaudio/best',
    'wav': 'bestaudio/best',
}

# I formati in cui yt-dlp sa incorporare la copertina. Nel WAV non c'è posto.
FORMATI_CON_COPERTINA = frozenset({'m4a', 'mp3', 'opus', 'flac'})
# Quelli compressi con perdita, dove un bitrate ha senso.
FORMATI_CON_BITRATE = frozenset({'m4a', 'mp3', 'opus'})
