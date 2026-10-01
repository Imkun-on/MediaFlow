
<div align="center">

# MediaFlow

<i>Tutto l'audio e il video, in un solo spazio.</i>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/yt--dlp-FF0000?logo=youtube&logoColor=white" alt="yt-dlp">
  <img src="https://img.shields.io/badge/FFmpeg-007808?logo=ffmpeg&logoColor=white" alt="FFmpeg">
  <img src="https://img.shields.io/badge/pywebview-2C5BB4?logo=python&logoColor=white" alt="pywebview">
  <img src="https://img.shields.io/badge/WebView2-0078D4?logo=microsoftedge&logoColor=white" alt="WebView2">
  <img src="https://img.shields.io/badge/Tor-7D4698?logo=torproject&logoColor=white" alt="Tor">
  <img src="https://img.shields.io/badge/Whisper-412991?logo=openai&logoColor=white" alt="Whisper">
  <img src="https://img.shields.io/badge/Opus--MT-0F766E?logo=googletranslate&logoColor=white" alt="Opus-MT">
  <img src="https://img.shields.io/badge/Chatterbox-F59E0B?logo=audiomack&logoColor=white" alt="Chatterbox">
  <img src="https://img.shields.io/badge/Real--ESRGAN-E11D48?logo=onnx&logoColor=white" alt="Real-ESRGAN">
  <img src="https://img.shields.io/badge/LRCLIB-8B5CF6?logo=musicbrainz&logoColor=white" alt="LRCLIB">
  <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite">
  <img src="https://img.shields.io/badge/IMAPI2-0078D4?logo=windows&logoColor=white" alt="IMAPI2">
  <img src="https://img.shields.io/badge/Inno_Setup-264653?logo=windows11&logoColor=white" alt="Inno Setup">
</p>

<a href="https://github.com/Imkun-on/MediaFlow/releases/latest/download/MediaFlow-Setup.exe">
  <img src="https://img.shields.io/badge/⬇_Scarica_MediaFlow--Setup.exe-39FF88?style=for-the-badge&labelColor=0b160d&color=39FF88&logoColor=black" alt="Scarica MediaFlow">
</a>

<sub>Windows 10 o successivo · non servono permessi di amministratore</sub>

</div>

---

## Installazione

Scarica **[`MediaFlow-Setup.exe`](https://github.com/Imkun-on/MediaFlow/releases/latest/download/MediaFlow-Setup.exe)** e fai doppio clic: non c'è altro da installare.
Al primo avvio l'app scarica da sola quello che le serve (FFmpeg e Tor), quindi
la prima volta ci mette qualche minuto in più.

Se Windows avvisa che il file «non viene scaricato di frequente», scegli
**Ulteriori informazioni** → **Esegui comunque**: succede con ogni programma
nuovo e non firmato.

## Le sezioni

| Sezione | A cosa serve |
|---|---|
| 🎧 **Audio** | Da un link di YouTube (brano, playlist o album) ricava l'audio in `m4a`, con tag, copertina e testo sincronizzato. Un album caricato come video unico viene diviso in tracce |
| 💿 **Masterizzazione** | Trasforma una cartella di brani in un CD audio, leggibile da qualsiasi autoradio |
| 🎬 **Video** | Da un link di YouTube ricava il video in `mp4`, singolo o di un'intera playlist |
| ✨ **Migliora qualità** | Toglie i difetti della compressione da un video e lo ingrandisce, a scelta anche con l'AI |
| 💬 **Sottotitoli** | Trascrive il parlato, con un colore per ogni persona, lo traduce in inglese e permette di correggere le battute |
| 🗣 **Doppiaggio AI** | Riscrive una battuta e la fa dire a chi parla, con la sua voce, in una copia nuova del video. Richiede Python installato |
| ✂ **Montaggio** | Taglia, unisce, e converte in GIF o WebP animati |

Tutte le richieste a YouTube passano da **Tor**: il sito non vede il tuo
indirizzo IP. Non servono account e non c'è telemetria.

## Note

MediaFlow è pensato per uso **personale**: usalo solo con contenuti di cui hai
il diritto di fruire, nel rispetto dei
[Termini di Servizio di YouTube](https://www.youtube.com/t/terms) e del diritto
d'autore. Rilasciato sotto
**[PolyForm Noncommercial License 1.0.0](LICENSE)**.
