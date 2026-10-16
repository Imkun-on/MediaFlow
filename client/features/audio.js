/* Sezioni Audio e Video: si incolla un link e si preme Scarica.
 *
 * Le due sezioni fanno lo stesso lavoro con due esiti diversi, e le muove lo
 * stesso codice. Premuto Scarica, Python guarda cosa c'e' dietro il link: un
 * brano solo parte subito; una playlist o un album aprono prima una finestra
 * coi brani da spuntare, tutti spuntati di partenza. Sotto, man mano, le
 * schede di quello che si scarica. In Audio quello che e' arrivato si ascolta
 * dalla scheda; in Video finisce nella colonna «Analizzati», da dove si apre.
 */

const FORMATI_SEZIONE = { audio: 'a', video: 'v' };

/* Lo stato di ciascuna sezione: le schede a schermo e i file arrivati. */
const SCARICO = {
  audio: { schede: [], voci: [], file: [] },
  video: { schede: [], voci: [], file: [] },
};

function initScaricatore(sez) {
  const $ = window.$;
  const p = FORMATI_SEZIONE[sez];
  $('#' + p + '-scarica').addEventListener('click', () => avviaScarico(sez));
  $('#' + p + '-link').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') avviaScarico(sez);
  });
  if (sez === 'video') {
    $('#v-sottotitoli').addEventListener('change', mostraTraduzione);
    mostraTraduzione();
    svuotaPronti();
  }
  svuotaRisultati(sez);

  window.registraSezione(sez, {
    scorciatoia: () => avviaScarico(sez),
    azzera: () => {
      $('#' + p + '-link').value = '';
      svuotaRisultati(sez);
      if (sez === 'video') svuotaPronti();
    },
    traduci: () => {
      if (!SCARICO[sez].schede.length) svuotaRisultati(sez);
      if (sez === 'video' && !SCARICO.video.file.length) svuotaPronti();
    },
  });
}

// Audio ha la sua pagina, con la libreria e il lettore: vedi libreria.js. Gli
// eventi di Python arrivano comunque qui, e per Audio vengono girati di la'.
function initVideo() { initScaricatore('video'); }

// La traduzione e' dei sottotitoli: senza sottotitoli non c'e' niente da
// tradurre, e la tendina sparisce.
function mostraTraduzione() {
  window.$('#v-gruppo-traduci').hidden = !window.$('#v-sottotitoli').value;
}

/* ── Dal link alla scelta ──────────────────────────────────────────────── */

/* Le opzioni partono insieme al link: un brano solo Python lo scarica di
 * fila, senza tornare a chiedere. */
function opzioniScarico(sez) {
  if (sez === 'audio') {
    return {
      formato: 'm4a',
      // I testi si cercano sempre, e a quelli senza tempi i tempi si danno
      // ascoltando il brano: erano due interruttori sempre accesi.
      testi: true,
      sincronizza: true,
    };
  }
  const sottotitoli = window.$('#v-sottotitoli').value;
  return {
    formato: 'mp4',
    sottotitoli,
    traduci: sottotitoli ? window.$('#v-traduci').value : '',
  };
}

async function avviaScarico(sez) {
  const p = FORMATI_SEZIONE[sez];
  const link = window.$('#' + p + '-link').value.trim();
  const esito = await window.pywebview.api.analizza(link, sez, opzioniScarico(sez));
  if (!esito.ok) window.errore(esito.errore, sez);
}

/* Python ha guardato il link. Di un brano solo si prepara la scheda, e il
 * download e' gia' partito; di una playlist si chiede quali brani. */
window.ascolta('mostraScelta', (s, dati) => {
  const sez = s.nome;
  const voci = dati.voci || [];
  SCARICO[sez].voci = voci;
  if (sez === 'audio') { window.libreria.scelta(dati); return; }
  if (dati.album) {
    sceltaAlbum(sez, voci[0] || {}, dati.album);
    return;
  }
  if (!dati.playlist) {
    preparaSchede(sez, voci.map((_, i) => i));
    return;
  }
  sceltaBrani(sez, dati.titolo, voci);
});

