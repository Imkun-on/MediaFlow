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
  window.$('#p-risoluzioni').innerHTML = '';
  window.$('#p-preset').innerHTML = '';
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
  const sel = window.$('#p-preset');
  sel.innerHTML = '';
  esito.presets.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.chiave;
    o.textContent = p.nome + (p.chiave === esito.preset
      ? '  (' + window.t('pix.suggested') + ')' : '');
    o.title = p.desc;
    sel.appendChild(o);
  });
  sel.value = esito.preset;
  notaPreset();

  disegnaRisoluzioni(esito.risoluzioni);
  window.$('#p-avvia').disabled = false;
}

function disegnaRisoluzioni(voci) {
  const box = window.$('#p-risoluzioni');
  box.innerHTML = '';
  P_ALTEZZA = 'auto';
  voci.forEach((v, i) => {
    const b = document.createElement('button');
    b.className = 'scelta livello-' + v.livello + (v.consigliata && i === 0 ? ' scelta-attiva' : '');
    b.type = 'button';
    b.innerHTML =
      '<div class="scelta-nome"></div>' +
      '<div class="scelta-fattore"></div>' +
      '<div class="scelta-nota"></div>';
    b.querySelector('.scelta-nome').textContent = v.etichetta.replace(/\s+/g, ' ');
    b.querySelector('.scelta-fattore').textContent = v.fattore.toFixed(2) + '×';
    b.querySelector('.scelta-nota').textContent = v.nota;
    b.addEventListener('click', () => {
      Array.from(box.children).forEach((c) => c.classList.remove('scelta-attiva'));
      b.classList.add('scelta-attiva');
      // La prima voce e' l'automatica: si manda 'auto' perche' sia il motore
      // a ricalcolarla, invece di congelarne qui il valore.
      P_ALTEZZA = i === 0 ? 'auto' : v.altezza;
    });
    box.appendChild(b);
  });
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
  });
  if (!esito.ok) window.errore(esito.errore, 'pix');
}

window.ascolta('pixFinito', (s, dati) => {
  window.avvisa(dati.testo, 'ok');
  const box = window.$('#p-anteprima');
  if (!dati.confronto) { svuotaAnteprima(); return; }
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
  img.src = dati.confronto + '?v=' + Date.now();
  box.appendChild(img);
});

window.initPix = initPix;
