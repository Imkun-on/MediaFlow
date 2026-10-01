/* Sezione Doppiaggio: far dire altro a chi parla, con la sua voce.
 *
 * A destra le battute del video, ognuna col colore di chi la dice e sotto un
 * campo per il testo nuovo: vuoto vuol dire «uguale all'originale». Doppia
 * manda a Python solo quelle cambiate; il lavoro e' lungo (minuti per ogni
 * frase su un portatile), e la stima si aggiorna mentre si scrive, cosi' si
 * sa prima quanto si aspettera'.
 *
 * A sinistra il video: l'originale, e a lavoro finito il doppiato. I due
 * bottoni sopra passano dall'uno all'altro.
 */

let D_FILE = '';
let D_BATTUTE = [];         // [{id, inizio, fine, colore, testo, nuovo}]
let D_STIMA = { base: 240, per_carattere: 3.6 };
let D_URL = { originale: '', doppiato: '' };

function initDoppiaggio() {
  const $ = window.$;
  $('#d-file').addEventListener('click', async () => {
    const e = await window.pywebview.api.scegli_file(false, 'video');
    if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
    if (!e.ok || !e.file.length) return;
    apriDoppiaggio(e.file[0]);
  });
  $('#d-avvia').addEventListener('click', doppia);
  $('#d-vedi-originale').addEventListener('click', () => mostraVideoDop('originale'));
  $('#d-vedi-doppiato').addEventListener('click', () => mostraVideoDop('doppiato'));
  svuotaDoppiaggio();

  window.registraSezione('dop', {
    riabilita: statoDoppia,
    scorciatoia: doppia,
    traduci: () => {
      if (!D_FILE) svuotaDoppiaggio();
      aggiornaStima();
    },
  });
}

async function apriDoppiaggio(percorso) {
  const e = await window.pywebview.api.dop_apri(percorso);
  if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
  D_FILE = percorso;
  D_BATTUTE = e.battute;
  D_STIMA = e.stima || D_STIMA;
  D_URL = { originale: e.video, doppiato: e.doppiato || '' };
  window.$('#d-file').value = e.nome;
  mostraVideoDop(D_URL.doppiato ? 'doppiato' : 'originale');
  disegnaBattute();
  aggiornaStima();
}

function svuotaDoppiaggio() {
  const schermo = window.$('#d-schermo');
  schermo.innerHTML = '';
  schermo.appendChild(window.statoVuoto(window.t('dop.video.empty')));
  const elenco = window.$('#d-elenco');
  elenco.innerHTML = '';
  elenco.appendChild(window.statoVuoto(window.t('dop.list.empty')));
  window.$('#d-nome').textContent = '';
  statoDoppia();
}

/* ── Il video ──────────────────────────────────────────────────────────── */

function mostraVideoDop(quale) {
  const url = D_URL[quale];
  if (!url) return;
  const schermo = window.$('#d-schermo');
  schermo.innerHTML = '';
  const video = document.createElement('video');
  video.id = 'd-video';
  video.className = 'anteprima-video';
  video.controls = true;
  video.src = url + (quale === 'doppiato' ? '?v=' + Date.now() : '');
  schermo.appendChild(video);
  window.$('#d-nome').textContent = window.t('dop.' + quale);
  // I due bottoni ci sono solo quando c'e' davvero da scegliere.
  window.$('#d-vedi-originale').hidden = !D_URL.doppiato || quale === 'originale';
  window.$('#d-vedi-doppiato').hidden = !D_URL.doppiato || quale === 'doppiato';
}

function vaiDop(secondi) {
  const video = document.getElementById('d-video');
  if (!video) return;
  video.currentTime = secondi + 0.01;
  video.play();
}

/* ── Le battute ────────────────────────────────────────────────────────── */

function tempoDop(secondi) {
  const m = Math.floor(secondi / 60);
  const s = Math.floor(secondi - m * 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function disegnaBattute() {
  const elenco = window.$('#d-elenco');
  elenco.innerHTML = '';
  if (!D_BATTUTE.length) {
    elenco.appendChild(window.statoVuoto(window.t('dop.list.empty')));
    return;
  }
  D_BATTUTE.forEach((b) => {
    const riga = document.createElement('div');
    riga.className = 'd-battuta' + (b.nuovo ? ' cambiata' : '');

    const testa = document.createElement('div');
    testa.className = 'd-testa';
    testa.appendChild(window.el('span', 'd-tempo', tempoDop(b.inizio)));
    const originale = window.el('span', 'd-originale', b.testo);
    originale.style.color = b.colore || '';
    testa.appendChild(originale);
    testa.addEventListener('click', () => vaiDop(b.inizio));
    riga.appendChild(testa);

    const campo = document.createElement('textarea');
    campo.className = 'd-nuovo';
    campo.rows = 1;
    campo.value = b.nuovo || '';
    campo.placeholder = window.t('dop.nuovo');
    campo.spellcheck = false;
    const altezza = () => { campo.style.height = 'auto'; campo.style.height = campo.scrollHeight + 'px'; };
    campo.addEventListener('input', () => {
      campo.value = campo.value.replace(/\n/g, ' ');
      b.nuovo = campo.value;
      riga.classList.toggle('cambiata', !!b.nuovo.trim() && b.nuovo.trim() !== b.testo);
      altezza();
      aggiornaStima();
    });
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey) e.preventDefault(); });
    requestAnimationFrame(altezza);
    riga.appendChild(campo);
    elenco.appendChild(riga);
  });
}

function riscritture() {
  const uscita = {};
  D_BATTUTE.forEach((b) => {
    const t = (b.nuovo || '').trim();
    if (t && t !== b.testo) uscita[b.id] = t;
  });
  return uscita;
}

/* Quanto si aspettera': il modello da caricare, piu' il tempo per ogni
 * carattere da dire. E' una stima fatta su un portatile senza scheda video,
 * e lo dice: meglio sapere che sara' mezz'ora che scoprirlo aspettando. */
function aggiornaStima() {
  const cambi = Object.values(riscritture());
  const nota = window.$('#d-stima');
  if (!cambi.length) { nota.textContent = ''; statoDoppia(); return; }
  const caratteri = cambi.reduce((tot, t) => tot + t.length, 0);
  const secondi = D_STIMA.base + D_STIMA.per_carattere * caratteri;
  const minuti = Math.max(1, Math.round(secondi / 60));
  const tempo = minuti < 60 ? minuti + ' min'
    : Math.floor(minuti / 60) + ' h ' + (minuti % 60) + ' min';
  nota.textContent = window.t('dop.stima', { n: cambi.length, tempo });
  statoDoppia();
}

function statoDoppia() {
  window.$('#d-avvia').disabled = !D_FILE || !Object.keys(riscritture()).length;
}

async function doppia() {
  if (!D_FILE) return;
  const e = await window.pywebview.api.dop_avvia(D_FILE, riscritture());
  if (!e.ok) window.errore(e.errore, 'dop');
}

window.ascolta('dopFinito', (s, dati) => {
  s.testo.textContent = dati.testo;
  window.avvisa(dati.testo, dati.ok ? 'ok' : 'fail');
  if (dati.video) {
    D_URL.doppiato = dati.video;
    mostraVideoDop('doppiato');
  }
});

window.initDoppiaggio = initDoppiaggio;
