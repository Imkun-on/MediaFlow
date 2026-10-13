/* Sezione Migliora qualita' (era Rimasterizza).
 *
 * La parte che conta e' la tabella delle risoluzioni: non e' un elenco fisso,
 * ma il risultato calcolato su *quel* file. La stessa riga che offre il 4K
 * dice, quando e' il caso, che da quella sorgente non aggiunge un solo
 * dettaglio vero. E' il punto in cui il programma e' piu' onesto, e sarebbe
 * un peccato nasconderlo dietro un menu a tendina.
 */

let P_DIAGNOSI = null;
let P_ALTEZZA = 'auto';

function initPix() {
  const $ = window.$;
  $('#p-analizza').addEventListener('click', analizzaVideo);
  $('#p-avvia').addEventListener('click', rimasterizza);
  $('#p-preset').addEventListener('change', notaPreset);
  $('#p-scarica').addEventListener('click', daLink);
  $('#p-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') daLink(); });
  $('#p-file').addEventListener('click', async () => {
    const e = await window.pywebview.api.scegli_file(false, 'video');
    if (!e.ok) { window.avvisa(e.errore, 'fail'); return; }
    if (e.ok && e.file.length) { $('#p-file').value = e.file[0]; analizzaVideo(); }
  });
  svuotaDiagnosi();
  svuotaAnteprima();

  window.registraSezione('pix', {
    riabilita: () => { $('#p-avvia').disabled = !P_DIAGNOSI; },
    scorciatoia: rimasterizza,
    traduci: () => { if (!P_DIAGNOSI) { svuotaDiagnosi(); svuotaAnteprima(); } },
  });
}

/* Un link di YouTube: Python scarica il video in risultati/Video e, a file
 * arrivato, manda pixScaricato - da li' in poi e' come averlo scelto. */
async function daLink() {
  const esito = await window.pywebview.api.pix_da_link(window.$('#p-link').value);
  if (!esito.ok) window.errore(esito.errore, 'pix');
}

window.ascolta('pixScaricato', (s, dati) => {
  window.$('#p-file').value = dati.file;
  window.$('#p-link').value = '';
  s.avanzamento.classList.remove('visibile');
  analizzaVideo();
});

function svuotaDiagnosi() {
  const e = window.$('#p-diagnosi');
  P_DIAGNOSI = null;
  e.innerHTML = '';
  e.appendChild(window.statoVuoto(window.t('pix.empty')));
  window.$('#p-risoluzione').innerHTML = '';
  window.$('#p-nota-risoluzione').textContent = '';
  window.$('#p-sorgente').textContent = '';
  window.$('#p-preset').value = '';
  window.$('#p-trattamenti').innerHTML = '';
  window.$('#p-nota-preset').textContent = '';
  window.$('#p-avvia').disabled = true;
}

/* I trattamenti con l'AI costano ore: la loro descrizione non resta nel
 * suggerimento della tendina, si legge sotto, appena li si sceglie. */
const P_AI = { ai: [2, 3, 4] };

function notaPreset() {
  const chiave = window.$('#p-preset').value;
  const p = ((P_DIAGNOSI || {}).presets || []).find((x) => x.chiave === chiave);
  window.$('#p-nota-preset').textContent = P_AI[chiave] && p ? p.desc : '';
  Array.from(window.$('#p-trattamenti').children).forEach((b) =>
    b.classList.toggle('trattamento-scelto', b.dataset.chiave === chiave));
  // Con l'AI l'immagine la ridisegna la rete: i ritocchi della catena di
  // filtri non hanno niente su cui agire, e si spengono per dirlo.
  ['#p-rumore', '#p-stabilizza', '#p-dettaglio'].forEach((id) => {
    window.$(id).disabled = Boolean(P_AI[chiave]);
  });
  window.$('#p-ritocchi').classList.toggle('spenti', Boolean(P_AI[chiave]));
}

