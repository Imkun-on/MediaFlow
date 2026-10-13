/* Sezione Montaggio.
 *
 * Quattro operazioni, una linguetta ciascuna: Taglia, GIF, WebP, Unisci. Le
 * prime tre lavorano tutte su un pezzo di un video, e quel pezzo lo si sceglie
 * allo stesso modo: sulla timeline, trascinando le due maniglie. Quello che
 * cambia e' cosa esce - uno spezzone, un'animazione - e le opzioni a destra.
 * Unisci non ha una timeline: ha un elenco di file, nell'ordine in cui vanno
 * messi.
 *
 * La timeline
 *     Dieci fotogrammi presi a passo regolare, che Python ricava dal video
 *     quando lo si sceglie, e sotto la forma d'onda dell'audio, che arriva
 *     un attimo dopo perche' su un video lungo costa qualche secondo. Sopra,
 *     la selezione fra le due maniglie e la testina del punto in cui si e'.
 *
 *     Play fa sentire lo spezzone, non il video: parte dall'inizio della
 *     selezione e alla fine si ferma. E' il modo di controllare un taglio
 *     prima di farlo.
 */

let C_AZIONE = 'taglia';
let C_FILE = [];
let C_INFO = null;        // quello che Python sa del video scelto
let C_DA = 0;
let C_A = 0;
let C_VIDEO = null;       // il <video> dello schermo

const C$ = (id) => document.getElementById(id);
const C_CON_TIMELINE = ['taglia', 'gif', 'webp'];

/* ── Tempi ─────────────────────────────────────────────────────────────── */

function tempoScritto(secondi) {
  const s = Math.max(0, secondi || 0);
  const ore = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = (s % 60).toFixed(1).padStart(4, '0');
  return (ore ? ore + ':' : '') + mm + ':' + ss;
}

/* Un istante scritto a mano: 90, 1:30, 01:02:03.5. NaN se non si capisce. */
function tempoLetto(testo) {
  const parti = String(testo).trim().replace(',', '.').split(':').map(Number);
  if (!parti.length || parti.length > 3 || parti.some((p) => !isFinite(p) || p < 0)) return NaN;
  return parti.reduce((somma, p) => somma * 60 + p, 0);
}

/* ── Cosa serve a ogni operazione ──────────────────────────────────────── */

function mostraPerOperazione() {
  document.querySelectorAll('.sezione[data-sez="clip"] [data-per]').forEach((nodo) => {
    nodo.hidden = !nodo.dataset.per.split(' ').includes(C_AZIONE);
  });
  C$('c-desc').textContent = window.t('clip.desc.' + C_AZIONE);
  C$('c-etichetta-file').textContent =
    window.t(C_AZIONE === 'unisci' ? 'clip.files' : 'clip.file');
  C$('c-avvia-testo').textContent = window.t('clip.esporta.' + C_AZIONE);
  notaCodec();
}

/* Non tutti i codec stanno in tutti i contenitori: invece di lasciar fallire
 * FFmpeg a meta' lavoro, la scelta impossibile si corregge qui e lo si dice. */
function notaCodec() {
  const contenitore = C$('c-contenitore').value;
  const codec = C$('c-codec');
  let nota = '';
  if (contenitore === 'webm' && codec.value !== 'av1') {
    codec.value = 'av1'; nota = window.t('clip.nota.webm');
  } else if (contenitore === 'mov' && codec.value === 'av1') {
    codec.value = 'h264'; nota = window.t('clip.nota.mov');
  }
  if (nota) codec.dispatchEvent(new Event('change'));
  if (!nota && (codec.value || C$('c-risoluzione').value)) nota = window.t('clip.nota.ricodifica');
  C$('c-nota-codec').textContent = nota;
}

/* ── Lo schermo ────────────────────────────────────────────────────────── */

