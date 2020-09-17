const senselLib = require('node-sensel');

let messageStack = [];
let errorHandler = m=>{
  messageStack.push(m);
};
const o = {
  proc: _=>_,
  onPad: _=>_,
  onTouch: _=>_,
  onError: cb=>{
    for(let m of messageStack) cb(m);
    errorHandler = cb;
    messageStack = [];
  },
  state: senselLib.ContactState,
  touches: {},
  width: 0,
  height: 0
};

// Sensel

const sensel = senselLib.open();
if(sensel != null) {
  process.on('exit', _=>{
    if(sensel) sensel.close();
  });
  sensel.startScanning();
  sensel.setContactsMask(senselLib.ContactsMask.ELLIPSE);

  const touches = o.touches;
  const touchListeners = [];
  const touchHandlers = {};
  o.proc = _=>{
    sensel.frame(f=>{
      f.contact(c=>{
        if(c.state == senselLib.ContactState.START) {
          touchHandlers[c.id] = [];
          for(let l of touchListeners) {
            const t = l();
            t.next();
            touchHandlers[c.id].push(t);
          }
        }
        if(c.state == senselLib.ContactState.END) {
          delete touches[c.id];
        } else touches[c.id] = c;
        for(let t of touchHandlers[c.id]) {
          t.next(c);
        }
      });
    });
  };
  o.onTouch = h=>{
    touchListeners.push(h);
  };
} else errorHandler("Sensel not found.");

// Midi - NanoPad

const padListeners = [];
o.onPad = h=>{
  padListeners.push(h);
};
const padTouches = {};
function padInput(e) {
  if(e.length != 3) return;
  let k = (e[1]+12) % 16;
  let v = e[2] / 127;
  if(e[0] == 0x90) {
    padTouches[k] = [];
    for(let l of padListeners) {
      const t = l(k,v);
      t.next();
      padTouches[k].push(t);
    }
  } else {
    for(let t of padTouches[k]) {
      t.next();
    }
    delete padTouches[k];
  }
}

navigator.requestMIDIAccess({sysex: true}).then(midi=>{
  const inputIt = midi.inputs.values();
  let found = false;
  for(let input = inputIt.next(); !input.done; input = inputIt.next()) {
    const device = input.value;
    if(device.name == "nanoPAD2") {
      found = true;
      device.addEventListener("midimessage", e=>{
        padInput(e.data);
      });
    }
  }
  if(!found) errorHandler("NanoPAD2 not found.");
});

module.exports = o;
