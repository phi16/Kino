module.exports = (o)=>{
  const R = o.render;
  const I = o.input;
  const L = o.log;
  const S = o.sound;
  const Synth = require('./synth.js')(o);

  let hPadding = 0, vPadding = 0;
  const panelScale = 12;

  function panelAt(c) {
    const lx = (c.x - I.width/2) / panelScale;
    const ly = (c.y - I.height/2) / panelScale;
    let ci = lx/1.5;
    let i = Math.floor(ci);
    let shift = i%2 == 0 ? 0 : 0.5;
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
    shift = i%2 == 0 ? 0 : 0.5;
    const cx = I.width/2 + i*1.5*panelScale;
    const cy = I.height/2 + (j+shift)*Math.sqrt(3)*panelScale;
    return { i, j, p, f: 440*Math.pow(2, p/12), cx, cy };
  }

  const outNode = (_=>{
    const n = S.node();
    const c = S.X.createConvolver();
    const b = S.X.createBuffer(2, S.X.sampleRate*4, S.X.sampleRate);
    const f0 = b.getChannelData(0);
    const f1 = b.getChannelData(1);
    let u = Math.PI/4;
    for(let i=0;i<S.X.sampleRate*4;i++) {
      const t = i/S.X.sampleRate;
      const amp = i == 0 ? 1 : Math.exp(-Math.max(0,t-0.5)*8) * Math.sin(t*440*6) * 0.3;
      f0[i] = amp * Math.cos(u);
      f1[i] = amp * Math.sin(u);
      u += (Math.random() * 2 - 1) * 0.4;
    }
    c.buffer = b;
    c.connect(n);
    return n;

    /* const src = S.X.createGain();
    const F1 = S.X.createBiquadFilter();
    F1.type = "bandpass";
    F1.frequency.value = 300;
    F1.Q.value = 40;

    const F2 = S.X.createBiquadFilter();
    F2.type = "bandpass";
    F2.frequency.value = 2750;
    F2.Q.value = 40;
    src.connect(F1).connect(n);
    src.connect(F2).connect(n);
    return src; */
  })();
  const synths = {};
  function retainNote(p, f) {
    if(synths[p]) return synths[p].acquire();
    const s = Synth.node(f);
    const g = S.X.createGain();
    s.node.connect(g).connect(outNode);
    let count = 0;
    let volume = 0, volumeMult = 1/(f*0.005);
    const touches = {};
    const n = {
      id: Math.random(),
      touches: _=>touches,
      shape: _=>volume,
      level: 0,
      press: touch=>{
        let d = touch.d;
        let target = Math.max(0, d) * 1.5;
        volume += (target - volume) * touch.vel * (d < 0 ? -d : 0.1);
        g.gain.setTargetAtTime(volume*volumeMult, S.X.currentTime, 0.01);
      },
      acquire: _=>{
        count++;
        return n;
      },
      register: key=>{
        touches[key] = true;
      },
      release: key=>{
        delete touches[key];
        count--;
        if(count == 0) {
          if(volume < 0.01) {
            delete synths[p];
            g.gain.setTargetAtTime(0, S.X.currentTime, 0.01);
            setTimeout(_=>{
              g.disconnect();
              s.disconnect();
            }, 100);
          }
        }
      }
    };
    synths[p] = n;
    return n.acquire();
  }

  const touchCount = Array(12), touchBright = Array(12);
  touchCount.fill(0), touchBright.fill(0);
  const touchPanels = {};
  I.onTouch(function*(){
    let c = yield;
    while(c.force < 20) c = yield;
    if(c.x < hPadding || c.y < vPadding || c.x > I.width-hPadding || c.y > I.height-vPadding) return;
    const panel = panelAt(c);
    const note = retainNote(panel.p, panel.f);

    const key = Math.random();
    const touch = { i: panel.i, j: panel.j, v: 0, m: 1, g: 0, active: 1 };
    touch.update = _=>{
      touch.x = (c.x-panel.cx)/panelScale;
      touch.y = (c.y-panel.cy)/panelScale;
      touch.d = Math.sqrt(touch.x*touch.x + touch.y*touch.y) - 0.4;
      touch.vel = Math.pow(Math.max(0,c.force-40)*0.0015, 2);
    };
    touchPanels[key] = touch;
    note.register(key);
    const cp = (panel.p%12+12)%12;

    touch.update();
    touch.m = touch.d > 0 ? 1 : 0.5;
    note.press(touch);
    touchCount[cp]++;
    while((c=yield).state == I.state.MOVE) {
      touch.update();
      note.press(touch);
    }
    touch.vel = 0;
    touchCount[cp]--;
    note.release(key);
    touch.active = 0;
    setTimeout(_=>{
      delete touchPanels[key];
    }, 1000);
  });

  let displayTime = 0;
  return {
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
          return 1 - d;
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
                const hue = x*0.02+y*0.05-0.2;
                R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y),6,0,0.9).fill(hue,synths[p]?1:0,(center?0.03:0.06) + touchBright[cp]*0.1);
                if(synths[p]) {
                  const syn = synths[p];
                  let level = 0;
                  Object.keys(syn.touches()).forEach(k=>{
                    if(touchPanels[k].d < 0) level += 1.0;
                  });
                  syn.level += (level - syn.level) * 0.2;
                  R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y),6,0,(1-Math.exp(-syn.level))*0.85).fill(hue,1,syn.shape());
                }
              }
            }
            Object.keys(touchPanels).forEach(k=>{
              const t = touchPanels[k];
              const i = t.i, j = t.j;
              const x = i*1.5;
              const shift = i%2 == 0 ? 0 : 0.5;
              const y = (shift+j)*Math.sqrt(3);
              const center = Math.abs(y) < 3;
              t.v += (t.vel - t.v) * 0.4;
              t.g += (t.active - t.g) * 0.4;
              const scale = 1 - Math.exp(-t.v*20.0) * (1 - t.g * 0.5);
              t.m += ((t.d>0 ? 1 : 0.5) - t.m) * 0.4;
              R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y)*t.m,6,0,1-scale*0.3).fill(1,0,0.1*Math.pow(scale, 0.4));
            });
          });
        });
      });
    }
  };
};
