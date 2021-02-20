module.exports = (Kino,o)=>{
  const R = Kino.R;
  const S = Kino.S;
  let M = null;

  o.onTouch = function*(){
    if(M == null) return;
    let c = yield;
    if(c.x < M.hPad || c.y < M.vPad || c.x > M.mainW+M.hPad || c.y > M.mainH+M.vPad) return;
    const s = o.alloc();
    let x = (c.x - M.hPad) / M.mainW * 1.2 - 0.1;
    let y = (c.y - M.vPad) / M.mainH * 1.2 - 0.1;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    x = 20 * Math.pow(2, x*10);
    y = 20 * Math.pow(2, y*10);
    s.param([x, y, 1 - Math.exp(-c.force/200)]);
    setTimeout(_=>{
      s.release();
    }, 1000);
  };

  o.render = M2=>{
    M = M2;
    R.rect(M.mainW*(1-1/1.2)/2, M.mainH*(1-1/1.2)/2, M.mainW/1.2, M.mainH/1.2).stroke(0,0,0.4,1);
  };
};
