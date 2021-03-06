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
const commandProgram = {};
function commandProcess(k) {
  const m = k.split(" ");
  while(m[0] == "") m.shift();
  if(m.length == 0) return;
  const h = m[0].substr(0,1);
  if(commandProgram[h]) {
    m.shift();
    commandProgram[h](m);
  } else {
    Kino.L.add("Command not found: " + m[0]);
  }
  return true;
}
commandProgram["t"] = m=>{
  const t = parseFloat(m[0]);
  if(t <= 0 || isNaN(t)) Kino.L.add("Invalid tempo: " + m[0]);
  else {
    Kino.H.changeTempo(t);
    Kino.L.add("Tempo changed: " + t);
  }
};
commandProgram["e"] = commandProgram["r"] = m=>{
  const H = Kino.H;
  try {
    const ret = Function('"use strict"; return ({H})=>{ return ' + m.join(" ") + ';}')()(Kino);
    if(ret !== undefined && ret !== null) {
      Kino.L.add("> " + ret);
    } else Kino.L.add("> done.");
  } catch(e) {
    Kino.L.add("> " + e + ".");
  }
};

let commandMode = false, command = "";
Kino.I.keyboard.on(function*(k) {
  if(k == ":") {
    commandMode = true;
    command = "";
    Kino.L.command(command);
  } else if(commandMode) {
    if(k == "Enter") {
      commandMode = false;
      if(command == "") Kino.L.revokeCommand();
      else {
        Kino.L.commitCommand();
        commandProcess(command);
      }
    } else if(k == "Escape") {
      commandMode = false;
      Kino.L.revokeCommand();
    } else if(k == "Backspace") {
      command = command.substr(0,command.length-1);
      Kino.L.command(command);
    } else if(k.length == 1) {
      command += k;
      Kino.L.command(command);
    }
  }
});

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
const connect = require('./connect')(Kino);
let currentStream = false;
commandProgram["s"] = m=>{
  currentStream = !currentStream;
  connect.switch(currentStream);
  if(currentStream == false) Kino.L.add("Use stream: Window");
  else Kino.L.add("Use stream: Screen");
};