function disegnaBanco() {
  const banco = C$('c-banco');
  banco.innerHTML = '';
  C_VIDEO = null;
  C$('c-nome-file').textContent = C_INFO ? C_INFO.nome : '';
  disegnaSorgente();

  if (C_AZIONE === 'unisci') { disegnaElencoUnione(banco); return; }
  if (!C_INFO) {
    banco.appendChild(window.statoVuoto(window.t('clip.banco.vuoto')));
    scriviSelezione();
    return;
  }

  const schermo = window.el('div', 'p-schermo');
  const palco = window.el('div', 'p-palco');
  const cornice = window.el('div', 'p-cornice');
  cornice.style.setProperty('--rapporto', (C_INFO.larghezza / C_INFO.altezza).toFixed(4));
  const video = document.createElement('video');
  video.preload = 'auto'; video.playsInline = true;
  video.src = C_INFO.video;
  C_VIDEO = video;
  cornice.appendChild(video);
  cornice.appendChild(window.el('span', 'p-angolo', window.t('pix.anteprima')));
  palco.appendChild(cornice);
  schermo.appendChild(palco);

  const comandi = window.el('div', 'p-comandi');
  const play = window.el('button', 'lettore-play');
  play.type = 'button';
  play.innerHTML = ICONA_PLAY;
  const ora = window.el('span', 'lettore-ora', tempoScritto(0));
  const totale = window.el('span', 'lettore-ora', '/ ' + tempoScritto(C_INFO.durata));
  comandi.append(play, ora, totale);
  schermo.appendChild(comandi);
  banco.appendChild(schermo);
  banco.appendChild(disegnaTimeline());

  // Play fa sentire la selezione: fuori da quella, riparte dal suo inizio.
  const alterna = () => {
    if (!video.paused) { video.pause(); return; }
    if (video.currentTime < C_DA || video.currentTime >= C_A - 0.05) video.currentTime = C_DA;
    const p = video.play(); if (p) p.catch(() => {});
  };
  play.addEventListener('click', alterna);
  cornice.addEventListener('click', alterna);
  video.addEventListener('play', () => { play.innerHTML = ICONA_PAUSA; });
  video.addEventListener('pause', () => { play.innerHTML = ICONA_PLAY; });
  video.addEventListener('timeupdate', () => {
    if (!video.paused && video.currentTime >= C_A) { video.pause(); video.currentTime = C_A; }
    ora.textContent = tempoScritto(video.currentTime);
    C$('c-traccia').style.setProperty('--testina', quota(video.currentTime));
  });
  video.addEventListener('seeked', () => {
    ora.textContent = tempoScritto(video.currentTime);
    C$('c-traccia').style.setProperty('--testina', quota(video.currentTime));
  });
  scriviSelezione();
}

const quota = (secondi) =>
  (C_INFO && C_INFO.durata ? (secondi / C_INFO.durata) * 100 : 0).toFixed(3) + '%';

/* ── La timeline ───────────────────────────────────────────────────────── */

