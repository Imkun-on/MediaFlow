/* Sezione Montaggio.
 *
 * Quattro operazioni con parametri diversi, e ognuna ha la sua voce nel menu
 * a tendina di Montaggio: GIF, Taglia, Unisci, WebP. La pagina e' una sola e
 * si ricostruisce a ogni cambio di operazione - titolo, campi, interruttori
 * - cosi' si vede solo cio' che riguarda quello che si sta facendo.
 */

let C_AZIONE = 'gif';
let C_FILE = [];

/* Quali campi servono a ciascuna operazione. Tenerlo come dato invece che
 * come una catena di if rende evidente, leggendo, cosa chiede ognuna. */
const C_CAMPI = {
  taglia:  { param: ['da', 'a'], flag: ['preciso'], multi: false },
  unisci:  { param: [],          flag: ['capitoli'], multi: true },
  gif:     { param: ['da', 'durata', 'fps', 'larghezza'], flag: [], multi: false },
  webp:    { param: ['da', 'durata', 'fps', 'larghezza'], flag: [], multi: false },
};

function initClip() {
  const $ = window.$;
  $('#c-avvia').addEventListener('click', esegui);
  $('#c-file').addEventListener('click', async () => {
    const multi = C_CAMPI[C_AZIONE].multi;
    const e = await window.pywebview.api.scegli_file(multi, 'video');
    if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
    if (!e.ok || !e.file.length) return;
    C_FILE = e.file;
    // Nel campo i nomi, non i percorsi: dove stanno lo si sa gia'.
    $('#c-file').value = C_FILE.map((f) => f.split(/[\/]/).pop()).join('  ·  ');
  });
  disegnaModulo();
  svuotaRisultatoClip();

  window.registraSezione('clip', {
    scorciatoia: esegui,
    // Una sottovoce del menu: si cambia operazione. Il file scelto per l'altra
    // non vale piu' (unire ne vuole piu' d'uno, le altre uno), e nemmeno il
    // risultato mostrato.
    sottosezione: (azione) => {
      if (azione === C_AZIONE) return;
      C_AZIONE = azione;
      C_FILE = [];
      $('#c-file').value = '';
      disegnaModulo();
      svuotaRisultatoClip();
    },
    traduci: () => {
      disegnaModulo();
      if (!$('#c-risultato').querySelector('img, video')) svuotaRisultatoClip();
    },
  });
}

function disegnaModulo() {
  const azione = C_AZIONE;
  const conf = C_CAMPI[azione];
  window.$('#c-titolo').textContent = window.t('clip.titolo.' + azione);
  window.$('#c-desc').textContent = window.t('clip.desc.' + azione);
  window.$('#c-etichetta-file').textContent =
    window.t(conf.multi ? 'clip.files' : 'clip.file');

  const ETICHETTE = {
    da: 'clip.from', a: 'clip.to', durata: 'clip.duration',
    fps: 'audio.format', larghezza: 'audio.format',
  };
  const SEGNAPOSTO = {
    da: '1:20', a: '3:45', durata: '5', fps: '15', larghezza: '480',
  };

  const riga = window.$('#c-parametri');
  riga.innerHTML = '';
  conf.param.forEach((campo) => {
    const g = document.createElement('div');
    g.className = 'gruppo mini';
    const l = document.createElement('label');
    l.textContent = campo === 'fps' ? 'FPS'
                  : campo === 'larghezza' ? 'PX'
                  : window.t(ETICHETTE[campo]);
    const i = document.createElement('input');
    i.className = 'campo'; i.id = 'c-' + campo; i.type = 'text';
    i.placeholder = SEGNAPOSTO[campo] || '';
    g.appendChild(l); g.appendChild(i);
    riga.appendChild(g);
  });

  const flag = window.$('#c-interruttori');
  flag.innerHTML = '';
  conf.flag.forEach((nome) => {
    const l = document.createElement('label');
    l.className = 'interruttore';
    l.innerHTML = '<input type="checkbox" id="c-' + nome + '"' +
                  (nome === 'capitoli' ? ' checked' : '') + '>' +
                  '<span class="cursore"></span><span></span>';
    l.querySelector('span:last-child').textContent = window.t('clip.' + nome);
    flag.appendChild(l);
  });
}

function svuotaRisultatoClip() {
  const e = window.$('#c-risultato');
  e.innerHTML = '';
  e.appendChild(window.statoVuoto(window.t('clip.result.empty')));
}

async function esegui() {
  const azione = C_AZIONE;
  const conf = C_CAMPI[azione];
  const opzioni = { azione, file: C_FILE };

  conf.param.forEach((campo) => {
    const el = window.$('#c-' + campo);
    if (!el || !el.value.trim()) return;
    opzioni[campo] = el.value.trim();
  });
  conf.flag.forEach((nome) => {
    const el = window.$('#c-' + nome);
    if (el) opzioni[nome] = el.checked;
  });

  const esito = await window.pywebview.api.clip_esegui(opzioni);
  if (!esito.ok) window.errore(esito.errore, 'clip');
}

window.ascolta('clipFinito', (s, dati) => {
  window.avvisa(dati.testo, dati.ok ? 'ok' : 'fail');
  const box = window.$('#c-risultato');
  box.innerHTML = '';
  if (!dati.anteprima) {
    box.appendChild(window.statoVuoto(dati.file));
    return;
  }
  // Lo spezzone e l'unione si guardano nel lettore; la GIF e il WebP sono
  // immagini, e si mostrano come tali.
  if (!/\.(gif|webp)$/i.test(dati.file)) {
    const video = document.createElement('video');
    video.className = 'anteprima-video';
    video.controls = true;
    video.src = dati.anteprima;
    box.appendChild(video);
    return;
  }
  const img = new Image();
  img.alt = ''; img.className = 'immagine-piena';
  // Prima il ripiego, poi l'indirizzo: dare src fa partire il caricamento
  // all'istante, e un errore immediato scivolerebbe via prima che ci sia
  // qualcuno ad ascoltarlo.
  img.onerror = () => svuotaRisultatoClip();
  img.src = dati.anteprima + '?v=' + Date.now();
  box.appendChild(img);
});

window.initClip = initClip;
