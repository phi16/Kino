module.exports = Kino=>{
  const o = {};
  o.mixerRender = _=>_;
  o.effectorRender = _=>_;

  const R = Kino.R;
  const S = Kino.S;
  const I = Kino.I.sensel;
  const M = {
    w: I.width,
    h: I.height,
    hPad: 24,
    vPad: 8,
    frame: 2
  };
  M.mw = M.w + M.frame*2;
  M.mh = M.h + M.frame*2;
  M.ox = -M.mw/2 + M.frame;
  M.oy = -M.mh/2 + M.frame;
  M.mainW = M.w - M.hPad*2;
  M.mainH = M.h - M.vPad*2;
  M.sideX = M.hPad + M.mainW;

  let currentPart = null;
  o.present = p=>{
    if(currentPart == p) return;
    if(currentPart != null) currentPart.onClose();
    currentPart = p;
    currentPart.onOpen();
  };
  o.release = p=>{
    if(currentPart == p) currentPart = null;
  };

  Kino.uiRender(_=>{
    M.scale = Math.min(R.w/M.mw, R.h/M.mh);
    R.clear();
    R.translate(R.w/2, R.h/2).with(_=>{
      R.scale(M.scale).translate(-M.w/2,-M.h/2).with(_=>{
        // Main
        if(currentPart) {
          const g = currentPart.generator;
          g.scheduler.render(M);
          R.translate(M.hPad,M.vPad).with(_=>{
            R.rect(0,0,M.mainW,M.mainH).clip(_=>{
              g.render(M);
            });
          });
        }
        o.mixerRender(M);
        o.effectorRender(M);
        // Frame
        R.shape(_=>{
          R.X.rect(0, 0, I.width, I.height);
          R.X.moveTo(0, M.vPad);
          R.X.lineTo(I.width, M.vPad);
          R.X.moveTo(0, I.height-M.vPad);
          R.X.lineTo(I.width, I.height-M.vPad);
          R.X.moveTo(M.hPad, M.vPad);
          R.X.lineTo(M.hPad, I.height-M.vPad);
          R.X.moveTo(I.width-M.hPad, M.vPad);
          R.X.lineTo(I.width-M.hPad, I.height-M.vPad);
        }).stroke(1,0,0.2,1);

        R.blend("lighter",_=>{
          // Input Overlay
          R.translate(0, 0).with(_=>{
            for(let id in I.touches) {
              let c = I.touches[id];
              p = 1 - Math.exp(-c.force*0.002);
              R.ellipse(c.x, c.y, c.minor_axis*p, c.major_axis*p, c.orientation*Math.PI/180).stroke(1,0,0.2,0.5);
            }
          });
          // Voice Spectrum
          const a = S.voiceFreqs;
          if(a) {
            R.shape(_=>{
              R.X.moveTo(0,a[0]);
              const m = Math.min(a.length, I.width);
              for(let i=0;i<m;i++) {
                R.X.lineTo(i,-a[i]);
              }
            }).stroke(1,0,0.05);
          }
        });
      });
    });
  });

  return o;
};
