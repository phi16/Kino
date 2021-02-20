document.oncontextmenu = _=>false;

const Kino = require('kino-core');

// Renderer
const container = document.getElementById("container");
Kino.container(container);
Kino.activateSynth();
window.addEventListener("resize", Kino.resize);
const ui = require('./ui')(Kino);
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

// Main
const mixer = require('./mixer')(Kino);
ui.mixerRender = mixer.render;
const effector = require('./effector')(Kino);
ui.effectorRender = effector.render;
mixer.ui = ui;
mixer.effector = effector;
effector.ui = ui;
effector.mixer = mixer;
const Scheduler = require('./scheduler')(Kino, effector);
const generators = require('./generator')(Kino, Scheduler);
mixer.generators = generators;

// Voice Analyzer
Kino.S.voiceAnalysis();

// Network broadcast
require('./connect')(Kino);
