module.exports = (o)=>{
  const R = o.render;
  const I = o.input;
  const L = o.log;
  const S = o.sound;

  let n = null;
  let hPadding = 0, vPadding = 0;

  const touchCount = Array(12), touchBright = Array(12);
  touchCount.fill(0), touchBright.fill(0);
  const touchPanels = {};
  const panelScale = 12.5;
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

  const outNode = S.node();
  function note(f) {
    const osc = S.X.createOscillator();
    osc.frequency.value = f;
    osc.start();
    const g = S.X.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(outNode);
    return {
      attack: (v,d)=>{
        g.gain.setTargetAtTime(v, S.X.currentTime, d);
      },
      release: (d)=>{
        g.gain.setTargetAtTime(0, S.X.currentTime, d);
        setTimeout(_=>{
          g.disconnect();
        },1000);
      }
    }
  }

  I.onTouch(function*(){
    if(n == null) return;
    let c = yield;
    while(c.force < 20) c = yield;
    if(c.x < hPadding || c.y < vPadding || c.x > I.width-hPadding || c.y > I.height-vPadding) return;
    let panel = panelAt(c);
    function vel() {
      return Math.pow(Math.max(0,c.force-20)*0.0015, 2);
    }
    while(true) {
      const freq = panel.f;
      const m = note(freq);

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
    render: (dt,hPad,vPad)=>{
      hPadding = hPad, vPadding = vPad;
      displayTime += dt;
      for(let i=0;i<touchCount.length;i++) {
        if(touchCount[i] > 0) touchBright[i] += (1 - touchBright[i]) / 4.0;
        else touchBright[i] += (0 - touchBright[i]) / 4.0;
      }
      R.rect(hPad,vPad,I.width-2*hPad,I.height-2*vPad).clip(_=>{
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
              for(let j=-3;j<4;j++) {
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
