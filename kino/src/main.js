document.oncontextmenu = _=>false;

const Kino = require('kino-core');

// Renderer
const container = document.getElementById("container");
Kino.container(container);
window.addEventListener("resize", Kino.resize);
require('./ui')(Kino);
require('./visual')(Kino);
Kino.L.add("Launched.");

// Input Devices
const senselLib = require('node-sensel');
let sensel = senselLib.open();
if(sensel != null) {
  process.on('exit', _=>{
    if(sensel) sensel.close();
  });
  sensel.startScanning();
  sensel.setContactsMask(senselLib.ContactsMask.ELLIPSE);
  Kino.I.sensel.use(sensel, senselLib.ContactState);
  Kino.L.add("Sensel connected.");
} else {
  Kino.L.add("Sensel not found.");
}

navigator.requestMIDIAccess({sysex: true}).then(midi=>{
  const inputIt = midi.inputs.values();
  for(let input = inputIt.next(); !input.done; input = inputIt.next()) {
    const device = input.value;
    if(device.name == "nanoPAD2") {
      Kino.L.add(device.name + " connected.");
      Kino.I.midi.use(cb=>{
        device.addEventListener("midimessage", cb);
      });
      break;
    }
  }
});

Kino.I.keyboard.use(document);

// Voice Analyzer
Kino.S.voiceAnalysis();

// Test Beat Sound
const S = Kino.S;
const rhy = S.node();
let kg, hg;
Kino.I.keyboard.on(function*(k) {
  if(k == 'q') {
    kg.setTargetAtTime(0, S.X.currentTime, 0.01);
    yield;
    kg.setTargetAtTime(1, S.X.currentTime, 0.01);
  } else if(k == 'w') {
    hg.setTargetAtTime(0, S.X.currentTime, 0.01);
    yield;
    hg.setTargetAtTime(0.3, S.X.currentTime, 0.01);
  }
});
S.load("SONNY_D_kick_07.wav").then(k=>{
  const n = S.X.createGain();
  n.connect(rhy);
  kg = n.gain;
  kg.value = 0;
  let lastIx = 0;
  setInterval(_=>{
    const bt = S.X.currentTime*2;
    const t = Math.floor(bt);
    if(t != lastIx) {
      const kn = S.X.createBufferSource();
      kn.buffer = k;
      kn.connect(n);
      kn.start(t*0.5+0.25);
      lastIx++;
    }
  },250);
});
S.load("PMET_Hi_Hat_02.wav").then(k=>{
  const f = S.X.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 5000;
  const n = S.X.createGain();
  n.gain.value = 0.3;
  n.connect(f).connect(rhy);
  hg = n.gain;
  hg.value = 0;
  let lastIx = 0;
  setInterval(_=>{
    const bt = S.X.currentTime*2;
    const t = Math.floor(bt);
    if(t != lastIx) {
      const kn = S.X.createBufferSource();
      kn.buffer = k;
      kn.connect(n);
      kn.start(t*0.5+0.5);
      lastIx++;
    }
  },250);
});
