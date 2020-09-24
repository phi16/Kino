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
    let c = yield;
    while(c.force < 20) c = yield;
    let panel = panelAt(c);
    while(true) {
      const freq = panel.f;
      const g = S.node();
      g.gain.value = 0;
      const osc = S.X.createOscillator();
      const og = S.X.createGain();
      const osc2 = S.X.createOscillator();
      const sg = S.X.createGain();
      osc.frequency.value = freq*4;
      og.gain.value = freq;
      osc2.frequency.value = freq;
      osc.connect(og);
      osc.start();
      og.connect(osc2.frequency);
      osc2.connect(sg);
      sg.gain.value = 0.1;
      sg.connect(g);
      osc2.start();

      const key = Math.random();
      const touch = { i: panel.i, j: panel.j, g, m: 1 };
      touchPanels[key] = touch;

      const cp = (panel.p%12+12)%12;
      touchCount[cp]++;
      while((c=yield).state == I.state.MOVE) {
        let newPanel = panelAt(c);
        if(panel.p != newPanel.p) {
          panel = newPanel;
          break;
        }
        g.gain.setTargetAtTime(Math.max(0,c.force-20)*0.02, S.X.currentTime+0.001, 0.01);
      }
      touchCount[cp]--;

      g.gain.setTargetAtTime(0, S.X.currentTime+0.001, 0.1);
      setTimeout(_=>{
        g.disconnect();
        delete touchPanels[key];
      },1000);
      if(c.state == I.state.END) break;
    }
  });

  return {
    open: sel=>{
      n = sel;
    },
    render: _=>{
      for(let i=0;i<touchCount.length;i++) {
        if(touchCount[i] > 0) touchBright[i] += (1 - touchBright[i]) / 4.0;
        else touchBright[i] += (0 - touchBright[i]) / 4.0;
      }
      R.rect(0,0,I.width,I.height).clip(_=>{
        let s = panelScale;
        R.alpha(0.5,_=>{
          R.rect(0,0,I.width,I.height).fill(0,0,0);
        });
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
                R.poly(x*s,y*s,0.9*s,6,0).fill(1,0, (center?0.1:0.05) + touchBright[cp]*0.1);
              }
            }
            Object.keys(touchPanels).forEach(k=>{
              const t = touchPanels[k];
              const i = t.i, j = t.j, v = t.g.gain.value;
              t.m *= 0.9;
              const x = i*1.5;
              const shift = i%2 == 0 ? 0 : 0.5;
              const y = (shift+j)*Math.sqrt(3);
              const center = Math.abs(y) < 3;
              const scale = 0.7*(1-Math.exp(-v/8)) * (1-t.m) + 0.9 * t.m;
              R.poly(x*s,y*s,scale*s,6,0).fill(1,0,0.1*(1-t.m));
            });
          });
        });
      });
    }
  };
};
