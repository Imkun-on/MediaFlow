/* Sezione Sottotitoli: correggerli guardando il video.
 *
 * I sottotitoli non li disegna il lettore ma questa pagina, sopra il video,
 * dai riquadri che ha in memoria. E' tutto il senso della sezione: una
 * correzione scritta nell'elenco si vede sul video nello stesso istante, senza
 * salvare e senza rifare niente.
 *
 * Un bottone solo, Aggiorna: salva il .srt, rifa' dal testo corretto la
 * traduzione (se c'era), rimette le tracce nel file e ridisegna la copia
 * impressa. Si corregge la lingua originale; la traduzione la segue.
 */

let S_FILE = '';
let S_RIQUADRI = [];        // [{inizio, fine, righe: [{testo, colore, lineetta}]}]
let S_SPORCO = false;       // ci sono correzioni non ancora aggiornate
let S_ATTIVO = -1;          // il riquadro a schermo in questo momento

function initSottotitoli() {
  const $ = window.$;
  $('#s-file').addEventListener('click', async () => {
    const e = await window.pywebview.api.scegli_file(false, 'video');
    if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
    if (!e.ok || !e.file.length) return;
    apriSottotitoli(e.file[0]);
  });
  $('#s-aggiorna').addEventListener('click', aggiornaSottotitoli);
  svuotaSottotitoli();

  window.registraSezione('sub', {
    riabilita: statoBottoni,
    scorciatoia: aggiornaSottotitoli,
    traduci: () => {
      if (!S_FILE) svuotaSottotitoli();
      aggiornaNota();
    },
  });
}

/* ── Aprire ────────────────────────────────────────────────────────────── */

async function apriSottotitoli(percorso) {
  const e = await window.pywebview.api.sub_apri(percorso);
  if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
  S_FILE = percorso;
  S_RIQUADRI = e.riquadri;
  S_ATTIVO = -1;
  S_SPORCO = false;
  window.$('#s-file').value = e.nome;
  window.$('#s-nome').textContent = e.nome;
  preparaVideo(e.video);
  disegnaElenco();
  aggiornaNota();
}

function svuotaSottotitoli() {
  const schermo = window.$('#s-schermo');
  schermo.innerHTML = '';
  schermo.appendChild(window.statoVuoto(window.t('sub.video.empty')));
  const elenco = window.$('#s-elenco');
  elenco.innerHTML = '';
  elenco.appendChild(window.statoVuoto(window.t('sub.list.empty')));
  window.$('#s-nome').textContent = '';
  statoBottoni();
}

function statoBottoni() {
  window.$('#s-aggiorna').disabled = !S_FILE;
}

function aggiornaNota() {
  window.$('#s-nota').textContent = S_SPORCO ? window.t('sub.modificato') : '';
  statoBottoni();
}

/* ── Il video, e i sottotitoli sopra ───────────────────────────────────── */

function preparaVideo(url) {
  const schermo = window.$('#s-schermo');
  schermo.innerHTML = '';
  const cornice = document.createElement('div');
  cornice.className = 's-cornice';
  const video = document.createElement('video');
  video.id = 's-video';
  video.controls = true;
  video.preload = 'auto';
  const testo = document.createElement('div');
  testo.className = 's-testo';
  testo.id = 's-testo';
  cornice.appendChild(video);
  cornice.appendChild(testo);
  schermo.appendChild(cornice);

  // Il riquadro del video si adatta allo spazio tenendo le proporzioni, e il
  // testo si misura sul riquadro: sono le stesse regole della copia impressa,
  // una riga da 40 caratteri sta dentro a qualunque larghezza.
  const adatta = () => {
    if (!video.videoWidth) return;
    const r = video.videoWidth / video.videoHeight;
    const w = Math.min(schermo.clientWidth, schermo.clientHeight * r);
    cornice.style.width = w + 'px';
    cornice.style.height = (w / r) + 'px';
    const alto = w / r;
    testo.style.fontSize = Math.min(alto * 0.05, (w * 0.88) / (40 * 0.58)) + 'px';
  };
  video.addEventListener('loadedmetadata', adatta);
  new ResizeObserver(adatta).observe(schermo);

  // timeupdate arriva quattro volte al secondo: troppo poco per un sottotitolo
  // che deve comparire con la voce. Mentre suona si segue ogni fotogramma.
  const segui = () => {
    disegnaTesto();
    if (!video.paused) requestAnimationFrame(segui);
  };
  video.addEventListener('play', () => requestAnimationFrame(segui));
  video.addEventListener('seeked', disegnaTesto);
  video.addEventListener('timeupdate', disegnaTesto);
  video.src = url;
}