function disegnaTimeline() {
  const d = C_INFO.durata;
  const timeline = window.el('div', 'timeline');

  const capo = window.el('div', 'timeline-capo');
  const titolo = window.el('h2', '');
  titolo.appendChild(window.icona('i-forbici', 'icona'));
  titolo.appendChild(window.el('span', '', window.t('clip.timeline')));
  const ripristina = window.el('button', 'bottone nudo', window.t('clip.ripristina'));
  ripristina.type = 'button';
  ripristina.addEventListener('click', () => { C_DA = 0; C_A = d; scriviSelezione(); });
  const scelti = window.el('span', 'timeline-scelti');
  scelti.id = 'c-scelti';
  capo.append(titolo, ripristina, scelti);
  timeline.appendChild(capo);

  const righello = window.el('div', 'timeline-righello');
  for (let i = 0; i <= 6; i++) righello.appendChild(window.el('span', '', tempoScritto((d * i) / 6)));
  timeline.appendChild(righello);

  const traccia = window.el('div', 'timeline-traccia');
  traccia.id = 'c-traccia';
  const fotogrammi = window.el('div', 'timeline-fotogrammi');
  (C_INFO.fotogrammi || []).forEach((url) => {
    const img = new Image();
    img.alt = ''; img.draggable = false;
    img.onerror = () => img.remove();
    img.src = url;
    fotogrammi.appendChild(img);
  });
  traccia.appendChild(fotogrammi);
  traccia.appendChild(window.el('div', 'timeline-scelta'));
  traccia.appendChild(window.el('div', 'timeline-testina'));

  // Toccando o trascinando la striscia ci si sposta nel video.
  const presa = window.el('div', 'timeline-presa');
  const vai = (e) => {
    const r = presa.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (C_VIDEO) C_VIDEO.currentTime = f * d;
  };
  presa.addEventListener('pointerdown', (e) => { presa.setPointerCapture(e.pointerId); vai(e); });
  presa.addEventListener('pointermove', (e) => { if (e.buttons) vai(e); });
  traccia.appendChild(presa);

  // Le due maniglie sono due cursori sovrapposti alla striscia: si afferra
  // solo il loro pomello, il resto lascia passare i clic alla striscia sotto.
  const maniglia = (classe, leggi, scrivi) => {
    const m = document.createElement('input');
    m.type = 'range'; m.className = 'taglio-maniglia ' + classe;
    m.min = 0; m.max = d; m.step = 0.1; m.value = leggi();
    m.addEventListener('input', () => {
      scrivi(+m.value);
      scriviSelezione();
      // Mentre si sposta una maniglia il video la segue: si vede dove taglia.
      if (C_VIDEO) C_VIDEO.currentTime = +m.value;
    });
    return m;
  };
  traccia.appendChild(maniglia('da', () => C_DA,
    (v) => { C_DA = Math.min(v, C_A - 0.1); }));
  traccia.appendChild(maniglia('a', () => C_A,
    (v) => { C_A = Math.max(v, C_DA + 0.1); }));
  timeline.appendChild(traccia);

  const audio = window.el('div', 'timeline-audio');
  audio.appendChild(window.icona('i-volume', 'icona'));
  audio.appendChild(window.el('span', '', window.t(
    C_INFO.audio ? 'clip.audio_originale' : 'clip.senza_audio')));
  const onda = window.el('div', 'timeline-onda');
  onda.id = 'c-onda';
  audio.appendChild(onda);
  timeline.appendChild(audio);

  const campi = window.el('div', 'timeline-campi');
  const campo = (chiave, id, leggi, scrivi) => {
    const l = window.el('label', '');
    l.appendChild(window.el('span', '', window.t(chiave)));
    const i = document.createElement('input');
    i.type = 'text'; i.id = id; i.spellcheck = false;
    i.addEventListener('change', () => {
      const v = tempoLetto(i.value);
      if (isFinite(v)) scrivi(Math.max(0, Math.min(d, v)));
      scriviSelezione();
    });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); });
    l.appendChild(i);
    return l;
  };
  campi.appendChild(campo('clip.inizio', 'c-da', () => C_DA,
    (v) => { C_DA = Math.min(v, C_A - 0.1); }));
  campi.appendChild(campo('clip.fine', 'c-a', () => C_A,
    (v) => { C_A = Math.max(v, C_DA + 0.1); }));
  const uscita = window.el('span', 'timeline-uscita', window.t('clip.durata_uscita') + ' ');
  const quanto = window.el('strong', '');
  quanto.id = 'c-durata';
  uscita.appendChild(quanto);
  campi.appendChild(uscita);
  timeline.appendChild(campi);
  return timeline;
}

/* La selezione, scritta dappertutto dove compare: sulla striscia, nei campi,
 * nel pannello di destra. */