function sceltaBrani(sez, titolo, voci) {
  const scelti = new Set(voci.map((_, i) => i));
  const elenco = window.el('div', 'scelta-elenco');
  const conteggio = window.el('span', 'targhetta');
  const aggiorna = () => {
    elenco.querySelectorAll('.scelta-voce').forEach((r) => {
      const i = +r.dataset.i;
      r.classList.toggle('spenta', !scelti.has(i));
      r.querySelector('input').checked = scelti.has(i);
    });
    conteggio.textContent = window.t('sel.count', { n: scelti.size });
  };

  voci.forEach((v, i) => {
    const riga = window.el('label', 'scelta-voce');
    riga.dataset.i = i;
    const casella = document.createElement('input');
    casella.type = 'checkbox';
    casella.addEventListener('change', () => {
      if (casella.checked) scelti.add(i); else scelti.delete(i);
      aggiorna();
    });
    riga.appendChild(casella);
    riga.appendChild(window.el('span', 'scelta-numero', String(i + 1).padStart(2, '0')));
    // I titoli arrivano da YouTube: si scrivono come testo, mai come HTML.
    riga.appendChild(window.el('span', 'scelta-titolo', v.titolo || ''));
    riga.appendChild(window.el('span', 'scelta-durata', v.durata || ''));
    elenco.appendChild(riga);
  });

  const comandi = window.el('div', 'scelta-comandi');
  const tutti = window.el('button', 'bottone nudo', window.t('sel.all'));
  tutti.addEventListener('click', () => { voci.forEach((_, i) => scelti.add(i)); aggiorna(); });
  const nessuno = window.el('button', 'bottone nudo', window.t('sel.none'));
  nessuno.addEventListener('click', () => { scelti.clear(); aggiorna(); });
  comandi.appendChild(tutti);
  comandi.appendChild(nessuno);
  comandi.appendChild(window.el('div', 'spazio'));
  comandi.appendChild(conteggio);

  window.finestra({
    icona: 'scarica', titolo: window.t('scarica.scelta'),
    corpo: [window.paragrafo(titolo), comandi, elenco],
    azioni: [
      { testo: window.t('comune.annulla'), tono: 'nudo' },
      {
        testo: window.t('audio.start'), tono: 'pieno', icona: 'scarica',
        azione: () => {
          if (!scelti.size) { window.avvisa(window.t('scarica.nessuno'), 'fail'); return; }
          scaricaScelti(sez, Array.from(scelti).sort((a, b) => a - b));
        },
      },
    ],
  });
  aggiorna();
}

/* Un video solo che ha la scaletta di un disco: prima di scaricarlo si chiede
 * se dividerlo. Python ha gia' deciso che i capitoli sembrano brani (almeno
 * tre, dieci minuti in tutto, quasi tutto il video coperto); qui si mostra
 * cosa ha trovato, perche' e' chi ascolta a sapere se e' davvero un album. */
function orario(secondi) {
  const s = Math.max(0, Math.round(secondi));
  const ore = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return ore ? ore + ':' + String(mm).padStart(2, '0') + ':' + ss : mm + ':' + ss;
}