/* I trattamenti: un bottone ciascuno, con la spunta su quello scelto. */
function disegnaTrattamenti(presets, consigliato) {
  const box = window.$('#p-trattamenti');
  const campo = window.$('#p-preset');
  box.innerHTML = '';
  presets.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'trattamento';
    b.dataset.chiave = p.chiave;
    b.title = p.desc;
    b.innerHTML = '<span></span><svg class="icona" viewBox="0 0 24 24"><use href="#i-spunta"/></svg>';
    b.querySelector('span').textContent = p.nome + (p.chiave === consigliato
      ? '  (' + window.t('pix.suggested') + ')' : '');
    b.addEventListener('click', () => { campo.value = p.chiave; notaPreset(); });
    box.appendChild(b);
  });
  campo.value = consigliato;
  notaPreset();
}

/* Quanto ci mettera' l'AI, dai tempi misurati su un Ryzen 5 3500U (Vega 8):
 * 2,5 s a fotogramma per un 360p ingrandito x2, dall'estrazione alla
 * codifica, e il costo cresce coi pixel d'uscita. E' una stima: il conto vero
 * lo fa la barra, che a lavoro avviato dice quanto manca dalla velocita'
 * reale. */
const P_AI_BASE = 2.5 / (1280 * 720);

function stimaAi(chiave) {
  const d = P_DIAGNOSI;
  const voluta = P_ALTEZZA === 'auto' ? d.altezza * 2 : +P_ALTEZZA;
  const scale = P_AI[chiave];
  const s = scale.find((x) => d.altezza * x >= voluta) || scale[scale.length - 1];
  const perFotogramma = P_AI_BASE * d.larghezza * s * d.altezza * s;
  return perFotogramma * d.fotogrammi;
}

function oreMinuti(secondi) {
  const m = Math.max(1, Math.round(secondi / 60));
  const h = Math.floor(m / 60);
  return h ? h + ' h ' + String(m % 60).padStart(2, '0') + ' min' : m + ' min';
}

function svuotaAnteprima() {
  const e = window.$('#p-anteprima');
  e.innerHTML = '';
  e.appendChild(window.statoVuoto(window.t('pix.preview.empty')));
}

async function analizzaVideo() {
  const esito = await window.pywebview.api.pix_analizza(window.$('#p-file').value);
  if (!esito.ok) { svuotaDiagnosi(); window.errore(esito.errore, 'pix'); return; }
  P_DIAGNOSI = esito;

  // Diagnosi: la scheda del file, poi i difetti trovati.
  const box = window.$('#p-diagnosi');
  box.innerHTML = '';
  const scheda = document.createElement('div');
  scheda.className = 'riga-diagnosi capo';
  scheda.textContent = esito.nome + '  ·  ' + esito.scheda;
  box.appendChild(scheda);
  esito.problemi.forEach((p) => {
    const r = document.createElement('div');
    r.className = 'riga-diagnosi';
    r.textContent = p.replace(/\[\/?[a-z_]+\]/g, '');
    box.appendChild(r);
  });

  // Trattamenti: quello consigliato e' marcato, ma si puo' cambiare.
  disegnaTrattamenti(esito.presets, esito.preset);

  window.$('#p-sorgente').textContent = window.t('pix.sorgente',
    { misure: esito.larghezza + ' × ' + esito.altezza });
  disegnaRisoluzioni(esito.risoluzioni);
  window.$('#p-avvia').disabled = false;
  disegnaSchermo(esito.video);
}

/* ── Lo schermo ────────────────────────────────────────────────────────── */

/* Il video scelto, e a lavoro finito il confronto.
 *
 * Il confronto sono due video sovrapposti che vanno insieme: sotto il
 * risultato, sopra quello di partenza, ritagliato fino alla linea. Trascinando
 * la linea si scopre l'uno o l'altro nello stesso fotogramma, che e' l'unico
 * modo onesto di giudicare un miglioramento: fianco a fianco l'occhio confronta
 * due punti diversi dell'immagine.
 *
 * I comandi sono nostri e stanno sotto: quelli del browser finirebbero sotto
 * il video di sopra, e comanderebbero uno solo dei due.
 *
 *   prima    l'indirizzo del video di partenza
 *   dopo     quello del risultato; senza, si guarda solo il primo
 *   ripiego  cosa fare se il risultato non si lascia riprodurre
 */
