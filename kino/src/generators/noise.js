module.exports = (Kino,o)=>{
  const R = Kino.R;
  const S = Kino.S;
  const I = Kino.I.sensel;
  let M = null;

  o.step = _=>{
    o.store.synth[2] = o.store.synth[0];
    o.store.synth[3] = o.store.synth[1];
    o.store.synth[5] = o.store.synth[4];
  };

  let uiActive = false;
  const touchHandler = I.on(function*(){
    if(!uiActive || M == null) return;
    let c = yield;
    if(c.x < M.hPad || c.y < M.vPad || c.x > M.mainW+M.hPad || c.y > M.mainH+M.vPad) return;
    if(o.store.synth.length == 0) o.alloc();
    while(true) {
      let c = yield;
      let x = (c.x - M.hPad) / M.mainW * 1.2 - 0.1;
      let y = (c.y - M.vPad) / M.mainH * 1.2 - 0.1;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      x = 20 * Math.pow(2, x*10);
      y = 20 * Math.pow(2, y*10);
      o.store.synth[0] = x;
      o.store.synth[1] = y;
      o.store.synth[4] = 1 - Math.exp(-c.force/200);
      console.log(x,y,1-Math.exp(-c.force/200));
      if(c.state == I.states.END) o.store.synth[4] = 0;
    }
  });

  let displayTime = 0;
  o.open = _=>{
    uiActive = true;
    displayTime = 0;
  };
  o.close = _=>{
    uiActive = false;
  };
  o.disconnect = _=>{
    uiActive = false;
    touchHandler.release();
  };
  o.uiStep = dt=>{
    displayTime += dt;
  };
  o.render = M2=>{
    M = M2;
    R.rect(M.mainW*(1-1/1.2)/2, M.mainH*(1-1/1.2)/2, M.mainW/1.2, M.mainH/1.2).stroke(0,0,0.4,1);
  };
};