function riquadriAttuali() {
  return S_RIQUADRI;
}

function disegnaTesto() {
  const video = document.getElementById('s-video');
  const box = document.getElementById('s-testo');
  if (!video || !box) return;
  const t = video.currentTime;
  const riquadri = riquadriAttuali();
  const i = riquadri.findIndex((r) => r.inizio <= t && t < r.fine);
  box.innerHTML = '';
  if (i >= 0) {
    riquadri[i].righe.forEach((riga) => {
      const d = document.createElement('div');
      d.textContent = (riga.lineetta ? '– ' : '') + riga.testo;
      d.style.color = riga.colore || '#FFFFFF';
      box.appendChild(d);
    });
  }
  if (i !== S_ATTIVO) {
    S_ATTIVO = i;
    evidenzia(!video.paused);
  }
}

/* ── L'elenco delle battute ────────────────────────────────────────────── */

function tempo(secondi) {
  const m = Math.floor(secondi / 60);
  const s = secondi - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
}

function leggiTempo(testo) {
  const p = String(testo).trim().replace(',', '.').split(':').map(Number);
  if (p.some((n) => Number.isNaN(n))) return null;
  return p.reduce((tot, n) => tot * 60 + n, 0);
}

function sporca() {
  S_SPORCO = true;
  aggiornaNota();
  disegnaTesto();
}

function disegnaElenco() {
  const elenco = window.$('#s-elenco');
  elenco.innerHTML = '';
  const riquadri = riquadriAttuali();
  if (!riquadri.length) {
    elenco.appendChild(window.statoVuoto(window.t('sub.list.empty')));
    return;
  }
  riquadri.forEach((r, i) => elenco.appendChild(rigaElenco(r, i)));
  evidenzia(false);
}

function rigaElenco(r, i) {
  const riga = document.createElement('div');
  riga.className = 's-battuta';
  riga.dataset.i = i;

  const tempi = document.createElement('div');
  tempi.className = 's-tempi';
  [['inizio', r.inizio], ['fine', r.fine]].forEach(([chiave, valore]) => {
    const campo = document.createElement('input');
    campo.className = 's-tempo';
    campo.value = tempo(valore);
    campo.spellcheck = false;
    campo.addEventListener('change', () => {
      const v = leggiTempo(campo.value);
      if (v === null) { campo.value = tempo(r[chiave]); return; }
      r[chiave] = v;
      campo.value = tempo(v);
      sporca();
    });
    tempi.appendChild(campo);
  });
  riga.appendChild(tempi);

  const testi = document.createElement('div');
  testi.className = 's-testi';
  r.righe.forEach((rg) => {
    // Un'area di testo e non un campo: una riga da 40 caratteri non ci sta
    // nella colonna, e tagliata non si potrebbe correggere. Cresce con la
    // frase, e Invio non va a capo - un sottotitolo e' una riga.
    const campo = document.createElement('textarea');
    campo.className = 's-riga';
    campo.rows = 1;
    campo.value = rg.testo;
    campo.spellcheck = false;
    campo.style.color = rg.colore || '';
    const altezza = () => { campo.style.height = 'auto'; campo.style.height = campo.scrollHeight + 'px'; };
    campo.addEventListener('input', () => {
      campo.value = campo.value.replace(/\n/g, ' ');
      rg.testo = campo.value;
      altezza();
      sporca();
    });
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey) e.preventDefault(); });
    requestAnimationFrame(altezza);
    testi.appendChild(campo);
  });
  riga.appendChild(testi);

  const azioni = document.createElement('div');
  azioni.className = 's-azioni';
  azioni.appendChild(bottoncino('i-avvia', '', () => vai(r.inizio, true)));
  azioni.appendChild(bottoncino('', '+', () => aggiungiDopo(i), window.t('sub.add')));
  azioni.appendChild(bottoncino('', '×', () => togli(i), window.t('sub.delete')));
  riga.appendChild(azioni);

  // Un clic sulla riga (non nei campi) porta il video a quella battuta.
  riga.addEventListener('click', (e) => {
    if (e.target.closest('input, textarea, button')) return;
    vai(r.inizio, false);
  });
  return riga;
}

