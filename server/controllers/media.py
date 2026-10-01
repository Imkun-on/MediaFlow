"""I video e i brani che la pagina deve far vedere e sentire.

La pagina non li puo' aprire dal disco. pywebview la serve da un piccolo
server suo (``http://127.0.0.1:...``), e da un indirizzo http il motore di
Edge non lascia caricare niente da ``file:///``: e' una regola di sicurezza
del browser, e non si aggira. L'anteprima restava nera, e nel banco di prova
- una pagina aperta dal disco - funzionava, che e' il modo peggiore di
fallire.

Qui c'e' un secondo server, altrettanto piccolo, che serve i file
multimediali. Ascolta solo su 127.0.0.1, quindi nessun altro computer lo
raggiunge; e serve soltanto i file che il programma stesso ha deciso di
mostrare (``indirizzo`` li registra uno per uno), sotto un nome che non
dice niente: chi indovinasse la porta non potrebbe chiedergli un file
qualunque del disco.

Risponde alle richieste a pezzi (``Range``): senza, un video non si puo'
spostare avanti e indietro, e i lettori di Edge li chiedono sempre cosi'.

Fa passare anche le miniature di YouTube (``remoto``). Se la pagina le
chiedesse da se', a i.ytimg.com arriverebbe l'IP di casa proprio mentre
yt-dlp lo nasconde dietro Tor: qui le si scarica attraverso Tor e le si
tiene in memoria, cosi' ogni miniatura fa un solo viaggio.
"""
from __future__ import annotations

import mimetypes
import os
import re
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote

_FILE: dict[str, str] = {}          # gettone -> percorso
_PERCORSI: dict[str, str] = {}      # percorso -> gettone
_SERRATURA = threading.Lock()
_SERVER: ThreadingHTTPServer | None = None
_REMOTI: dict[str, str] = {}        # gettone -> indirizzo su internet
_SCARICATI: dict[str, tuple[str, bytes]] = {}   # gettone -> (tipo, contenuto)

# I tipi che mimetypes su Windows non sempre conosce, o conosce male.
_TIPI = {'.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mkv': 'video/x-matroska',
         '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4a': 'audio/mp4',
         '.mp3': 'audio/mpeg', '.opus': 'audio/ogg', '.ogg': 'audio/ogg',
         '.wav': 'audio/wav', '.flac': 'audio/flac', '.gif': 'image/gif',
         '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg'}

_BLOCCO = 1 << 20


class _Risposta(BaseHTTPRequestHandler):
    def log_message(self, *_):          # niente righe sul terminale
        pass

    def _remoto(self, gettone: str) -> None:
        with _SERRATURA:
            url = _REMOTI.get(gettone)
            pronto = _SCARICATI.get(gettone)
        if not url:
            self.send_error(404)
            return
        if pronto is None:
            import requests
            from server.utils import tor
            try:
                r = requests.get(url, timeout=30, proxies=tor.proxies())
                r.raise_for_status()
            except Exception:           # noqa: BLE001 - senza miniatura si vive
                self.send_error(502)
                return
            pronto = (r.headers.get('Content-Type', 'image/jpeg'), r.content)
            with _SERRATURA:
                _SCARICATI[gettone] = pronto
        tipo, dati = pronto
        self.send_response(200)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(dati)))
        self.send_header('Cache-Control', 'max-age=86400')
        self.end_headers()
        try:
            self.wfile.write(dati)
        except (ConnectionError, OSError):
            pass

    def do_GET(self):                   # noqa: N802 (il nome lo decide http.server)
        r = re.match(r'^/r/([0-9a-f]+)$', self.path)
        if r:
            self._remoto(r.group(1))
            return
        m = re.match(r'^/f/([0-9a-f]+)/', self.path)
        with _SERRATURA:
            percorso = _FILE.get(m.group(1)) if m else None
        if not percorso or not os.path.isfile(percorso):
            self.send_error(404)
            return
        dimensione = os.path.getsize(percorso)
        inizio, fine = 0, dimensione - 1
        pezzo = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        if pezzo and (pezzo.group(1) or pezzo.group(2)):
            if pezzo.group(1):
                inizio = int(pezzo.group(1))
                fine = int(pezzo.group(2)) if pezzo.group(2) else fine
            else:                       # gli ultimi N byte
                inizio = max(0, dimensione - int(pezzo.group(2)))
            fine = min(fine, dimensione - 1)
            if inizio > fine:
                self.send_error(416)
                return
            self.send_response(206)
            self.send_header('Content-Range', f'bytes {inizio}-{fine}/{dimensione}')
        else:
            self.send_response(200)
        estensione = os.path.splitext(percorso)[1].lower()
        self.send_header('Content-Type', _TIPI.get(estensione)
                         or mimetypes.guess_type(percorso)[0] or 'application/octet-stream')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(fine - inizio + 1))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            with open(percorso, 'rb') as f:
                f.seek(inizio)
                resto = fine - inizio + 1
                while resto > 0:
                    dati = f.read(min(_BLOCCO, resto))
                    if not dati:
                        break
                    self.wfile.write(dati)
                    resto -= len(dati)
        except (ConnectionError, OSError):
            # Il lettore chiude spesso a meta' quando si sposta nel video: e'
            # normale, non un guasto.
            pass


def _avvia() -> ThreadingHTTPServer:
    global _SERVER
    if _SERVER is None:
        _SERVER = ThreadingHTTPServer(('127.0.0.1', 0), _Risposta)
        _SERVER.daemon_threads = True
        threading.Thread(target=_SERVER.serve_forever, daemon=True).start()
    return _SERVER


def indirizzo(percorso: str) -> str:
    """L'indirizzo con cui la pagina puo' aprire il file. Il nome in fondo
    serve solo a chi lo legge: il file lo decide il gettone."""
    if not percorso:
        return ''
    pieno = os.path.abspath(percorso)
    with _SERRATURA:
        gettone = _PERCORSI.get(pieno)
        if gettone is None:
            gettone = secrets.token_hex(8)
            _PERCORSI[pieno] = gettone
            _FILE[gettone] = pieno
    porta = _avvia().server_address[1]
    return f'http://127.0.0.1:{porta}/f/{gettone}/{quote(os.path.basename(pieno))}'


def remoto(url: str) -> str:
    """L'indirizzo locale per un'immagine su internet, che passa da Tor."""
    if not url:
        return ''
    with _SERRATURA:
        gettone = _PERCORSI.get(url)
        if gettone is None:
            gettone = secrets.token_hex(8)
            _PERCORSI[url] = gettone
            _REMOTI[gettone] = url
    porta = _avvia().server_address[1]
    return f'http://127.0.0.1:{porta}/r/{gettone}'
