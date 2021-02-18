module.exports = Kino=>{
  const o = {};
  o.ui = null;
  o.mixer = null;

  o.visible = false;
  const R = Kino.R;
  const S = Kino.S;
  const I = Kino.I.sensel;
  let M = null;
  const dvdx = 0.4;
  const dvdy = -0.4;
  function clamp(a,b,x) {
    return Math.max(a, Math.min(b, x));
  }
  function eff(x) {
    return 1 - Math.exp(-x*0.008);
  }
  const EffectTemplate = _=>{
    const u = {};
    let b = 0;
    u.b = 0;
    u.activateBase = _=>{
      b += 1;
      u.b = 1;
      return _=>{
        b -= 1;
        if(b == 0) u.b = 0;
      };
    };
    u.activate = u.activateBase;
    return u;
  };
  const Title = p=>{
    const u = EffectTemplate();
    let prevName = p.name;
    let nameSize = 1;
    let pull = 0, pullM = 0;
    u.activate = _=>{
      if(p.generator) nameSize = 1.25;
      const a = u.activateBase();
      return _=>{
        a();
        if(u.b == 0) p.node.mute.setTargetAtTime(1, S.X.currentTime, 0.01);
      };
    };
    u.move = (dx,dy,f)=>{
      if(p.generator) {
        pull += dy;
        let ratio = pull / (M.mainH-M.vPad*2);
        p.node.mute.setTargetAtTime(1.-Math.exp(-Math.max(0, 0.9-ratio)), S.X.currentTime, 0.01);
        if(ratio > 1) {
          o.ui.release(p);
          p.disconnect();
          if(activePart && activePart.p == p) {
            // Release all
            activePart = null;
            activeLine.v = -1;
            activeLine.w = true;
          }
        }
      }
    };
    u.render = _=>{
      if(prevName != p.name) {
        nameSize = 2;
        prevName = p.name;
      }
      const b = p.generator ? u.b : 0;
      R.text(p.name,0,0,2+3*nameSize).fill(0,0,0.4+0.4*b);
      nameSize += (1 - nameSize) / 2.0;
      if(u.b == 0) pull = 0;
      pullM += (pull - pullM) / 2.0;
      const offset = M.vPad;
      if(pullM > offset) {
        const f = x=>x*x*(3-2*x);
        const py = M.vPad*0.5;
        const ph = M.mainH-M.vPad*2;
        const pm = f((pullM-offset)/(ph-offset)) * ph + py;
        const pr = (1 - Math.exp(-(pullM-offset)*0.05)) * 1;
        if(pr > 0.01) {
          R.line(0,py,0,pm-pr).stroke(0,0,0.4,0.6);
          R.circle(0,pm,pr).stroke(0,0,0.4,0.6);
        }
      }
    };
    return u;
  };
  const Lpf = p=>{
    const u = EffectTemplate();
    const lBase = Math.log2(20000/20);
    let l = Math.log2(p.node.lf.value/20)/lBase;
    let v = p.node.ld.value;
    u.move = (dx,dy,f)=>{
      l += dx * dvdx * eff(f/4);
      v += dy * dvdy * eff(f/64);
      l = clamp(-0.1, 1.1, l);
      v = clamp(-0.1, 1.1, v);
      const lu = clamp(0, 1, l);
      const vu = clamp(0, 1, v);
      p.node.lf.setTargetAtTime(Math.pow(2, lu*lBase)*20, S.X.currentTime, 0.01);
      p.node.ld.setTargetAtTime(vu, S.X.currentTime, 0.01);
      p.node.lw.setTargetAtTime(1-vu, S.X.currentTime, 0.01);
    };
    u.render = _=>{
      const s = M.hPad/2;
      const w = s*0.7;
      const h = s*0.7;
      const lu = clamp(0, 1, l);
      const vu = clamp(0, 1, v);
      R.shape(X=>{
        X.moveTo(-w, -0.5*h);
        const l0 = lu*1.6-1;
        const l1 = lu*1.6-0.6;
        X.lineTo(l0*w, -0.5*h);
        X.lineTo(l1*w, (0.5-vu)*h);
        X.lineTo(w, (0.5-vu)*h);
        X.moveTo(l0*w, -0.5*h);
        X.lineTo(l0*w, 0.5*h);
        X.lineTo(-w, 0.5*h);
      }).stroke(0,0,0.2+0.2*u.b,0.6);
    };
    return u;
  };
  const Hpf = p=>{
    const u = EffectTemplate();
    const lBase = Math.log2(20000/20);
    let l = Math.log2(p.node.hf.value/20)/lBase;
    let v = p.node.hd.value;
    u.move = (dx,dy,f)=>{
      l += dx * dvdx * eff(f/4);
      v += dy * dvdy * eff(f/64);
      l = clamp(-0.1, 1.1, l);
      v = clamp(-0.1, 1.1, v);
      const lu = clamp(0, 1, l);
      const vu = clamp(0, 1, v);
      p.node.hf.setTargetAtTime(Math.pow(2, lu*lBase)*20, S.X.currentTime, 0.01);
      p.node.hd.setTargetAtTime(vu, S.X.currentTime, 0.01);
      p.node.hw.setTargetAtTime(1-vu, S.X.currentTime, 0.01);
    };
    u.render = _=>{
      const s = M.hPad/2;
      const w = s*0.7;
      const h = s*0.7;
      const lu = clamp(0, 1, l);
      const vu = clamp(0, 1, v);
      R.shape(X=>{
        X.moveTo(-w, (0.5-vu)*h);
        const l0 = lu*1.6-1;
        const l1 = lu*1.6-0.6;
        X.lineTo(l0*w, (0.5-vu)*h);
        X.lineTo(l1*w, -0.5*h);
        X.lineTo(w, -0.5*h);
        X.moveTo(l1*w, -0.5*h);
        X.lineTo(l1*w, 0.5*h);
        X.lineTo(w, 0.5*h);
      }).stroke(0,0,0.2+0.2*u.b,0.6);
    };
    return u;
  };
  const Blank = p=>{
    const u = EffectTemplate();
    u.move = _=>_;
    u.render = _=>_;
    return u;
  };
  const effects = [];
  effects.push(Title);
  effects.push(Blank);
  effects.push(Blank);
  effects.push(Blank);
  effects.push(Blank);
  effects.push(Lpf);
  effects.push(Hpf);
  effects.push(Blank);
  let activeEffects = [];
  let activeEffectLoc = 0;

  const activeLine = { i: -1, l: 1, v: 1, w: false /* is waiting */ };
  let activePart = null;
  let partReleased = true, effectTouches = 0;
  o.present = (p,i,l)=>{
    const u = { p, i, l };
    activePart = u;
    activeLine.v = activeLine.i < 0 ? 0 /* no wait */ : -1;
    activeLine.w = true;
    activeEffectLoc = 0;
    activeEffects = [];
    for(let i=0;i<effects.length;i++) activeEffects.push(effects[i](p));
    partReleased = false;
    effectTouches = 0;
    o.visible = true;
    return _=>{
      if(activePart != u) return;
      partReleased = true;
      if(effectTouches == 0) o.hideEffector();
    };
  };
  o.hideEffector = _=>{
    activePart = null;
    activeLine.v = -1;
    activeLine.w = true;
    o.visible = false;
  };
  function touchIndexOf(c) {
    if(M.sideX < c.x) {
      const y = (c.y - M.vPad) / M.mainH * effects.length;
      const yi = Math.floor(y);
      if(0 <= yi && yi < effects.length) {
        return yi;
      }
    }
    return -1;
  }
  I.on(function*() {
    let c = yield;
    const ap = activePart;
    if(!ap) return;
    let touchIndex = touchIndexOf(c);
    if(touchIndex == -1) return;
    if(ap.p.generator) o.ui.present(ap.p); // Generator UI display
    const ae = activeEffects[touchIndex];
    const e = ae.activate();
    effectTouches++;
    // Slider
    let nc = null;
    while(nc = yield) {
      ae.move(nc.x - c.x, nc.y - c.y, nc.force);
      c = nc;
      if(c.state == I.states.END) {
        e();
        if(ap == activePart) {
          effectTouches--;
          if(effectTouches == 0 && partReleased) o.hideEffector();
        }
      }
    }
  });
  o.render = M2=>{
    M = M2;
    const p = 0.3;
    // Horizontal line
    R.translate(M.hPad, M.vPad).with(_=>{
      activeLine.v += 0.125;
      if(activeLine.v >= 0 && activeLine.w) {
        if(activePart) {
          activeLine.i = activePart.i;
          activeLine.l = activePart.l;
        } else activeLine.i = -1, activeLine.v = 1;
        activeLine.w = false;
      }
      activeLine.v = Math.min(1, activeLine.v);
      const b = Math.abs(activeLine.v);
      if(b > 0.01 && activeLine.i >= 0) {
        const s = activeLine.v < 0 ? 1 : 0;
        const t = activeLine.v + s;
        const y = (activeLine.i+0.5)/activeLine.l*M.mainH;
        R.line(s*M.mainW,y,t*M.mainW,y).stroke(0,0,0.4,0.6*b);
      }
    });
    // Effect Interfaces
    R.translate(M.sideX, M.vPad).with(_=>{
      R.rect(0, 0, M.hPad, M.mainH).clip(_=>{
        if(activePart) activeEffectLoc += (1 - activeEffectLoc) / 2.0;
        else activeEffectLoc += (0 - activeEffectLoc) / 2.0;
        if(activeEffectLoc > 0.01) {
          const shift = (activeEffectLoc-1) * M.hPad;
          R.rect(shift, 0, M.hPad, M.mainH).fill(0,0,0);
          for(let i=activeEffects.length-1;i>-1;i--) { // Reverse order to display remove line on top
            const e = activeEffects[i];
            R.translate(M.hPad/2+shift, (i+0.5)/effects.length*M.mainH).with(_=>{
              e.render();
            });
          }
          R.line(M.hPad+shift,0,M.hPad+shift,M.mainH).stroke(0,0,0.2,1);
        }
      });
    });
  };
  return o;
};
