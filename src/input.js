const senselLib = require('node-sensel');
const sensel = senselLib.open();
if(sensel == null) {
  module.exports = {
    proc: _=>_,
    onTouch: _=>_,
    state: senselLib.ContactState,
    touches: {},
    width: 0,
    height: 0
  };
  return;
}

process.on('exit', _=>{
  if(sensel) sensel.close();
});
sensel.startScanning();
sensel.setContactsMask(senselLib.ContactsMask.ELLIPSE);

const touches = {};
const touchListeners = [];
const touchHandlers = {};
const proc = _=>{
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
const onTouch = h=>{
  touchListeners.push(h);
};

module.exports = {
  proc,
  onTouch,
  state: senselLib.ContactState,
  touches,
  width: sensel.sensorInfo.width,
  height: sensel.sensorInfo.height
};
