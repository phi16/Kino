module.exports = o=>{
  const R = o.render;
  const S = o.sound;
  const L = o.log;

  /*

  - Node
    - op: Operation
    - x, y: Float (relative)
    - bb: [ lx, ly, ux, uy: Float ] (bounding box)
    - length: Int
    - next: [Node]
  - Graph
    - root: Node

  */

  const Layout = {
    default: n=>{
      if(n.op.arity.length == 0) {
        const u = Math.max(0.25, n.op.r);
        n.bb = [-u,-u,u,u];
      } else if(n.op.arity.length == 1) {
        const c = n.next[0];
        c.x = c.length + 1 - c.bb[0];
        c.y = 0;
        n.bb = [].concat(c.bb);
        n.bb[2] += c.x;
      }
    },
    side: n=>{
      const c0 = n.next[0];
      const c1 = n.next[1];
      c0.x = c0.length + 1 - c0.bb[0];
      c0.y = 0;
      n.bb = [].concat(c0.bb);
      n.bb[2] += c0.x;
      const p0 = Math.abs(c0.bb[3]) + Math.abs(c1.bb[1]) + 0.375;
      c1.y = p0;
      c1.x = p0 + c1.length;
      n.bb[2] = Math.max(n.bb[2], c1.x + c1.bb[2]);
      n.bb[3] = Math.max(n.bb[3], c1.y + c1.bb[3]);
    },
    merge: n=>{
      const c0 = n.next[0];
      const c1 = n.next[1];
      const p0 = Math.max(Math.abs(c0.bb[3]), 0.5) + 0.125;
      const p1 = Math.max(Math.abs(c1.bb[1]), 0.5) + 0.125;
      c0.y = -p0;
      c1.y = p1;
      c0.x = p0 + c0.length;
      c1.x = p1 + c1.length;
      n.bb = [
        -0.25,
        c0.y + c0.bb[1],
        Math.max(c0.x + c0.bb[2], c1.x + c1.bb[2]),
        c1.y + c1.bb[3]
      ];
    },
    root: n=>{
      const c = n.next[0];
      c.x = c.length;
      c.y = 0;
      n.bb = [].concat(c.bb);
      n.bb[2] += c.x;
    }
  };
  const Ty = {
    inst: {},
    pattern: {},
    sound: {},
    any: {}
  };
  Object.keys(Ty).forEach(n=>{
    Ty[n].name = n;
  });
  const Op = {
    none: {   r: 0,     arity: [],                    type: Ty.any,     layout: Layout.default },
    some: {   r: 0.25,  arity: [],                    type: Ty.any,     layout: Layout.default },
    sample: { r: 0.25,  arity: [],                    type: Ty.inst,    layout: Layout.default },
    sine: {   r: 0.25,  arity: [],                    type: Ty.inst,    layout: Layout.default },
    rhythm: { r: 0.25,  arity: [],                    type: Ty.pattern, layout: Layout.default },
    play: {   r: 0.375, arity: [Ty.inst, Ty.pattern], type: Ty.sound,   layout: Layout.side },
    merge: {  r: 0,     arity: [Ty.any, Ty.any],      type: Ty.any,     layout: Layout.merge },
    test: {   r: 0.25,  arity: [],                    type: Ty.sound,   layout: Layout.default },
    root: {   r: 0,     arity: [Ty.sound],            type: Ty.sound,   layout: Layout.root }
  };
  Object.keys(Op).forEach(n=>{
    Op[n].name = n;
    Op[n].func = _=>({ eval: _=>_ });
  });

  let rhythmHandlers = [];
  function removeRhythm(h) {
    for(let i=0;i<rhythmHandlers.length;i++) {
      if(rhythmHandlers[i] == h) {
        h.suspend();
        rhythmHandlers.splice(i,1);
        return;
      }
    }
  }
  function addRhythm(i, r, o) {
    let lastTime = 0, lastEvent = null;
    // TODO: multiple waiting nodes
    let waitingNode = null;
    function suspend() {
      if(waitingNode) {
        if(lastTime > S.X.currentTime) {
          waitingNode.disconnect();
        }
        waitingNode = null;
      }
    }
    const h = {
      step: t=>{
        const rt = r(t);
        if(!rt || lastEvent && rt.t < lastEvent.t) {
          suspend();
          lastTime = t;
        }
        lastEvent = rt;
        if(!rt) return;
        if(lastTime < t) {
          waitingNode = null;
          lastTime = t;
        }
        const nt = r(lastTime);
        if(nt.t - t < 0.25) {
          const u = i(nt.f, nt.t);
          const g = S.X.createGain();
          u.connect(g).connect(o);
          waitingNode = g;
          setTimeout(_=>{
            g.disconnect();
          },1000); // TODO
          lastTime = nt.t + 0.001;
        }
      },
      suspend: suspend
    };
    rhythmHandlers.push(h);
    return h;
  }
  R.onRender(_=>{
    const t = S.X.currentTime;
    for(let h of rhythmHandlers) {
      h.step(t);
    }
  });

  function NodeManager(n) {
    let inputs = [];
    return {
      clear: _=>{
        for(let i of inputs) i.disconnect(n);
        inputs = [];
      },
      add: i=>{
        if(i) {
          i.connect(n);
          inputs.push(i);
        }
      }
    };
  }
  Op.sample.func = n=>{
    let b = null;
    S.load("./sound/BDM_Indie_11_Conga.wav").then(x=>{
      b = x;
    });
    return {
      eval: _=>_,
      val: (f,t)=>{
        const ss = S.X.createBufferSource();
        ss.buffer = b;
        ss.start(t);
        return ss;
      }
    };
  };
  Op.sine.func = n=>{
    return {
      eval: _=>_,
      val: (f,t)=>{
        const o = S.X.createOscillator();
        o.frequency.value = f;
        o.start(t);
        const g = S.X.createGain();
        g.gain.value = 0;
        g.gain.setTargetAtTime(1, t, 0.001);
        g.gain.setTargetAtTime(0, t+0.1, 0.1);
        o.connect(g);
        return g;
      }
    };
  };
  Op.rhythm.func = n=>{
    const offset = Math.floor(Math.random()*4)/8;
    return {
      eval: _=>_,
      val: t=>{
        return { t: Math.ceil((t+offset)*2)/2-offset, f: 880*Math.pow(2/3,Math.floor(Math.random()*5)) };
      }
    };
  };
  Op.play.func = n=>{
    const out = S.X.createGain();
    let rh = null;
    return {
      eval: _=>{
        // TODO: stop dangling nodes
        removeRhythm(rh);
        if(n.next[0].func && n.next[0].func.val && n.next[1].func && n.next[1].func.val) {
          rh = addRhythm(n.next[0].func.val, n.next[1].func.val, out);
        }
      },
      val: out
    };
  };
  Op.merge.func = n=>{
    if(n.type == Ty.inst) {
      return {
        eval: _=>_,
        val: (f,t)=>{
          const o = S.X.createGain();
          for(let i of n.next) {
            if(i.func.val) {
              const e = i.func.val(f,t);
              e.connect(o);
            }
          }
          return o;
        }
      };
    } else if(n.type == Ty.pattern) {
      return {
        eval: _=>_,
        val: t=>{
          let me = null;
          for(let i of n.next) {
            if(i.func.val) {
              let ce = i.func.val(t);
              if(me == null || ce.t < me.t) me = ce;
            }
          }
          return me;
        }
      };
    } else if(n.type == Ty.sound) {
      const out = S.X.createGain();
      const m = NodeManager(out);
      return {
        eval: _=>{
          m.clear();
          for(let c of n.next) {
            m.add(c.func.val);
          }
        },
        val: out
      };
    }
  };
  Op.root.func = n=>{
    const out = S.node();
    const m = NodeManager(out);
    return {
      eval: _=>{
        m.clear();
        for(let c of n.next) m.add(c.func.val);
      }
    };
  };

  const g = {};
  function settle(n) {
    n.mx = n.x;
    n.my = n.y;
    n.mr = n.op.r;
    n.parent = null;
    n.grab = false;
    n.grabType = null;
    n.grabEff = 0;
    n.bb = [0,0,0,0];
    n.type = Ty.any;
  }

  // Arity is always satisfied
  // Type checking will always succeed

  g.root = {
    op: Op.root,
    x: 100, y: 0,
    length: 100,
    next: [{
      op: Op.none,
      x: 0, y: 0,
      length: 0,
      next: []
    }]
  };
  settle(g.root);
  settle(g.root.next[0]);
  // TODO: radius (momentary pressure)
  g.collide = (x,y,cb)=>{
    function traverse(nx, ny, p, n) {
      const cx = nx + n.x;
      const cy = ny + n.y;
      const dx = x - cx;
      const dy = y - cy;
      if(n.op != Op.root) {
        let d = Math.sqrt(dx*dx+dy*dy);
        if(d < n.op.r * 1) {
          cb("node", cx, cy, p, n);
          return;
        } else if(-n.length-1 < dx && dx < 0 && Math.abs(dy) < 0.5) {
          cb("edge", cx, cy, p, n);
          return;
        } else if(d < n.op.r * 2) {
          cb("node", cx, cy, p, n);
          return;
        }
      }
      if(n.op == Op.root || n.bb[0] < dx && dx < n.bb[2] && n.bb[1] < dy && dy < n.bb[3]) {
        for(let c of n.next) {
          traverse(cx, cy, n, c);
        }
      }
    }
    traverse(-(100-1), 0, null, g.root);
  };
  g.layout = (n,p,t)=>{
    n.parent = p;
    n.type = t;
    const polym = n.op.type == Ty.any;
    let mods = n.modified ? 1 : 0;
    delete n.modified;
    for(let i=0;i<n.next.length;i++){
      const c = n.next[i];
      mods += g.layout(c, n, polym ? t : n.op.arity[i]);
    }
    n.op.layout(n);
    if(mods > 0) {
      if(!n.func || n.func.name != n.op.name) {
        n.func = n.op.func(n);
        n.func.name = n.op.name;
      }
      n.func.eval();
    }
    if(n.bb[1] > -n.op.r) n.bb[1] = -n.op.r;
    if(n.bb[0] > -n.op.r) n.bb[0] = -n.op.r;
    if(n.bb[3] < +n.op.r) n.bb[3] = +n.op.r;
    n.passed = 0;
    return mods;
  };
  g.layoutAll = _=>{
    const m = g.layout(g.root, null, Ty.sound);
    if(m > 0) L.add(`Mod.${m}`);
  };
  g.insert = (p,n)=>{
    for(let i=0;i<p.next.length;i++) {
      const c = p.next[i];
      if(c == n) {
        const v = {
          op: Op.none,
          x: 0, y: 0,
          length: 0,
          next: []
        };
        const u = {
          op: Op.merge,
          x: n.x, y: n.y,
          length: n.length,
          next: [n, v]
        };
        settle(v);
        settle(u);
        n.x = n.y = n.length = 0;
        n.mx = n.my = 0;
        p.next[i] = u;
        v.modified = true;
        break;
      }
    }
    g.layoutAll();
  };
  // TODO: animation
  g.remove = (p,n)=>{
    if(p.op == Op.merge) {
      let u = null;
      for(let i=0;i<p.next.length;i++) {
        const c = p.next[i];
        if(c == n) {
          u = p.next[1-i];
        }
      }
      // u != null
      u.mx += p.x, u.my += p.y, u.length += p.length;
      for(let i=0;i<p.parent.next.length;i++) {
        const c = p.parent.next[i];
        if(c == p) {
          u.modified = true;
          p.parent.next[i] = u;
        }
      }
    } else {
      for(let i=0;i<p.next.length;i++) {
        const c = p.next[i];
        if(c == n) {
          const v = {
            op: Op.none,
            x: n.x, y: n.y,
            length: 0,
            next: []
          };
          settle(v);
          v.mr = n.mr;
          v.modified = true;
          p.next[i] = v;
        }
      }
    }
    g.layoutAll();
  };
  g.setOp = (n,op)=>{
    // n.op == Op.none || n.op == Op.some
    n.op = op;
    n.next = [];
    for(let i=0;i<op.arity.length;i++) {
      const v = {
        op: Op.none,
        x: 0, y: 0,
        length: 0,
        next: []
      };
      settle(v);
      n.next.push(v);
    }
    n.modified = true;
    g.layoutAll();
  };
  g.replace = n=>{
    // n.op == Op.none
    n.op = Op.some;
    g.layoutAll();
  };
  g.revert = n=>{
    // n.op == Op.some
    n.op = Op.none;
    g.layoutAll();
  };

  g.layoutAll();
  g.Op = Op;
  g.Ty = Ty;
  g.instGen = [{
    op: Op.sine,
    icon: "sine"
  },{
    op: Op.sample,
    icon: "load"
  }];
  g.patternGen = [{
    op: Op.rhythm,
    icon: "rhythm"
  }];
  g.soundGen = [{
    op: Op.play,
    icon: "conv"
  }];

  return g;
};
