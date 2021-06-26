module.exports = (Kino,o)=>{
  const R = Kino.R;
  const S = Kino.S;
  const I = Kino.I.sensel;
  let M = null;

  const rawFreq = 656;
  const storeThreshold = 10000; // 0.075;
  const notes = {};
  function retainNote(p, f) {
    if(notes[p]) return notes[p].acquire();
    const s = o.alloc();
    if(s == null) return null;
    s.param([f/rawFreq, 0]);
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
      press: (key, touch)=>{
        touches[key].vel = touch.vel;
      },
      acquire: _=>{
        if(count == 0) vel1 = vel2 = velM = 0;
        count++;
        return n;
      },
      register: key=>{
        touches[key] = { vel: 0 };
      },
      release: key=>{
        delete touches[key];
        count--;
      },
      step: dt=>{
        Object.keys(touches).forEach(k=>{
          const t = touches[k];
          vel0 += t.vel;
        });
        velM = Math.max(velM, vel2);
        volH *= Math.exp(-dt*8);
        if(count == 0) {
          if(volL < storeThreshold) volL *= Math.exp(-dt*1);
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
        s.param([f/rawFreq, volume*volumeMult]);
        if(count == 0 && volume < 0.0001) {
          delete notes[p];
          s.release();
        }
      }
    };
    notes[p] = n;
    return n.acquire();
  }

  const panelScale = 12;
  function panelAt(c) {
    const lx = (c.x - M.w/2) / panelScale;
    const ly = (c.y - M.h/2) / panelScale;
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
    const cx = M.mainW/2 + i*1.5*panelScale;
    const cy = M.mainH/2 + (j+shift)*Math.sqrt(3)*panelScale;
    return { i, j, p, f: 440*Math.pow(2, p/12), cx, cy };
  }

  const touchCount = Array(12), touchBright = Array(12);
  touchCount.fill(0), touchBright.fill(0);
  const touchPanels = {};
  o.onTouch = function*(){
    if(M == null) return;
    let c = yield;
    if(c.x < M.hPad || c.y < M.vPad || c.x > M.mainW+M.hPad || c.y > M.mainH+M.vPad) return;
    const panel = panelAt(c);
    const note = retainNote(panel.p, panel.f);
    if(note == null) return;

    const key = Math.random();
    const touch = { i: panel.i, j: panel.j, v: 0, m: 1, g: 0, active: 1 };
    touch.update = _=>{
      touch.x = (c.x-panel.cx)/panelScale;
      touch.y = (c.y-panel.cy)/panelScale;
      touch.d = -1;
      touch.vel = Math.pow(c.force*0.003, 2);
    };
    touchPanels[key] = touch;
    note.register(key);
    const cp = (panel.p%12+12)%12;

    touch.update();
    touch.m = touch.d > 0 ? 1 : 0.5;
    note.press(key, touch);
    touchCount[cp]++;
    while((c=yield).state == I.states.MOVE) {
      touch.update();
      note.press(key, touch);
    }
    touch.vel = 0;
    touchCount[cp]--;
    note.release(key);
    touch.active = 0;
    setTimeout(_=>{
      delete touchPanels[key];
    }, 1000);
  };

  o.uiStep = dt=>{
    for(const p in notes) {
      const n = notes[p];
      n.step(dt);
    }
    for(let i=0;i<touchCount.length;i++) {
      if(touchCount[i] > 0) touchBright[i] += (1 - touchBright[i]) / 4.0;
      else touchBright[i] += (0 - touchBright[i]) / 4.0;
    }
  };
  o.render = M2=>{
    M = M2;
    let s = panelScale;
    function shapeDist(x,y) {
      let d = Math.sqrt(x*x+y*y);
      d = Math.exp(-Math.max(0, o.displayTime*16-d*0.5));
      return 1 - d;
    }
    R.blend("lighter",_=>{
      R.translate(M.mainW/2,M.mainH/2).with(_=>{
        const vf = S.peakFreq;
        vf.p = Math.log2(vf.f/440) * 12 - 24;
        for(let i=-5;i<6;i++) {
          for(let j=-3;j<4;j++) {
            const x = i*1.5;
            const shift = i%2 == 0 ? 0 : 0.5;
            const y = (shift+j)*Math.sqrt(3);
            const center = Math.abs(y) < 3;
            const p = i*6 + (i%2 == 0 ? 1 : 0) - j*2 - 8;
            const cp = (p%12+12)%12;
            const hue = x*0.02+y*0.05-0.2;
            const n = notes[p];
            const shape = n ? n.shape() : [0,0];
            R.polyOutline(x*s,y*s,0.96*s*shapeDist(x,y),6,0,center?0.9:0.8).fill(hue,shape[0]>storeThreshold?1:0,(center?0.03:0.01)*(1+touchBright[cp]*3));
            const vdi = Math.abs(vf.p-p);
            if(vdi < 1) {
              let str = 1 - vdi;
              str = str*str*(3-2*str);
              R.polyOutline(x*s,y*s,0.5*s*shapeDist(x,y),6,0,0.8).fill(1,0,str*vf.s,1);
            }
            if(n) {
              let level = 0;
              Object.keys(n.touches()).forEach(k=>{
                if(touchPanels[k].d < 0) level += 1.0;
              });
              n.level += (level - n.level) * 0.2;
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
        const centerFreq = 440*2/3*4;
        const vCenter = (Math.log2(vf.f/centerFreq))*s*3;
        const vOffset = M.mainH*Math.sqrt(3)/6/2;
        R.line(vCenter-vOffset,-M.mainH/2,vCenter+vOffset,M.mainH/2).stroke(0,0,vf.s,1);
      });
    });
  };
};