function scriviSelezione() {
  const c = C_INFO && C_CON_TIMELINE.includes(C_AZIONE);
  C$('c-sel-da').textContent = c ? tempoScritto(C_DA) : '—';
  C$('c-sel-a').textContent = c ? tempoScritto(C_A) : '—';
  C$('c-sel-durata').textContent = c ? tempoScritto(C_A - C_DA) : '—';
  const traccia = C$('c-traccia');
  if (!c || !traccia) return;
  traccia.style.setProperty('--da', quota(C_DA));
  traccia.style.setProperty('--a', quota(C_A));
  traccia.querySelector('.taglio-maniglia.da').value = C_DA;
  traccia.querySelector('.taglio-maniglia.a').value = C_A;
  C$('c-da').value = tempoScritto(C_DA);
  C$('c-a').value = tempoScritto(C_A);
  C$('c-durata').textContent = tempoScritto(C_A - C_DA);
  C$('c-scelti').textContent = window.t('clip.selezionati', { tempo: tempoScritto(C_A - C_DA) });
}

/* ── Il file scelto ────────────────────────────────────────────────────── */

function disegnaSorgente() {
  const box = C$('c-sorgente');
  box.innerHTML = '';
  if (C_AZIONE === 'unisci' || !C_INFO) {
    box.appendChild(window.el('p', 'nota-riga', window.t(
      C_AZIONE === 'unisci' && C_FILE.length ? 'clip.sorgente.unione' : 'clip.sorgente.vuoto',
      { n: C_FILE.length })));
    return;
  }
  const capo = window.el('div', 'scelto-capo');
  capo.appendChild(window.icona('i-video', 'icona grande'));
  const nomi = window.el('div', 'brano-nomi');
  nomi.appendChild(window.el('strong', '', C_INFO.nome));
  nomi.appendChild(window.el('span', '',
    C_INFO.altezza + 'p  ·  ' + Math.round(C_INFO.fps) + ' fps  ·  ' + pesoLeggibile(C_INFO.peso)));
  capo.appendChild(nomi);
  box.appendChild(capo);
  const dati = window.el('dl', 'scheda-dati');
  [['clip.duration', tempoScritto(C_INFO.durata)],
   ['clip.audio_colonna', C_INFO.audio || window.t('clip.senza_audio')],
  ].forEach(([chiave, valore]) => {
    const riga = document.createElement('div');
    riga.appendChild(window.el('dt', '', window.t(chiave)));
    riga.appendChild(window.el('dd', '', valore));
    dati.appendChild(riga);
  });
  box.appendChild(dati);
}

function disegnaElencoUnione(banco) {
  if (!C_FILE.length) {
    banco.appendChild(window.statoVuoto(window.t('clip.unisci.vuoto')));
    return;
  }
  const elenco = window.el('div', 'elenco');
  C_FILE.forEach((f, i) => {
    const riga = window.el('div', 'scheda');
    riga.appendChild(window.el('div', 'numero-tondo', String(i + 1).padStart(2, '0')));
    const testo = window.el('div', 'scheda-testo');
    testo.appendChild(window.el('div', 'scheda-titolo', f.split(/[\\/]/).pop()));
    riga.appendChild(testo);
    elenco.appendChild(riga);
  });
  banco.appendChild(elenco);
}

async function scegliFile() {
  const unione = C_AZIONE === 'unisci';
  const e = await window.pywebview.api.scegli_file(unione, 'video');
  if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
  if (!e.file.length) return;
  C_FILE = e.file;
  // Nel campo i nomi, non i percorsi: dove stanno lo si sa gia'.
  C$('c-file').value = C_FILE.map((f) => f.split(/[\\/]/).pop()).join('  ·  ');
  C_INFO = null;
  if (unione) { disegnaBanco(); return; }

  const info = await window.pywebview.api.clip_apri(C_FILE[0]);
  if (!info.ok) { disegnaBanco(); window.errore(info.errore, 'clip'); return; }
  C_INFO = info;
  C_DA = 0;
  C_A = info.durata;
  disegnaBanco();

  // L'onda arriva dopo: la timeline non la aspetta per comparire.
  if (!info.audio) return;
  const percorso = C_FILE[0];
  const onda = await window.pywebview.api.clip_onda(percorso);
  const dove = C$('c-onda');
  if (onda.ok && dove && C_FILE[0] === percorso) {
    const img = new Image();
    img.alt = ''; img.draggable = false;
    img.onerror = () => img.remove();
    img.src = onda.onda;
    dove.appendChild(img);
  }
}

