module.exports = (o)=>{
  const R = o.render;
  const I = o.input;
  const L = o.log;
  const S = o.sound;

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
    const end = S.node();
    const n = S.X.createGain();
    /* const c = S.X.createConvolver();
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
    c.connect(n); */

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

    const lpf = S.X.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 10000.0;
    const hpf = S.X.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 20.0;
    n.connect(lpf).connect(hpf).connect(end);
    return n;
  })();
  const Synth = require('./synth.js')(o, outNode);

  const synths = {};
  function retainNote(p, f) {
    if(synths[p]) return synths[p].acquire();
    const s = Synth.note(f);
    let count = 0;
    let vel0 = 0, vel1 = 0, vel2 = 0, velM = 0;
    let volL = 0, volH = 0;
    let volume = 0, volumeMult = Math.pow(1/(f*0.005), 0.2);
    const touches = {};
    const n = {
      id: Math.random(),
      touches: _=>touches,
      shape: _=>[volL, volH],
      level: 0,
      press: touch=>{
        vel0 += touch.vel;
      },
      acquire: _=>{
        if(count == 0) vel1 = vel2 = velM = 0;
        count++;
        return n;
      },
      register: key=>{
        touches[key] = true;
      },
      release: key=>{
        delete touches[key];
        count--;
      },
      step: dt=>{
        velM = Math.max(velM, vel2);
        volH *= Math.exp(-dt*8);
        if(count == 0) {
          volL *= Math.exp(-dt*volH*(1-Math.exp(-velM*1))*8);
          if(volL < 0.075) volL *= Math.exp(-dt*2);
          volume = volL + volH;
          vel1 = vel2;
        } else {
          vel1 += (vel0 - vel1) * Math.exp(-dt*200);
          vel2 += (vel1 - vel2) * Math.exp(-dt*200);
          const eff = 1 - Math.exp(-velM*1);
          volL += (vel2 - volL) * eff;
          volH += Math.max(0, vel0 - vel2);
          volume = volL + volH;
          vel0 = 0;
        }
        s.gain(volume*volumeMult);
        if(count == 0 && volume < 0.001) {
          delete synths[p];
          s.disconnect();
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
    // while(c.force < 20) c = yield;
    if(c.x < hPadding || c.y < vPadding || c.x > I.width-hPadding || c.y > I.height-vPadding) return;
    const panel = panelAt(c);
    const note = retainNote(panel.p, panel.f);

    const key = Math.random();
    const touch = { i: panel.i, j: panel.j, v: 0, m: 1, g: 0, active: 1 };
    touch.update = _=>{
      touch.x = (c.x-panel.cx)/panelScale;
      touch.y = (c.y-panel.cy)/panelScale;
      touch.d = -1; // Math.sqrt(touch.x*touch.x + touch.y*touch.y) - 0.4;
      touch.vel = Math.pow(c.force*0.003, 2);
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
      for(const p in synths) {
        const s = synths[p];
        s.step(dt);
      }
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
            const vf = S.voiceFreq();
            vf.p = Math.log2(vf.f/440) * 12 - 12;
            for(let i=-5;i<6;i++) {
              for(let j=-3;j<4;j++) {
                const x = i*1.5;
                const shift = i%2 == 0 ? 0 : 0.5;
                const y = (shift+j)*Math.sqrt(3);
                const center = Math.abs(y) < 3;
                const p = i*6 + (i%2 == 0 ? 1 : 0) - j*2 - 8;
                const cp = (p%12+12)%12;
                const hue = x*0.02+y*0.05-0.2;
                const syn = synths[p];
                const shape = syn ? syn.shape() : [0,0];
                R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y),6,0,0.9).fill(hue,shape[0]>0.075?1:0,(center?0.03:0.06) + touchBright[cp]*0.1);
                const vdi = Math.abs(vf.p-p);
                if(vdi < 1) {
                  let str = 1 - vdi;
                  str = str*str*(3-2*str);
                  R.polyOutline(x*s,y*s,0.5*s*shapeDist(x,y),6,0,0.8).fill(1,0,str*vf.s,1);
                }
                if(syn) {
                  let level = 0;
                  Object.keys(syn.touches()).forEach(k=>{
                    if(touchPanels[k].d < 0) level += 1.0;
                  });
                  syn.level += (level - syn.level) * 0.2;
                  R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y),6,0,0).fill(hue,1,shape[0]);
                  R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y),6,0,0.8).fill(hue,1,shape[1]);
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
            const centerFreq = 440*2/3*2;
            const vCenter = (Math.log2(vf.f/centerFreq))*s*3;
            const vOffset = I.height*Math.sqrt(3)/6/2;
            R.line(vCenter-vOffset,-I.height/2,vCenter+vOffset,I.height/2).stroke(0,0,vf.s,1);
          });
        });
      });
    }
  };
};
