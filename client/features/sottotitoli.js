/* Sezione Sottotitoli: correggerli guardando il video.
 *
 * I sottotitoli non li disegna il lettore ma questa pagina, sopra il video,
 * dai riquadri che ha in memoria. E' tutto il senso della sezione: una
 * correzione scritta nell'elenco si vede sul video nello stesso istante, senza
 * salvare e senza rifare niente.
 *
 * Chi parla e' un colore
 *     Nel file ogni voce ha il suo colore, sempre lo stesso per tutto il
 *     video, e non ha un nome: qui si chiamano Voce 1, Voce 2, nell'ordine in
 *     cui compaiono. Cambiare la voce di una riga vuol dire cambiarle colore;
 *     una riga senza colore e' bianca - una persona sola, o un suono.
 *
 * Due bottoni
 *     Aggiorna salva il .srt, rifa' dal testo corretto la traduzione (se
 *     c'era), rimette le tracce nel file e, se l'interruttore e' acceso,
 *     ridisegna la copia impressa. Si corregge la lingua originale; la
 *     traduzione la segue.
 *     Esporta scrive una copia dei sottotitoli dove si sceglie, in SRT o in
 *     WebVTT: nella lingua originale com'e' adesso nell'editor, o in una
 *     traduzione gia' fatta.
 */

let S_FILE = '';
let S_RIQUADRI = [];        // [{inizio, fine, righe: [{testo, colore, lineetta}]}]
let S_SPORCO = false;       // ci sono correzioni non ancora aggiornate
let S_ATTIVO = -1;          // il riquadro a schermo in questo momento
let S_TAVOLOZZA = [];       // i colori fra cui scegliere una voce nuova
let S_SCHEDA = null;        // le misure del video aperto

const S$ = (id) => document.getElementById(id);