function bottoncino(icona, testo, azione, titolo) {
  const b = document.createElement('button');
  b.className = 's-bottoncino';
  if (titolo) b.title = titolo;
  if (icona) {
    b.innerHTML = '<svg class="icona" viewBox="0 0 24 24"><use href="#' + icona + '"/></svg>';
  } else {
    b.textContent = testo;
  }
  b.addEventListener('click', (e) => { e.stopPropagation(); azione(); });
  return b;
}

function vai(secondi, suona) {
  const video = document.getElementById('s-video');
  if (!video) return;
  video.currentTime = secondi + 0.01;
  if (suona) video.play();
  disegnaTesto();
}

function aggiungiDopo(i) {
  const riquadri = riquadriAttuali();
  const r = riquadri[i];
  const dopo = riquadri[i + 1];
  const inizio = r.fine + 0.05;
  const fine = dopo ? Math.max(inizio + 0.5, dopo.inizio - 0.05) : inizio + 2;
  riquadri.splice(i + 1, 0, {
    inizio, fine,
    righe: [{ testo: '', colore: r.righe[0] ? r.righe[0].colore : '', lineetta: false }],
  });
  sporca();
  disegnaElenco();
  const campo = window.$('#s-elenco').querySelector('[data-i="' + (i + 1) + '"] .s-riga');
  if (campo) campo.focus();
}

function togli(i) {
  riquadriAttuali().splice(i, 1);
  sporca();
  disegnaElenco();
}

function evidenzia(scorri) {
  const elenco = window.$('#s-elenco');
  elenco.querySelectorAll('.s-battuta.attiva').forEach((e) => e.classList.remove('attiva'));
  if (S_ATTIVO < 0) return;
  const riga = elenco.querySelector('[data-i="' + S_ATTIVO + '"]');
  if (!riga) return;
  riga.classList.add('attiva');
  // Mentre il video suona l'elenco lo segue, ma non se si sta scrivendo:
  // strappare via la riga che si sta correggendo sarebbe peggio che niente.
  if (scorri && !elenco.contains(document.activeElement)) {
    riga.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/* ── Aggiornare ───────────────────────────────────────────────────────── */

async function aggiornaSottotitoli() {
  if (!S_FILE) return;
  const e = await window.pywebview.api.sub_aggiorna(S_FILE, S_RIQUADRI);
  if (!e.ok) { window.errore(e.errore, 'sub'); return; }
  S_SPORCO = false;
  aggiornaNota();
}

/* A lavoro finito il video si ricarica, dal punto in cui era: la traccia nel
 * file e' cambiata, e quello che si vede deve essere il file com'e' adesso. */
window.ascolta('subFinito', (s, dati) => {
  s.testo.textContent = dati.testo;
  window.avvisa(dati.testo, dati.ok ? 'ok' : 'fail');
  const video = document.getElementById('s-video');
  if (video && dati.video) {
    const dove = video.currentTime;
    video.addEventListener('loadedmetadata', () => { video.currentTime = dove; }, { once: true });
    video.src = dati.video + '?v=' + Date.now();
  }
});

window.initSottotitoli = initSottotitoli;
