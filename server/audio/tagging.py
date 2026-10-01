"""I tag dentro al file: titolo, artista, album, copertina, testo, volume.

Un file senza tag e' un file che sul telefono compare come «Traccia
sconosciuta» in mezzo ad altre venti uguali. Scriverli e' la differenza fra
aver scaricato della musica e aver scaricato dei file.

Si usa mutagen, che e' facoltativo: senza, il file resta valido e suona, e
manca solo l'anagrafica. Per questo ogni scrittura e' protetta e nessun
errore qui dentro fa fallire un download gia' riuscito - sarebbe buttare via
quattro minuti di rete per un titolo.
"""
from __future__ import annotations

import os
import re

import requests

from server.audio.loudness import _misura_volume, _tag_volume
from server.sources.cover import copertina_quadrata
from server.utils import tor
from server.utils.console import setup_logger

log = setup_logger('audiodex', 'audiodex.log')

try:
    from mutagen.mp4 import MP4, MP4Cover, MP4FreeForm
    _HAS_MUTAGEN = True
except ImportError:
    _HAS_MUTAGEN = False


def tag_m4a(filepath: str, title: str | None = None, artist: str | None = None,
             album: str | None = None, track_num: int | None = None,
             thumbnail_url: str | None = None, lyrics: str | None = None,
             volume: bool = True) -> None:
    """Scrive i metadati (titolo, artista, album, n. traccia, copertina, testo) nel file.

    I file .m4a usano il container MP4, quindi i tag seguono lo standard
    iTunes (©nam, ©ART, ...). La copertina viene scaricata dalla thumbnail
    di YouTube e incorporata nel file. Se mutagen non è installato non fa
    nulla: il download resta comunque valido, solo senza tag.
    """
    if not _HAS_MUTAGEN:
        log.debug('mutagen non installato - skip tagging')
        return

    try:
        audio = MP4(filepath)
        tags = audio.tags
        if tags is None:
            audio.add_tags()
            tags = audio.tags

        if title:
            tags['©nam'] = [title]
        if artist:
            tags['©ART'] = [artist]
        if album:
            tags['©alb'] = [album]
        if track_num:
            tags['trkn'] = [(track_num, 0)]
        if lyrics:
            tags['©lyr'] = [lyrics]

        if thumbnail_url:
            try:
                resp = requests.get(thumbnail_url, timeout=30, proxies=tor.proxies())
                resp.raise_for_status()
                content_type = resp.headers.get('Content-Type', '')
                if 'png' in content_type:
                    img_format = MP4Cover.FORMAT_PNG
                else:
                    img_format = MP4Cover.FORMAT_JPEG
                # Le miniature YouTube sono 16:9 e i lettori le mostrano in un
                # quadrato: senza questo passaggio escono schiacciate o tagliate.
                quadrata = copertina_quadrata(resp.content)
                if quadrata:
                    dati, img_format = quadrata, MP4Cover.FORMAT_JPEG
                else:
                    dati = resp.content
                tags['covr'] = [MP4Cover(dati, imageformat=img_format)]
                log.debug('Copertina aggiunta: %s', title)
            except Exception as e:
                log.debug('Impossibile scaricare copertina: %s', e)

        # Volume: si misura il file appena scritto e si annota di quanto il
        # lettore deve alzarlo o abbassarlo. L'audio non viene toccato, quindi
        # non si perde niente e si disfa cancellando due tag. I nomi seguono
        # lo standard ReplayGain; nel contenitore MP4 vivono come campi liberi
        # sotto lo spazio iTunes, che e' dove VLC e foobar2000 li cercano.
        if volume:
            misura = _misura_volume(filepath)
            if misura:
                for nome, valore in _tag_volume(misura).items():
                    tags[f'----:com.apple.iTunes:{nome}'] = [
                        MP4FreeForm(valore)]
                log.debug('Volume misurato: %.2f LUFS, picco %.2f dBTP',
                          misura['i'], misura['tp'])

        audio.save()
        log.debug('Tag salvati: %s', filepath)
    except Exception as e:
        log.warning('Errore tagging %s: %s', os.path.basename(filepath), e)


def leggi_testo(filepath: str) -> str:
    """Il testo scritto nel tag ©lyr, o stringa vuota se non c'e'.

    Serve alla pagina per far leggere il testo anche dei brani che c'erano
    gia': il file e' l'unico posto in cui il testo sta.
    """
    if not _HAS_MUTAGEN or not filepath.lower().endswith(('.m4a', '.mp4')):
        return ''
    try:
        tags = MP4(filepath).tags or {}
        valori = tags.get('©lyr') or []
        return str(valori[0]) if valori else ''
    except Exception as e:                  # noqa: BLE001
        log.debug('Lettura del testo non riuscita per %s: %s', filepath, e)
        return ''


def scrivi_lrc(filepath: str, testo: str | None, title: str | None = None,
               artist: str | None = None) -> str:
    """Scrive accanto al brano il file .lrc col testo sincronizzato.

    Il testo sta gia' nel tag ©lyr, ma quasi nessun lettore lo fa scorrere:
    il Lettore multimediale di Windows e VLC lo ignorano, e MusicBee, AIMP,
    foobar2000, Poweramp e Musicolet cercano il testo in un file .lrc con lo
    stesso nome del brano. Si scrive solo se il testo ha i tempi: un .lrc senza
    tempi non scorrerebbe comunque. Restituisce il percorso, o '' se non scritto.
    """
    if not testo or not re.search(r'\[\d+:\d', testo):
        return ''
    percorso = os.path.splitext(filepath)[0] + '.lrc'
    testa = ''.join(f'[{k}:{v}]\n' for k, v in (('ti', title), ('ar', artist)) if v)
    try:
        # Con la BOM: i lettori piu' vecchi, senza, leggono gli accenti come
        # cp1252 e scrivono «Ã¨» al posto di «è».
        with open(percorso, 'w', encoding='utf-8-sig', newline='\r\n') as fh:
            fh.write(testa + testo.strip() + '\n')
        return percorso
    except OSError as e:
        log.warning('Scrittura del .lrc non riuscita per %s: %s', filepath, e)
        return ''