function disegnaSchermo(prima, dopo, ripiego) {
  const d = P_DIAGNOSI;
  const box = window.$('#p-anteprima');
  box.innerHTML = '';
  if (!prima || !d) { svuotaAnteprima(); return; }

  const crea = (url, muto) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.playsInline = true; v.muted = Boolean(muto);
    v.src = url + '?v=' + Date.now();
    return v;
  };

  const schermo = window.el('div', 'p-schermo');
  const palco = window.el('div', 'p-palco');
  const cornice = window.el('div', 'p-cornice');
  cornice.style.setProperty('--rapporto', (d.larghezza / d.altezza).toFixed(4));
  // Si sente il video di sotto: il risultato, se c'e'.
  const base = crea(dopo || prima);
  cornice.appendChild(base);

  let sopra = null;
  if (dopo) {
    cornice.classList.add('confronto');
    const velo = window.el('div', 'p-prima');
    sopra = crea(prima, true);
    velo.appendChild(sopra);
    cornice.appendChild(velo);
    cornice.appendChild(window.el('span', 'p-etichetta sinistra', window.t('pix.prima')));
    cornice.appendChild(window.el('span', 'p-etichetta destra', window.t('pix.dopo')));
    const linea = window.el('div', 'p-linea');
    linea.innerHTML = '<span><svg viewBox="0 0 24 24"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round"/></svg></span>';
    cornice.appendChild(linea);

    const sposta = (e) => {
      const r = cornice.getBoundingClientRect();
      const quota = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      cornice.style.setProperty('--divisore', (quota * 100).toFixed(2) + '%');
    };
    cornice.addEventListener('pointerdown', (e) => { cornice.setPointerCapture(e.pointerId); sposta(e); });
    cornice.addEventListener('pointermove', (e) => { if (e.buttons) sposta(e); });
    // Se il risultato non si lascia riprodurre resta l'immagine, o il solo
    // video di partenza.
    base.addEventListener('error', () => { if (ripiego) ripiego(); else disegnaSchermo(prima); });
  }
  cornice.appendChild(window.el('span', 'p-angolo',
    window.t(dopo ? 'pix.confronto' : 'pix.anteprima')));
  palco.appendChild(cornice);
  schermo.appendChild(palco);

  // I comandi: uno solo per tutti e due i video.
  const tutti = sopra ? [base, sopra] : [base];
  const comandi = window.el('div', 'p-comandi');
  const play = window.el('button', 'lettore-play');
  play.type = 'button';
  play.innerHTML = ICONA_PLAY;
  const ora = window.el('span', 'lettore-ora', '0:00');
  const cerca = document.createElement('input');
  cerca.type = 'range'; cerca.className = 'p-cerca';
  cerca.min = 0; cerca.max = d.durata || 0; cerca.step = 0.05; cerca.value = 0;
  const fine = window.el('span', 'lettore-ora', minuti(d.durata));
  comandi.appendChild(play); comandi.appendChild(ora);
  comandi.appendChild(cerca); comandi.appendChild(fine);
  schermo.appendChild(comandi);

  const avvia = () => tutti.forEach((v) => { const p = v.play(); if (p) p.catch(() => {}); });
  const ferma = () => tutti.forEach((v) => v.pause());
  play.addEventListener('click', () => { if (base.paused) avvia(); else ferma(); });
  // Senza confronto si puo' cliccare il video stesso, come ci si aspetta.
  if (!sopra) cornice.addEventListener('click', () => play.click());
  base.addEventListener('play', () => { play.innerHTML = ICONA_PAUSA; });
  base.addEventListener('pause', () => { play.innerHTML = ICONA_PLAY; });
  base.addEventListener('ended', ferma);
  base.addEventListener('loadedmetadata', () => {
    cerca.max = base.duration; fine.textContent = minuti(base.duration);
  });
  base.addEventListener('timeupdate', () => {
    // I due orologi non sono lo stesso orologio: quando si allontanano di un
    // paio di fotogrammi quello di sopra viene rimesso al passo.
    if (sopra && Math.abs(sopra.currentTime - base.currentTime) > 0.1) {
      sopra.currentTime = base.currentTime;
    }
    cerca.value = base.currentTime;
    ora.textContent = minuti(base.currentTime);
  });
  cerca.addEventListener('input', () => {
    tutti.forEach((v) => { v.currentTime = +cerca.value; });
    ora.textContent = minuti(+cerca.value);
  });

  box.appendChild(schermo);
}

/* Le risoluzioni: una tendina, e sotto il giudizio su quella scelta - di
 * quanto ingrandisce, e se da quel file l'ingrandimento regge. */
