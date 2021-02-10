module.exports = Kino=>{
  const o = {};

  const R = Kino.R;
  const I = Kino.I.sensel;
  let M = null;
  const lerp = (a,b,x)=>a+(b-a)*x;
  const sidePad = 10;
  const dvdx = -0.4;

  function eff(x) {
    return 1 - Math.exp(-x*0.008);
  }
  const Part = _=>{
    const p = {};
    p.active = false;
    p.volume = 0.5;
    p.addVolume = v=>{
      p.volume += v;
      p.volume = Math.max(0, Math.min(1, p.volume));
    };
    let grabbed = false;
    p.grab = _=>{
      if(grabbed) return false;
      grabbed = true;
      return _=>{
        grabbed = false;
      };
    };

    let touchIndex = 0, touchCount = 0;
    const forces = {};
    p.touch = f=>{
      const i = touchIndex;
      touchIndex++;
      touchCount++;
      forces[i] = f;
      return {
        press: f=>{
          forces[i] = f;
        },
        release: _=>{
          touchCount--;
          delete forces[i];
        }
      };
    };
    p.shape = { d: 0, l: 0, v: 0, b: 0 };
    p.step = _=>{
      if(p.active) {
        p.shape.d += (1 - p.shape.d) / 4.0;
        p.shape.l += (1 - p.shape.l) / 4.0;
        p.shape.v += (p.volume - p.shape.v) / 4.0;
        p.shape.b += ((grabbed ? 1 : 0) - p.shape.b) / 2.0;
      } else {
        if(touchCount == 0) {
          p.shape.d += (0 - p.shape.d) / 2.0;
          p.shape.l += (0 - p.shape.l) / 2.0;
        } else {
          let f = 0;
          Object.keys(forces).forEach(i=>{
            const fi = eff(forces[i]);
            f = Math.max(f, fi);
          });
          p.shape.d += (f*2.5 - p.shape.d) / 4.0;
          p.shape.l += (0 - p.shape.l) / 4.0;
        }
        p.shape.v += (0.5 - p.shape.v) / 4.0;
        p.shape.b += (0 - p.shape.b) / 4.0;
      }
    };
    p.activate = _=>{
      if(p.active) return false;
      p.active = true;
      p.volume = 0;
      p.shape.d = 5;
      p.shape.l = 0;
      return true;
    };
    return p;
  };
  const parts = [];
  for(let i=0;i<9;i++) parts.push(Part());
  const masterPart = parts[parts.length-1];
  masterPart.activate();
  masterPart.addVolume(1);
  function touchIndexOf(c) {
    if(0 < c.x && c.x < M.hPad) {
      const y = (c.y - M.vPad) / M.mixerH * parts.length;
      const yi = Math.floor(y);
      if(0 <= yi && yi < parts.length) {
        return yi;
      }
    }
    return -1;
  }
  I.on(function*() {
    let c = yield;
    let touchIndex = touchIndexOf(c);
    if(touchIndex == -1) return;
    if(parts[touchIndex].active) {
      const p = parts[touchIndex];
      const g = p.grab();
      if(g) {
        // Volume slider
        let nc = null;
        while(nc = yield) {
          p.addVolume((nc.x - c.x) * dvdx * eff(c.force/4));
          c = nc;
          if(c.state == I.states.END) g();
        }
      }
    }
    // On a blank part
    let touch = parts[touchIndex].touch(c.force);
    while(c = yield) {
      let newTouchIndex = -1;
      if(c.state != I.states.END) {
        newTouchIndex = touchIndexOf(c);
      }
      if(newTouchIndex != touchIndex) {
        if(touchIndex != -1) touch.release(), touch = null;
        touchIndex = newTouchIndex;
        if(touchIndex != -1) touch = parts[touchIndex].touch(c.force);
      }
      if(touch) {
        touch.press(c.force);
        if(c.force > 500) {
          // Create a new part
          const p = parts[touchIndex];
          if(p.activate()) {
            touch.release();
            const g = p.grab(); // Assert: g != null
            let nc = null;
            while(nc = yield) {
              // TODO: generator
              p.addVolume((nc.x - c.x) * dvdx * eff(c.force/4));
              c = nc;
              if(c.state == I.states.END) g();
            }
            // never come
          }
        }
      }
    }
  });
  o.render = M2=>{
    M = M2;
    const p = 0.3;
    const w = M.hPad - p*2;
    const h = M.mixerH - p*2;
    R.translate(p, M.vPad+p).with(_=>{
      const e = 3;
      const n = parts.length;
      const u = h/n;
      R.shape(X=>{
        for(let i=0;i<n-2;i++) {
          const y = (i+1)*u;
          X.moveTo(e,y);
          X.lineTo(w-e,y);
        }
      }).stroke(1,0,0.1,0.6);
      R.line(0,(n-1)*u,w,(n-1)*u).stroke(1,0,0.2,1);
      for(let i=0;i<n;i++) {
        const s = parts[i];
        s.step();
        const y = (i+0.5)*u;
        const r = s.shape.d * 2;
        const l = s.shape.l * 1;
        const b = s.shape.b * 0.4;
        if(r > 0.01 || l > 0.01) {
          const v = lerp(w-e-l-r, e+r/2, s.shape.v);
          const c = lerp(v+r, w-e, s.shape.l);
          R.circle(c,y,l).stroke(1,0,0.2+b,0.6);
          R.line(v+r,y,c-l,y).stroke(1,0,0.2+b,0.6);
          R.poly(v,y,r,4,0).stroke(1,0,0.3+b,0.6);
        }
      }
    });
  };
  return o;
};
