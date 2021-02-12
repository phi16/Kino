const o = {};

// Keyboard
o.keyboard = (_=>{
  const u = {};
  const keyPressed = {};
  const keyListeners = [];
  u.use = e=>{
    const padTouches = {};
    e.addEventListener("keydown",e=>{
      const k = e.key;
      if(keyPressed[k] === undefined) {
        keyPressed[k] = [];
        for(let l of keyListeners) {
          const t = l(k);
          t.next();
          keyPressed[k].push(t);
        }
      }
    });
    e.addEventListener("keyup",e=>{
      const k = e.key;
      if(keyPressed[k] === undefined) return;
      for(let t of keyPressed[k]) {
        t.next();
      }
      delete keyPressed[k];
    });
  };

  u.on = h=>{
    keyListeners.push(h);
  };
  return u;
})();

// Sensel
o.sensel = (_=>{
  const u = {};
  u.width = 230;
  u.height = 130;
  u.states = { START: 1, MOVE: 2, END: 3 };
  u.touches = {};

  let sensel = { frame: _=>_ };

  const touches = u.touches;
  const touchListeners = [];
  const touchHandlers = {};
  u.use = (senselDevice,contactStates)=>{
    sensel = senselDevice;
    u.states = contactStates;
    setInterval(_=>{
      sensel.frame(f=>{
        f.contact(c=>{
          if(c.state == u.states.START) {
            touchHandlers[c.id] = [];
            for(let l of touchListeners) {
              const t = l();
              t.next();
              touchHandlers[c.id].push(t);
            }
          }
          if(c.state == u.states.END) {
            delete touches[c.id];
          } else touches[c.id] = c;
          for(let t of touchHandlers[c.id]) {
            t.next(c);
          }
        });
      });
    }, 8);
  };

  u.on = h=>{
    touchListeners.push(h);
    return {
      release: _=>{
        for(let i=0;i<touchListeners.length;i++) {
          if(touchListeners[i] == h) {
            touchListeners.splice(i,1);
            break;
          }
        }
      }
    };
  };
  return u;
})();

// Midi
o.midi = (_=>{
  const u = {};

  const noteTouches = {};
  const noteListeners = [];
  function noteInput(e) {
    if(e.length != 3) return;
    let k = e[1];
    let v = e[2] / 127;
    if(e[0] == 0x90) {
      noteTouches[k] = [];
      for(let l of noteListeners) {
        const t = l(k,v);
        t.next();
        noteTouches[k].push(t);
      }
    } else if(e[0] == 0x80 && noteTouches[k]) {
      if(noteTouches[k] === undefined) return;
      for(let t of noteTouches[k]) {
        t.next();
      }
      delete noteTouches[k];
    }
  }
  u.use = deviceCallback=>{
    deviceCallback(e=>{
      noteInput(e.data);
    });
  };

  u.on = h=>{
    noteListeners.push(h);
  };
  return u;
})();

module.exports = o;
