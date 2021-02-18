module.exports = Kino=>{
  const o = {};

  const R = Kino.R;
  const H = Kino.H;
  const I = Kino.I.sensel;
  let M = null;
  const lerp = (a,b,x)=>a+(b-a)*x;

  I.on(function*() {
    let c = yield;
  });
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
          if(i%2 == 1) R.circle(x,y,1).stroke(1,0,0.2,0.6);
          else R.poly(x,y,3,4,0).stroke(1,0,0.4,0.6);
        }
      });
    });
  };
  return o;
};