/* ── Il lavoro ─────────────────────────────────────────────────────────── */

async function esegui() {
  const opzioni = { azione: C_AZIONE, file: C_FILE };
  if (C_AZIONE === 'taglia') {
    // Senza un video aperto la selezione non c'e': decide Python che manca.
    if (C_INFO) { opzioni.da = String(C_DA); opzioni.a = String(C_A); }
    opzioni.contenitore = C$('c-contenitore').value;
    opzioni.codec = C$('c-codec').value;
    opzioni.altezza = C$('c-risoluzione').value;
    opzioni.audio = C$('c-audio').checked;
    opzioni.preciso = C$('c-preciso').checked;
  } else if (C_AZIONE === 'unisci') {
    opzioni.capitoli = C$('c-capitoli').checked;
  } else {
    if (C_INFO) { opzioni.da = String(C_DA); opzioni.durata = String(C_A - C_DA); }
    ['fps', 'larghezza'].forEach((campo) => {
      const v = C$('c-' + campo).value.trim();
      if (v) opzioni[campo] = v;
    });
  }
  const esito = await window.pywebview.api.clip_esegui(opzioni);
  if (!esito.ok) window.errore(esito.errore, 'clip');
}

/* Quello che esce si guarda sul banco, al posto del video di partenza: lo
 * spezzone e l'unione nel lettore, la GIF e il WebP come immagini. */
window.ascolta('clipFinito', (s, dati) => {
  window.avvisa(dati.testo, dati.ok ? 'ok' : 'fail');
  if (!dati.ok || !dati.anteprima) return;
  const banco = C$('c-banco');
  banco.innerHTML = '';
  C_VIDEO = null;

  const capo = window.el('div', 'timeline-capo');
  capo.appendChild(window.el('h2', '', window.t('clip.result') + '  ·  ' + dati.file));
  const torna = window.el('button', 'bottone nudo', window.t('clip.torna'));
  torna.type = 'button';
  torna.addEventListener('click', disegnaBanco);
  capo.appendChild(torna);
  banco.appendChild(capo);

  const anteprima = window.el('div', 'anteprima');
  if (/\.(gif|webp)$/i.test(dati.file)) {
    const img = new Image();
    img.alt = ''; img.className = 'immagine-piena';
    img.onerror = disegnaBanco;
    img.src = dati.anteprima + '?v=' + Date.now();
    anteprima.appendChild(img);
  } else {
    const video = document.createElement('video');
    video.className = 'anteprima-video';
    video.controls = true;
    video.src = dati.anteprima + '?v=' + Date.now();
    anteprima.appendChild(video);
  }
  banco.appendChild(anteprima);
});

function initClip() {
  C$('c-avvia').addEventListener('click', esegui);
  C$('c-file').addEventListener('click', scegliFile);
  ['c-contenitore', 'c-codec', 'c-risoluzione'].forEach((id) =>
    C$(id).addEventListener('change', notaCodec));
  mostraPerOperazione();
  disegnaBanco();

  window.registraSezione('clip', {
    scorciatoia: esegui,
    predefinita: C_AZIONE,
    // Una linguetta: si cambia operazione. Fra Taglia, GIF e WebP il video e
    // la selezione restano; Unisci ne vuole piu' d'uno, e si ricomincia.
    sottosezione: (azione) => {
      if (azione === C_AZIONE) return;
      const cambiaGenere = (azione === 'unisci') !== (C_AZIONE === 'unisci');
      C_AZIONE = azione;
      if (cambiaGenere) { C_FILE = []; C_INFO = null; C$('c-file').value = ''; }
      mostraPerOperazione();
      disegnaBanco();
    },
    traduci: () => { mostraPerOperazione(); disegnaBanco(); },
  });
}

window.initClip = initClip;
