module.exports = (o,G)=>{
  const R = o.render;
  const I = o.input;
  const L = o.log;
  const S = o.sound;

  let n = null;

  const touchCount = Array(12), touchBright = Array(12);
  touchCount.fill(0), touchBright.fill(0);
  const touchPanels = {};
  const panelScale = 15;
  function panelAt(c) {
    const lx = (c.x - I.width/2) / panelScale;
    const ly = (c.y - I.height/2) / panelScale;
    let ci = lx/1.5;
    let i = Math.floor(ci);
    const shift = i%2 == 0 ? 0 : 0.5;
    let cj = ly/Math.sqrt(3) - shift;
    let j = Math.floor(cj);
    ci -= i, cj -= j;
    let d = ci-1/3 - Math.abs(cj-0.5)*3/4;
    if(d > 0) {
      i++;
      if(i%2 == 0) j++;
    } else if(cj > 0.5) {
      j++;
    }
    const p = i*6 + (i%2 == 0 ? 1 : 0) - j*2 - 8;
    return { i, j, p, f: 440*Math.pow(2, p/12) };
  }

  I.onTouch(function*(){
    if(n == null) return;
    let c = yield;
    while(c.force < 20) c = yield;
    let panel = panelAt(c);
    function vel() {
      return Math.max(0,c.force-20)*0.02;
    }
    while(true) {
      const freq = panel.f;
      const m = G.note("K", freq);

      const key = Math.random();
      const touch = { i: panel.i, j: panel.j, vel: 0, v: 1, mv: 0 };
      touchPanels[key] = touch;
      const cp = (panel.p%12+12)%12;

      touch.vel = vel();
      m.attack(touch.vel, 0.01);
      touchCount[cp]++;
      while((c=yield).state == I.state.MOVE) {
        let newPanel = panelAt(c);
        if(panel.p != newPanel.p) {
          panel = newPanel;
          break;
        }
        touch.vel = vel();
        m.attack(touch.vel, 0.01);
      }
      touchCount[cp]--;
      m.release(0.1);
      touch.v = 0;

      setTimeout(_=>{
        delete touchPanels[key];
      },1000);
      if(c.state == I.state.END) break;
    }
  });

  let displayTime = 10000;
  return {
    active: _=>{
      return n != null;
    },
    target: _=>{
      return n;
    },
    open: sel=>{
      n = sel;
      displayTime = 0;
    },
    close: _=>{
      n = null;
      displayTime = 0;
    },
    render: dt=>{
      displayTime += dt;
      for(let i=0;i<touchCount.length;i++) {
        if(touchCount[i] > 0) touchBright[i] += (1 - touchBright[i]) / 4.0;
        else touchBright[i] += (0 - touchBright[i]) / 4.0;
      }
      R.rect(0,0,I.width,I.height).clip(_=>{
        let s = panelScale;
        R.alpha(0.5,_=>{
          R.rect(0,0,I.width,I.height).fill(0,0,0);
        });
        function shapeDist(x,y) {
          let d = Math.sqrt(x*x+y*y);
          d = Math.exp(-Math.max(0, displayTime*16-d*0.5));
          return n ? 1 - d : d;
        }
        R.blend("lighter",_=>{
          R.translate(I.width/2,I.height/2).with(_=>{
            for(let i=-5;i<6;i++) {
              for(let j=-3;j<3;j++) {
                const x = i*1.5;
                const shift = i%2 == 0 ? 0 : 0.5;
                const y = (shift+j)*Math.sqrt(3);
                const center = Math.abs(y) < 3;
                const p = i*6 + (i%2 == 0 ? 1 : 0) - j*2 - 8;
                const cp = (p%12+12)%12;
                R.poly(x*s,y*s,0.9*s*shapeDist(x,y),6,0).fill(1,0, (center?0.1:0.05) + touchBright[cp]*0.1);
              }
            }
            Object.keys(touchPanels).forEach(k=>{
              const t = touchPanels[k];
              t.mv += (t.v - t.mv) / 4.0;
              const i = t.i, j = t.j, v = t.mv;
              const x = i*1.5;
              const shift = i%2 == 0 ? 0 : 0.5;
              const y = (shift+j)*Math.sqrt(3);
              const center = Math.abs(y) < 3;
              const scale = 1 - t.mv * (0.3 - Math.exp(-t.vel*0.2) * 0.15);
              R.polyOutline(x*s,y*s,0.9*s*shapeDist(x,y),6,0,scale).fill(1,0,0.1*t.mv);
            });
          });
        });
      });
    }
  };
};