function sceltaAlbum(sez, voce, tracce) {
  const elenco = window.el('div', 'scelta-elenco');
  tracce.forEach((c, i) => {
    const riga = window.el('div', 'scelta-voce traccia');
    riga.appendChild(window.el('span', 'scelta-numero', String(i + 1).padStart(2, '0')));
    riga.appendChild(window.el('span', 'scelta-durata', orario(c.inizio)));
    riga.appendChild(window.el('span', 'scelta-titolo', c.titolo));
    riga.appendChild(window.el('span', 'scelta-durata', orario(c.durata)));
    elenco.appendChild(riga);
  });
  const n = tracce.length;
  window.finestra({
    icona: 'audio', titolo: window.t('album.titolo'),
    corpo: [window.paragrafo(voce.titolo || ''),
      window.paragrafo(window.t('album.desc', { n })), elenco],
    azioni: [
      { testo: window.t('comune.annulla'), tono: 'nudo' },
      {
        testo: window.t('album.intero'), tono: 'contorno',
        azione: () => scaricaScelti(sez, [0], { dividi: false }),
      },
      {
        testo: window.t('album.dividi', { n }), tono: 'pieno', icona: 'forbici',
        azione: () => scaricaScelti(sez, [0], { dividi: true }),
      },
    ],
  });
}

async function scaricaScelti(sez, indici, extra) {
  if (sez === 'audio') { window.libreria.scarica(indici, extra); return; }
  preparaSchede(sez, indici);
  const opzioni = { ...opzioniScarico(sez), ...(extra || {}), sezione: sez, scelti: indici };
  const esito = await window.pywebview.api.scarica(opzioni);
  if (!esito.ok) window.errore(esito.errore, sez);
}

/* ── Le schede di quello che si scarica ────────────────────────────────── */

function svuotaRisultati(sez) {
  const e = window.$('#' + FORMATI_SEZIONE[sez] + '-risultati');
  SCARICO[sez].schede = [];
  e.innerHTML = '';
  e.appendChild(window.statoVuoto(window.t('scarica.vuoto')));
}

function preparaSchede(sez, indici) {
  const stato = SCARICO[sez];
  const elenco = window.$('#' + FORMATI_SEZIONE[sez] + '-risultati');
  elenco.innerHTML = '';
  stato.schede = [];
  if (sez === 'video') svuotaPronti();
  indici.forEach((i, n) => {
    const v = stato.voci[i] || {};
    const scheda = document.createElement('div');
    scheda.className = 'scheda';
    // A cascata invece che tutte insieme: su venti brani e' la differenza fra
    // "e' apparso un muro" e "si sta popolando".
    scheda.style.animationDelay = Math.min(n * 22, 420) + 'ms';
    scheda.innerHTML =
      '<div class="miniatura">' +
        '<div class="numero">' + String(i + 1).padStart(2, '0') + '</div>' +
        (v.durata ? '<div class="durata-sopra"></div>' : '') +
      '</div>' +
      '<div class="scheda-testo"><div class="scheda-titolo"></div>' +
        '<div class="scheda-sotto"></div></div>' +
      '<div class="pastiglia"></div><div class="filo"></div>';
    scheda.querySelector('.scheda-titolo').textContent = v.titolo || '';
    const sotto = scheda.querySelector('.scheda-sotto');
    sotto.dataset.canale = v.canale || '';
    sotto.textContent = v.canale || '';
    if (v.durata) scheda.querySelector('.durata-sopra').textContent = v.durata;
    // La miniatura entra subito nel riquadro ma si mostra solo quando e'
    // arrivata: un'icona rotta sarebbe peggio del riquadro vuoto. Prima era
    // «lazy» e si aggiungeva solo a caricamento finito, ma un'immagine lazy
    // fuori dalla pagina non si carica mai: le miniature non comparivano.
    if (v.miniatura) {
      const img = new Image();
      img.alt = '';
      img.className = 'in-arrivo';
      img.onload = () => img.classList.remove('in-arrivo');
      img.onerror = () => img.remove();
      img.src = v.miniatura;
      scheda.querySelector('.miniatura').prepend(img);
    }
    const p = scheda.querySelector('.pastiglia');
    p.textContent = window.t('fase.attesa');
    stato.schede[i] = scheda;
    elenco.appendChild(scheda);
  });
}

