module.exports = Kino=>{
  const R = Kino.R;
  const S = Kino.I.sensel;
  const M = {
    w: S.width,
    h: S.height,
    hPad: 24,
    vPad: 8,
    frame: 2
  };
  M.mw = M.w + M.frame*2;
  M.mh = M.h + M.frame*2;
  M.ox = -M.mw/2 + M.frame;
  M.oy = -M.mh/2 + M.frame;

  let prevTime = new Date();
  Kino.uiRender(_=>{
    const curTime = new Date();
    const dt = (curTime - prevTime) / 1000;
    prevTime = curTime;

    M.scale = Math.min(R.w/M.mw, R.h/M.mh);
    R.clear();
    R.translate(R.w/2, R.h/2).with(_=>{
      R.scale(M.scale).translate(-M.w/2,-M.h/2).with(_=>{
        // Input Overlay
        R.blend("lighter",_=>{
          R.translate(0, 0).with(_=>{
            for(let id in S.touches) {
              let c = S.touches[id];
              p = 1 - Math.exp(-c.force*0.002);
              R.ellipse(c.x, c.y, c.minor_axis*p, c.major_axis*p, c.orientation*Math.PI/180).stroke(1,0,0.2,0.5);
            }
          });
          R.shape(_=>{
            R.X.rect(0, 0, S.width, S.height);
            R.X.moveTo(0, M.vPad);
            R.X.lineTo(S.width, M.vPad);
            R.X.moveTo(0, S.height-M.vPad);
            R.X.lineTo(S.width, S.height-M.vPad);
            R.X.moveTo(M.hPad, M.vPad);
            R.X.lineTo(M.hPad, S.height-M.vPad);
            R.X.moveTo(S.width-M.hPad, M.vPad);
            R.X.lineTo(S.width-M.hPad, S.height-M.vPad);
          }).stroke(1,0,0.2,1.0);

          // Voice Spectrum
          const a = Kino.S.voiceFreqs;
          if(a) {
            R.shape(_=>{
              R.X.moveTo(0,a[0]);
              const m = Math.min(a.length, S.width);
              for(let i=0;i<m;i++) {
                R.X.lineTo(i,-a[i]);
              }
            }).stroke(1,0,0.05);
          }
        });
      });
    });
  });
};