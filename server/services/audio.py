"""Quello che la finestra conosce del motore di download.

Non scarica niente da solo: lo fa ``audio/download.py``, un brano alla volta,
e il ciclo sui brani di una playlist lo tiene in mano ``controllers/api.py``,
che deve raccontare alla pagina cosa succede a ciascuno.

Qui si raccoglie in un elenco solo cio' che la finestra chiede al motore.
Prima la finestra entrava dentro il motore a prendersi
'ad._entry_from_info' e 'ad._is_playlist_url': due nomi che l'underscore
dichiarava privati e che erano invece il contratto vero.
"""
from __future__ import annotations

from server.audio.download import download_single      # noqa: F401
from server.sources.youtube import (                   # noqa: F401
    e_playlist,
    entry_da_info,
    get_playlist_entries,
    get_video_details,
)
