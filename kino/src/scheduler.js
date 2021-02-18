module.exports = (Kino,effector)=>g=>{
  const o = {};

  const R = Kino.R;
  const H = Kino.H;
  const I = Kino.I.sensel;
  let M = null;
  const lerp = (a,b,x)=>a+(b-a)*x;

  const pat = H.pattern(2); // TODO: dispose
  pat.on(d=>{
    if(g.note) g.note(d);
  });

  const rh = [];
  for(let i=0;i<8;i++) rh.push(false);
  function touchIndexOf(c) {
    if(M.sideX < c.x) {
      const y = ((c.y - M.vPad) / M.mainH * 10 - 1) / 8;
      if(0 < y && y < 1) {
        const yi = Math.floor(y*9 - 0.5);
        return Math.max(0, Math.min(7, yi));
      }
      return -1;
    }
    return -1;
  }
  let uiActive = false;
  const touchHandler = I.on(function*() { // TODO: dispose
    if(!uiActive || effector.visible || M == null) return;
    let c = yield;
    while(c.force < 20) c = yield;
    let touchIndex = touchIndexOf(c);
    if(touchIndex == -1) return;
    if(!rh[touchIndex]) {
      pat.addEvent(touchIndex/4);
      rh[touchIndex] = true;
    }
  });
  o.open = _=>{
    uiActive = true;
  };
  o.close = _=>{
    uiActive = false;
  };
  o.render = M2=>{
    M = M2;
    R.translate(M.sideX, M.vPad).with(_=>{
      const ub = M.mainH/10, lb = M.mainH - ub;
      const le = M.hPad/8, re = M.hPad - le;
      R.shape(X=>{
        X.moveTo(le,ub);
        X.lineTo(re,ub);
        X.moveTo(le,lb);
        X.lineTo(re,lb);
      }).stroke(1,0,0.1,0.6);
      // Beats
      const p = 1;
      R.rect(p, 0, M.hPad-p*2, M.mainH).clip(_=>{
        for(let i=0;i<8;i++) {
          const x = M.hPad/2, y = lerp(ub, lb, (i+1)/9);
          if(rh[i]) R.poly(x,y,3,4,0).stroke(1,0,0.4,0.6);
          else R.circle(x,y,1).stroke(1,0,0.2,0.6);
        }
      });
    });
  };
  return o;
};