function initSottotitoli() {
  S$('s-file').addEventListener('click', async () => {
    const e = await window.pywebview.api.scegli_file(false, 'video');
    if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
    if (!e.file.length) return;
    apriSottotitoli(e.file[0]);
  });
  S$('s-aggiorna').addEventListener('click', aggiornaSottotitoli);
  S$('s-esporta').addEventListener('click', esportaSottotitoli);
  S$('s-mostra').addEventListener('change', disegnaTesto);
  S$('s-nuovo').addEventListener('click', () => {
    if (!S_FILE) return;
    if (S_RIQUADRI.length) aggiungiDopo(S_RIQUADRI.length - 1); else aggiungiPrimo();
  });
  svuotaSottotitoli();

  window.registraSezione('sub', {
    riabilita: statoBottoni,
    scorciatoia: aggiornaSottotitoli,
    traduci: () => {
      S$('s-nuovo').title = window.t('sub.nuovo');
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
  S_TAVOLOZZA = e.tavolozza || [];
  S_SCHEDA = { nome: e.nome, ...(e.scheda || {}) };
  S_ATTIVO = -1;
  S_SPORCO = false;
  S$('s-file').value = e.nome;
  S$('s-nome').textContent = e.nome;

  // Le lingue in cui i sottotitoli ci sono: l'originale e le traduzioni.
  const lingua = S$('s-lingua');
  lingua.innerHTML = '';
  (e.lingue && e.lingue.length ? e.lingue : ['']).forEach((codice) => {
    const o = document.createElement('option');
    o.value = codice;
    const chiave = 'sub.lingua.' + (codice || 'originale');
    o.textContent = window.t(chiave) === chiave ? codice.toUpperCase() : window.t(chiave);
    lingua.appendChild(o);
  });

  preparaVideo(e.video);
  disegnaElenco();
  disegnaSorgenteSub();
  aggiornaNota();
}

function svuotaSottotitoli() {
  const schermo = S$('s-schermo');
  schermo.innerHTML = '';
  schermo.appendChild(window.statoVuoto(window.t('sub.video.empty')));
  const elenco = S$('s-elenco');
  elenco.innerHTML = '';
  elenco.appendChild(window.statoVuoto(window.t('sub.list.empty')));
  S$('s-nome').textContent = '';
  S$('s-voci').innerHTML = '';
  S$('s-quanti').textContent = '0';
  S$('s-conteggio').textContent = '';
  disegnaSorgenteSub();
  statoBottoni();
}

function statoBottoni() {
  S$('s-aggiorna').disabled = !S_FILE;
  S$('s-esporta').disabled = !S_FILE;
}

function aggiornaNota() {
  S$('s-nota').textContent = S_SPORCO ? window.t('sub.modificato') : '';
  statoBottoni();
}

function disegnaSorgenteSub() {
  const box = S$('s-sorgente');
  box.innerHTML = '';
  if (!S_FILE || !S_SCHEDA) {
    box.appendChild(window.el('p', 'nota-riga', window.t('sub.sorgente.vuoto')));
    return;
  }
  const capo = window.el('div', 'scelto-capo');
  capo.appendChild(window.icona('i-video', 'icona grande'));
  const nomi = window.el('div', 'brano-nomi');
  nomi.appendChild(window.el('strong', '', S_SCHEDA.nome));
  nomi.appendChild(window.el('span', '', [
    S_SCHEDA.altezza ? S_SCHEDA.altezza + 'p' : '',
    S_SCHEDA.fps ? Math.round(S_SCHEDA.fps) + ' fps' : '',
    S_SCHEDA.peso ? pesoLeggibile(S_SCHEDA.peso) : '',
    S_SCHEDA.durata || '',
  ].filter(Boolean).join('  ·  ')));
  capo.appendChild(nomi);
  box.appendChild(capo);
}

/* ── Le voci ───────────────────────────────────────────────────────────── */

/* I colori in uso, nell'ordine in cui compaiono: sono le voci del video. */
function vociInUso() {
  const voci = [];
  S_RIQUADRI.forEach((r) => r.righe.forEach((rg) => {
    const c = (rg.colore || '').toUpperCase();
    if (c && !voci.includes(c)) voci.push(c);
  }));
  return voci;
}

function nomeVoce(colore, voci) {
  const n = voci.indexOf((colore || '').toUpperCase());
  return n < 0 ? window.t('sub.voce.nessuna') : window.t('sub.voce', { n: n + 1 });
}

/* La voce dopo quella di una riga: le voci del video, poi una nuova presa dal
 * primo colore libero, poi nessuna, e si ricomincia. */
function voceSuccessiva(colore) {
  const voci = vociInUso();
  const nuova = S_TAVOLOZZA.find((c) => !voci.includes(c.toUpperCase()));
  const giro = voci.concat(nuova ? [nuova.toUpperCase()] : [], ['']);
  return giro[(giro.indexOf((colore || '').toUpperCase()) + 1) % giro.length];
}

function disegnaVoci() {
  const voci = vociInUso();
  const box = S$('s-voci');
  box.innerHTML = '';
  voci.forEach((colore) => {
    const voce = window.el('span', 's-voce');
    const punto = window.el('i', 's-punto');
    punto.style.background = colore;
    voce.appendChild(punto);
    voce.appendChild(window.el('span', '', nomeVoce(colore, voci)));
    box.appendChild(voce);
  });
  S$('s-quanti').textContent = String(S_RIQUADRI.length);
  S$('s-conteggio').textContent = S_FILE
    ? window.t('sub.conteggio', { n: S_RIQUADRI.length, voci: Math.max(voci.length, 1) }) : '';
}

/* ── Il video, e i sottotitoli sopra ───────────────────────────────────── */

function preparaVideo(url) {
  const schermo = S$('s-schermo');
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

function disegnaTesto() {
  const video = S$('s-video');
  const box = S$('s-testo');
  if (!video || !box) return;
  const t = video.currentTime;
  const i = S_RIQUADRI.findIndex((r) => r.inizio <= t && t < r.fine);
  box.innerHTML = '';
  if (i >= 0 && S$('s-mostra').checked) {
    S_RIQUADRI[i].righe.forEach((riga) => {
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

/* ── L'elenco dei segmenti ─────────────────────────────────────────────── */

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
  const elenco = S$('s-elenco');
  elenco.innerHTML = '';
  disegnaVoci();
  if (!S_RIQUADRI.length) {
    elenco.appendChild(window.statoVuoto(window.t('sub.list.empty')));
    return;
  }
  S_RIQUADRI.forEach((r, i) => elenco.appendChild(rigaElenco(r, i)));
  evidenzia(false);
}

function rigaElenco(r, i) {
  const riga = document.createElement('div');
  riga.className = 's-battuta';
  riga.dataset.i = i;

  // In testa: il numero, i due tempi (che si scrivono), e come toglierlo.
  const capo = window.el('div', 's-capo');
  const vaiQui = window.el('button', 's-numero', String(i + 1).padStart(2, '0'));
  vaiQui.type = 'button';
  vaiQui.title = window.t('sub.vai');
  vaiQui.addEventListener('click', (e) => { e.stopPropagation(); vai(r.inizio, true); });
  capo.appendChild(vaiQui);
  [['inizio', r.inizio], ['fine', r.fine]].forEach(([chiave, valore], k) => {
    if (k) capo.appendChild(window.el('span', 's-freccia', '→'));
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
    capo.appendChild(campo);
  });
  const azioni = window.el('div', 's-azioni');
  azioni.appendChild(bottoncino('', '+', () => aggiungiDopo(i), window.t('sub.add')));
  azioni.appendChild(bottoncino('', '×', () => togli(i), window.t('sub.delete')));
  capo.appendChild(azioni);
  riga.appendChild(capo);

  const voci = vociInUso();
  r.righe.forEach((rg) => {
    // Chi dice la riga: un bottone col suo colore, che a ogni clic passa alla
    // voce successiva.
    const voce = window.el('button', 's-voce');
    voce.type = 'button';
    voce.title = window.t('sub.voce.cambia');
    const punto = window.el('i', 's-punto');
    punto.style.background = rg.colore || 'var(--t2)';
    voce.appendChild(punto);
    voce.appendChild(window.el('span', '', nomeVoce(rg.colore, voci)));
    voce.addEventListener('click', (e) => {
      e.stopPropagation();
      rg.colore = voceSuccessiva(rg.colore);
      sporca();
      disegnaElenco();
    });
    riga.appendChild(voce);

    // Un'area di testo e non un campo: una riga da 40 caratteri non ci sta
    // nella colonna, e tagliata non si potrebbe correggere. Cresce con la
    // frase, e Invio non va a capo - un sottotitolo e' una riga.
    const campo = document.createElement('textarea');
    campo.className = 's-riga';
    campo.rows = 1;
    campo.value = rg.testo;
    campo.spellcheck = false;
    const altezza = () => { campo.style.height = 'auto'; campo.style.height = campo.scrollHeight + 'px'; };
    campo.addEventListener('input', () => {
      campo.value = campo.value.replace(/\n/g, ' ');
      rg.testo = campo.value;
      altezza();
      sporca();
    });
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey) e.preventDefault(); });
    // Entrando in una riga il video si ferma li': si corregge quello che si vede.
    campo.addEventListener('focus', () => vai(r.inizio, false));
    requestAnimationFrame(altezza);
    riga.appendChild(campo);
  });

  // Un clic sul segmento (non nei campi) porta il video a quel punto.
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
  const video = S$('s-video');
  if (!video) return;
  if (!suona) video.pause();
  video.currentTime = secondi + 0.01;
  if (suona) video.play();
  disegnaTesto();
}

function aggiungiDopo(i) {
  const r = S_RIQUADRI[i];
  const dopo = S_RIQUADRI[i + 1];
  const inizio = r.fine + 0.05;
  const fine = dopo ? Math.max(inizio + 0.5, dopo.inizio - 0.05) : inizio + 2;
  S_RIQUADRI.splice(i + 1, 0, {
    inizio, fine,
    righe: [{ testo: '', colore: r.righe[0] ? r.righe[0].colore : '', lineetta: false }],
  });
  sporca();
  disegnaElenco();
  const campo = S$('s-elenco').querySelector('[data-i="' + (i + 1) + '"] .s-riga');
  if (campo) campo.focus();
}

/* Il primo segmento di un video che non ne ha: due secondi, dal punto in cui
 * si e'. */
function aggiungiPrimo() {
  const video = S$('s-video');
  const inizio = video ? video.currentTime : 0;
  S_RIQUADRI.push({ inizio, fine: inizio + 2, righe: [{ testo: '', colore: '', lineetta: false }] });
  sporca();
  disegnaElenco();
}

function togli(i) {
  S_RIQUADRI.splice(i, 1);
  sporca();
  disegnaElenco();
}

function evidenzia(scorri) {
  const elenco = S$('s-elenco');
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

/* ── Aggiornare, esportare ────────────────────────────────────────────── */

async function aggiornaSottotitoli() {
  if (!S_FILE) return;
  const e = await window.pywebview.api.sub_aggiorna(S_FILE, S_RIQUADRI, S$('s-impressa').checked);
  if (!e.ok) { window.errore(e.errore, 'sub'); return; }
  S_SPORCO = false;
  aggiornaNota();
}

async function esportaSottotitoli() {
  if (!S_FILE) return;
  const e = await window.pywebview.api.sub_esporta(
    S_FILE, S_RIQUADRI, S$('s-formato').value, S$('s-lingua').value);
  if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
  // Senza un file, la finestra di salvataggio e' stata chiusa: non e' successo
  // niente e non c'e' niente da dire.
  if (e.file) window.avvisa(e.testo, 'ok');
}

/* A lavoro finito il video si ricarica, dal punto in cui era: la traccia nel
 * file e' cambiata, e quello che si vede deve essere il file com'e' adesso. */
window.ascolta('subFinito', (s, dati) => {
  s.testo.textContent = dati.testo;
  window.avvisa(dati.testo, dati.ok ? 'ok' : 'fail');
  const video = S$('s-video');
  if (video && dati.video) {
    const dove = video.currentTime;
    video.addEventListener('loadedmetadata', () => { video.currentTime = dove; }, { once: true });
    video.src = dati.video + '?v=' + Date.now();
  }
});

window.initSottotitoli = initSottotitoli;