/* Quanto e' scaricata *questa* traccia, in byte: il filo sotto la scheda. */
window.ascolta('tracciaAvanza', (s, i, frazione) => {
  if (s.nome === 'audio') { window.libreria.avanza(i, frazione); return; }
  const scheda = (SCARICO[s.nome] || {}).schede[i];
  if (!scheda) return;
  const filo = scheda.querySelector('.filo');
  if (filo) filo.style.width = (Math.max(0, Math.min(1, frazione)) * 100).toFixed(1) + '%';
});

/* La riga sotto il titolo: il canale, e dopo il puntino cosa succede ora. */
function rigaSotto(scheda, dettaglio) {
  const sotto = scheda.querySelector('.scheda-sotto');
  sotto.textContent = [sotto.dataset.canale || '', dettaglio || ''].filter(Boolean).join('  ·  ');
}

window.ascolta('tracciaFase', (s, i, fase) => {
  if (s.nome === 'audio') { window.libreria.fase(i, fase); return; }
  const scheda = (SCARICO[s.nome] || {}).schede[i];
  if (!scheda) return;
  scheda.classList.add('in-corso');
  const p = scheda.querySelector('.pastiglia');
  p.className = 'pastiglia lavora';
  // La pastiglia dice solo che sta lavorando; il passo preciso (scarico,
  // converto, trascrivo) va sotto il titolo, dove c'e' spazio per leggerlo.
  p.textContent = window.t('fase.corso');
  rigaSotto(scheda, window.t('fase.' + fase));
  // La traccia che lavora si porta sotto gli occhi da sola: su una playlist da
  // cinquanta brani, cercarla a mano sarebbe assurdo.
  scheda.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

window.ascolta('tracciaFinita', (s, i, esito, errore, url, quando, testo, peso, formato) => {
  const sez = s.nome;
  if (sez === 'audio') {
    window.libreria.finita(i, { esito, errore, url, quando, testo, peso, formato });
    return;
  }
  const scheda = (SCARICO[sez] || {}).schede[i];
  if (!scheda) return;
  scheda.classList.remove('in-corso');
  scheda.classList.add('finita');
  if (esito === 'fail') scheda.classList.add('fallita');
  const cl = esito === 'ok' ? 'ok' : esito === 'skip' ? 'skip' : 'fail';
  const p = scheda.querySelector('.pastiglia');
  p.className = 'pastiglia ' + cl;
  p.textContent = window.t('fase.' + cl);
  rigaSotto(scheda, cl === 'skip' && quando ? window.t('fase.quando', { quando }) : '');
  // Una traccia caduta in mezzo a quarantanove riuscite non merita di fermare
  // tutto con una finestra: la scheda e' gia' rossa e resta li' da vedere.
  if (esito === 'fail' && errore) {
    window.avvisa(scheda.querySelector('.scheda-titolo').textContent + ' — ' + errore, 'fail');
  }
  if (sez === 'video') {
    if (cl !== 'fail') aggiungiPronto(i, scheda, cl === 'skip', quando);
  } else if (url) {
    rendiAscoltabile(scheda, url, testo || '');
  }
});

/* ── Il lettore della scheda ───────────────────────────────────────────── */

/* Arrivato il brano, la scheda diventa un modo per ascoltarlo - e, se c'e' il
 * testo, per leggerlo mentre suona.
 *
 * Non il lettore del browser: <audio controls> in WebView2 e' una pillola
 * chiara col bordo bianco, l'unica cosa chiara in tutta la finestra. Qui
 * l'<audio> resta nascosto e i comandi sono nostri, coi colori del resto. */
const ICONA_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
const ICONA_PAUSA = '<svg viewBox="0 0 24 24"><path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor"/></svg>';

// Un brano alla volta: farne partire un altro ferma quello che suonava.
let LETTORE_ATTIVO = null;

function minuti(secondi) {
  if (!isFinite(secondi) || secondi < 0) return '–:––';
  const s = Math.floor(secondi);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* Le righe di un testo LRC: [{t, testo}] in ordine di tempo. Una riga puo'
 * portare piu' tempi ([00:12.00][01:40.00]Ritornello) e vale per ciascuno.
 * Un testo senza tempi torna con t = null su ogni riga. */
function righeLrc(testo) {
  const righe = [];
  let conTempi = false;
  testo.split(/\r?\n/).forEach((riga) => {
    const tempi = [];
    const resto = riga.replace(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g, (_, m, sec) => {
      tempi.push(+m * 60 + parseFloat(sec.replace(':', '.')));
      return '';
    }).trim();
    // Le intestazioni LRC ([ar:...], [ti:...]) non sono testo.
    if (/^\[[a-z]+:.*\]$/i.test(resto)) return;
    if (tempi.length) {
      conTempi = true;
      tempi.forEach((t) => righe.push({ t, testo: resto }));
    } else if (resto) {
      righe.push({ t: null, testo: resto });
    }
  });
  if (!conTempi) return { sincronizzato: false, righe };
  return {
    sincronizzato: true,
    righe: righe.filter((r) => r.t !== null).sort((a, b) => a.t - b.t),
  };
}

function rendiAscoltabile(scheda, url, testo) {
  scheda.classList.add('pronta');
  const audio = document.createElement('audio');
  audio.preload = 'metadata';
  audio.src = url;

  const lettore = window.el('div', 'lettore');
  const play = window.el('button', 'lettore-play');
  play.type = 'button';
  play.innerHTML = ICONA_PLAY;
  play.title = window.t('lettore.play');
  const ora = window.el('span', 'lettore-ora', '0:00');
  const binario = window.el('div', 'lettore-binario');
  const pieno = window.el('div', 'lettore-pieno');
  const pomello = window.el('div', 'lettore-pomello');
  binario.append(pieno, pomello);
  const durata = window.el('span', 'lettore-ora', '–:––');
  lettore.append(play, ora, binario, durata);

  const pannello = window.el('div', 'testo-brano');
  pannello.hidden = true;
  let righe = [];
  let sincronizzato = false;
  if (testo) {
    ({ righe, sincronizzato } = righeLrc(testo));
    const bottone = window.el('button', 'lettore-testo', window.t('lettore.testo'));
    bottone.type = 'button';
    bottone.addEventListener('click', () => {
      pannello.hidden = !pannello.hidden;
      bottone.classList.toggle('attivo', !pannello.hidden);
      if (!pannello.hidden) segui(true);
    });
    lettore.appendChild(bottone);
    if (!sincronizzato) {
      pannello.appendChild(window.el('div', 'testo-nota', window.t('lettore.senza_tempi')));
    }
    righe.forEach((r) => {
      // I titoli e i testi arrivano da fuori: si scrivono come testo, mai HTML.
      const riga = window.el('div', 'testo-riga' + (r.testo ? '' : ' pausa'), r.testo || '♪');
      if (sincronizzato) {
        // Una riga si tocca e il brano salta li': e' il modo di ripassarne un pezzo.
        riga.addEventListener('click', () => {
          audio.currentTime = r.t;
          if (audio.paused) audio.play();
        });
      }
      r.nodo = riga;
      pannello.appendChild(riga);
    });
  }

  let attuale = -1;
  function segui(subito) {
    if (!sincronizzato || pannello.hidden) return;
    const adesso = audio.currentTime + 0.15;
    let k = -1;
    for (let j = 0; j < righe.length && righe[j].t <= adesso; j++) k = j;
    if (k === attuale && !subito) return;
    if (righe[attuale]) righe[attuale].nodo.classList.remove('attuale');
    attuale = k;
    const nodo = righe[k] ? righe[k].nodo : null;
    if (nodo) nodo.classList.add('attuale');
    // Scorre il solo riquadro del testo, non la pagina: la riga che si canta
    // resta a un terzo dall'alto, con le successive gia' in vista.
    const cima = nodo ? nodo.offsetTop - pannello.clientHeight / 3 : 0;
    pannello.scrollTo({ top: Math.max(cima, 0), behavior: subito ? 'auto' : 'smooth' });
  }

  function disegna() {
    const tot = audio.duration;
    const quota = (isFinite(tot) && tot > 0 ? audio.currentTime / tot : 0) * 100 + '%';
    pieno.style.width = quota;
    pomello.style.left = quota;
    ora.textContent = minuti(audio.currentTime);
    segui(false);
  }
  let giro = 0;
  function anima() {
    disegna();
    if (!audio.paused) giro = requestAnimationFrame(anima);
  }

  audio.addEventListener('loadedmetadata', () => { durata.textContent = minuti(audio.duration); });
  audio.addEventListener('play', () => {
    if (LETTORE_ATTIVO && LETTORE_ATTIVO !== audio) LETTORE_ATTIVO.pause();
    LETTORE_ATTIVO = audio;
    play.innerHTML = ICONA_PAUSA;
    play.title = window.t('lettore.pausa');
    scheda.classList.add('suona');
    anima();
  });
  audio.addEventListener('pause', () => {
    cancelAnimationFrame(giro);
    play.innerHTML = ICONA_PLAY;
    play.title = window.t('lettore.play');
    scheda.classList.remove('suona');
    disegna();
  });
  audio.addEventListener('ended', () => { audio.currentTime = 0; disegna(); });
  audio.addEventListener('seeked', disegna);

  const alterna = () => { if (audio.paused) audio.play(); else audio.pause(); };
  play.addEventListener('click', alterna);
  scheda.querySelector('.miniatura').addEventListener('click', alterna);

  // Il binario si tocca o si trascina per spostarsi nel brano.
  const vaiA = (e) => {
    const r = binario.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (isFinite(audio.duration)) audio.currentTime = f * audio.duration;
    disegna();
  };
  binario.addEventListener('pointerdown', (e) => {
    binario.setPointerCapture(e.pointerId);
    binario.classList.add('trascina');
    vaiA(e);
  });
  binario.addEventListener('pointermove', (e) => {
    if (binario.hasPointerCapture(e.pointerId)) vaiA(e);
  });
  binario.addEventListener('pointerup', () => binario.classList.remove('trascina'));

  scheda.querySelector('.scheda-testo').append(audio, lettore, pannello);
}

/* ── La colonna «Analizzati» dei video ──────────────────────────────────── */

function svuotaPronti() {
  const e = window.$('#v-pronti');
  SCARICO.video.file = [];
  e.innerHTML = '';
  e.appendChild(window.statoVuoto(window.t('video.pronti.vuoto')));
  window.$('#v-conta').hidden = true;
}

/* Un video pronto: titolo, quando e' arrivato e il bottone per aprirlo. Quelli
 * che c'erano gia' hanno la data in giallo, come la loro pastiglia. */
function aggiungiPronto(i, scheda, vecchio, quando) {
  const e = window.$('#v-pronti');
  if (!SCARICO.video.file.length) e.innerHTML = '';
  SCARICO.video.file.push(i);
  const riga = window.el('div', 'pronto' + (vecchio ? ' vecchio' : ''));
  riga.appendChild(window.el('span', 'pronto-titolo', scheda.querySelector('.scheda-titolo').textContent));
  riga.appendChild(window.el('span', 'pronto-quando',
    quando ? (vecchio ? window.t('fase.quando', { quando }) : quando) : ''));
  const apri = window.el('button', 'bottone contorno', window.t('video.apri'));
  apri.addEventListener('click', async () => {
    const esito = await window.pywebview.api.apri_scaricato(i, 'video');
    if (!esito.ok) window.errore(esito.errore, 'video');
  });
  riga.appendChild(apri);
  e.appendChild(riga);
  riga.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const conta = window.$('#v-conta');
  conta.hidden = false;
  conta.textContent = String(SCARICO.video.file.length);
}

window.initVideo = initVideo;