function disegnaRisoluzioni(voci) {
  const sel = window.$('#p-risoluzione');
  const nota = window.$('#p-nota-risoluzione');
  sel.innerHTML = '';
  voci.forEach((v) => {
    const o = document.createElement('option');
    o.textContent = v.etichetta.replace(/\s+/g, ' ');
    sel.appendChild(o);
  });
  const scegli = () => {
    const i = Math.max(0, sel.selectedIndex);
    const v = voci[i];
    // La prima voce e' l'automatica: si manda 'auto' perche' sia il motore
    // a ricalcolarla, invece di congelarne qui il valore.
    P_ALTEZZA = i === 0 ? 'auto' : v.altezza;
    nota.className = 'nota-riga livello-' + v.livello;
    nota.textContent = v.fattore.toFixed(2) + '×  ·  ' + v.nota;
  };
  sel.onchange = scegli;
  sel.selectedIndex = 0;
  scegli();
}

function rimasterizza() {
  const chiave = window.$('#p-preset').value;
  if (!P_AI[chiave] || !P_DIAGNOSI) { avviaMiglioramento(); return; }
  window.finestra({
    icona: 'avviso', titolo: window.t('pix.ai.conferma.titolo'),
    corpo: [
      window.paragrafo(window.t('pix.ai.conferma.testo', {
        tempo: oreMinuti(stimaAi(chiave)), fotogrammi: P_DIAGNOSI.fotogrammi,
      })),
      window.paragrafo(window.t('pix.ai.conferma.nota')),
    ],
    azioni: [
      { testo: window.t('comune.annulla'), tono: 'nudo' },
      // Dieci secondi bastano a giudicare se l'AI vale le ore che costa.
      {
        testo: window.t('pix.ai.prova', { tempo: oreMinuti(stimaAi(chiave) * P_PROVA
          / Math.max(P_DIAGNOSI.durata || 1, P_PROVA)) }),
        tono: 'contorno', azione: () => avviaMiglioramento(P_PROVA),
      },
      { testo: window.t('pix.start'), tono: 'pieno', icona: 'avvia', azione: () => avviaMiglioramento() },
    ],
  });
}

const P_PROVA = 10;

async function avviaMiglioramento(prova) {
  const esito = await window.pywebview.api.pix_rimasterizza({
    prova:     prova || 0,
    file:      window.$('#p-file').value,
    preset:    window.$('#p-preset').value,
    altezza:   P_ALTEZZA,
    gpu:       window.$('#p-gpu').checked,
    confronto: window.$('#p-confronto').checked,
    rumore:     window.$('#p-rumore').checked,
    stabilizza: window.$('#p-stabilizza').checked,
    dettaglio:  +window.$('#p-dettaglio').value,
  });
  if (!esito.ok) window.errore(esito.errore, 'pix');
}

window.ascolta('pixFinito', (s, dati) => {
  window.avvisa(dati.testo, 'ok');
  const immagine = () => mostraImmagineConfronto(dati.confronto);
  // Coi due video si confronta trascinando la linea; l'immagine fissa resta
  // per la prova di dieci secondi, e per un risultato che non si riproduce.
  if (dati.video && P_DIAGNOSI) disegnaSchermo(P_DIAGNOSI.video, dati.video, immagine);
  else immagine();
});

function mostraImmagineConfronto(url) {
  const box = window.$('#p-anteprima');
  if (!url) {
    if (P_DIAGNOSI) disegnaSchermo(P_DIAGNOSI.video); else svuotaAnteprima();
    return;
  }
  box.innerHTML = '';
  const img = new Image();
  img.alt = '';
  img.className = 'immagine-piena';
  // Il ripiego si aggancia prima di dare l'indirizzo: assegnare src fa partire
  // il caricamento subito, e un file gia' in cache o gia' sparito puo' fallire
  // prima che la riga dopo abbia messo il gestore, lasciando un riquadro rotto.
  img.onerror = () => svuotaAnteprima();
  // Un parametro finto in coda costringe il WebView a rileggere il file: senza,
  // dopo la seconda rimasterizzazione mostrerebbe ancora la prima immagine.
  img.src = url + '?v=' + Date.now();
  box.appendChild(img);
}

window.initPix = initPix;
