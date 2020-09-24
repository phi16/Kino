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
        n.bb = [-u,-u,u+0.25,u];
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
  function addRhythm(i, r, o, cb) {
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
        if(nt) {
          if(nt.dyn) {
            nt.dyn.forEach(ut=>{
              const u = i(ut.f, S.X.currentTime);
              const g = S.X.createGain();
              g.gain.value = 0;
              u.connect(g).connect(o);
              ut.consume(g);
            });
            cb(1.0);
          } else if(nt.t - t < 0.25) {
            const u = i(nt.f, nt.t);
            const g = S.X.createGain();
            u.connect(g).connect(o);
            waitingNode = g;
            setTimeout(_=>{
              g.disconnect();
            },1000); // TODO
            lastTime = nt.t + 0.001;
            setTimeout(_=>{
              cb(1.0);
            },1000*(nt.t-S.X.currentTime));
          }
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

  let recording = false;
  let recordFirst = null, recordLast = null;
  let bpmMeasured = false;
  let firstBeat = null, bpm = null;
  function* BPMEstimator() {
    const st = yield;
    if(!st) return;
    let ft = -1;
    let count = 0;
    let c = null;
    while(c = yield) {
      ft = c;
      count++;
    }
    if(count == 0) return; // and recording failed
    const spb = (ft-st) / count;
    const baseBPM = 60 / spb;
    const adjustedBPM = Math.pow(2, ((Math.log2(baseBPM/80) % 1) + 1) % 1) * 80; // 80 ~ 160
    firstBeat = st;
    bpm = Math.round(adjustedBPM*10)/10;
    L.add(`BPM: ${bpm}`);
    bpmMeasured = true;
  }
  let estimator = null;

  const rhythmNodes = {};
  function rhythmNote(i) {
    if(!rhythmNodes[i]) return { attack: _=>_, release: _=>_ };
    if(recording && estimator && i == 0) estimator.next(S.X.currentTime);
    return rhythmNodes[i].func.note();
  }

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
    const sounds = [
      "BDM_Indie_11_Conga.wav",
      "SONNY_D_kick_07.wav",
      "SampleMagic_tr808_conga_03.wav",
      "ETFW_percussion_bongo.wav",
      "BOI1DA_snare_07.wav",
      "CHAD_HUGO_conga_one_shot_pole_monster.wav",
      "JAY_DEE_vol_01_kit_12_clap.wav",
      "Kick_Clicky.wav",
      "PMET_Hi_Hat_02.wav",
      "SONNY_D_kick_05.wav"
    ];
    S.load("./sound/" + sounds[Math.floor(Math.random()*sounds.length)]).then(x=>{
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
    const q = [];
    const schedule = [];
    let scheduleDur = -1;
    let recordedNotes = [];
    return {
      eval: _=>_,
      dur: _=>scheduleDur,
      note: _=>{
        let g = null;
        let curVal = 0, curExp = 1, curState = "wait";
        const envelope = [];
        const u = {
          f: 440*Math.pow(2/3,Math.floor(Math.random()*5)),
          attack: (v,e)=>{
            const t = S.X.currentTime;
            if(g) g.gain.setTargetAtTime(v, t, e);
            else curVal = v, curExp = e, curState = "prepare";
            envelope.push({ t, v, e });
          },
          release: e=>{
            const t = S.X.currentTime;
            curVal = 0, curExp = e;
            if(g) g.gain.setTargetAtTime(0, t, e);
            else curState = "done";
            envelope.push({ t, v: 0, e });
            setTimeout(_=>{
              if(g) g.disconnect();
            }, 1000); // TODO
          }
        };
        u.consume = gn=>{
          g = gn;
          if(curState == "prepare") g.gain.setTargetAtTime(curVal, S.X.currentTime, curExp);
          if(curState == "done") g.disconnect(); // TODO ?
          let i = q.indexOf(u);
          if(i >= 0) q.splice(i,1);
        };
        q.push(u);
        if(recording) recordedNotes.push({ envelope });
        return u;
      },
      record: _=>{
        recordedNotes = [];
      },
      stop: _=>{
        if(bpm == null || recordFirst == null || recordedNotes.length == 0) return;
        const durBeats = (recordLast - recordFirst) * (bpm / 60);
        // TODO: adjust
        const estiBeats = Math.pow(2, Math.round(Math.max(Math.log2(durBeats), -2)));
        if(scheduleDur < 0) {
          // first recording
          scheduleDur = estiBeats;
        } else while(scheduleDur < estiBeats) {
          // extend
          let l = schedule.length;
          for(let i=0;i<l;i++) {
            const s = schedule[i];
            schedule.push({
              t: s.t + scheduleDur,
              e: s.e
            });
          }
          scheduleDur *= 2;
        }
        for(let rn of recordedNotes) {
          if(rn.envelope.length == 0) return;
          const st = rn.envelope[0].t;
          const e = [];
          for(let r of rn.envelope) {
            e.push({ t: r.t - st, v: r.v, e: r.e });
          }
          const t = Math.round((st - firstBeat) * (bpm / 60) * 4) / 4 % scheduleDur;
          // TODO: insert to correct position
          schedule.push({ t, e });
        }
        recordedNotes = [];
      },
      val: t=>{
        if(q.length > 0) return { t: 0, dyn: [].concat(q) };
        if(schedule.length > 0) {
          // TODO: looks buggy
          const wt = (t - firstBeat) * (bpm / 60);
          let st = Math.floor(wt / scheduleDur) * scheduleDur;
          let bt = wt - st;
          let nextEvent = null;
          // TODO: binary search
          for(let s of schedule) {
            if(bt <= s.t) {
              if(nextEvent == null || s.t < nextEvent.t) nextEvent = s;
            }
          }
          if(nextEvent == null) {
            // Get the first event
            bt = 0;
            st += scheduleDur;
            for(let s of schedule) {
              if(bt <= s.t) {
                if(nextEvent == null || s.t < nextEvent.t) nextEvent = s;
              }
            }
          }
          return { t: firstBeat + (st + nextEvent.t) / (bpm / 60), f: 880*Math.pow(2/3,Math.floor(Math.random()*5)) };
        }
        return null;
      }
    };
  };
  Op.play.func = n=>{
    const out = S.X.createGain();
    let rh = null;
    return {
      level: 0,
      eval: _=>{
        removeRhythm(rh);
        if(n.next[0].func && n.next[0].func.val && n.next[1].func && n.next[1].func.val) {
          rh = addRhythm(n.next[0].func.val, n.next[1].func.val, out, v=>{
            if(n.func.level < v) n.func.level = v;
          });
        }
      },
      val: out,
      remove: _=>{
        removeRhythm(rh);
      }
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
              if(ce && (me == null || !me.dyn && (ce.dyn || ce.t < me.t))) me = ce;
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
        const d = Math.sqrt(dx*dx+dy*dy);
        const bias = n.op == Op.none ? 0.5 : 0;
        if(d < n.op.r * 1) {
          cb("node", cx, cy, p, n);
          return;
        } else if(-n.length-1 < dx && dx < bias && Math.abs(dy) < 0.5) {
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
    // if(m > 0) L.add(`Mod.${m}`);
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
            length: n.length,
            next: []
          };
          settle(v);
          v.mr = n.mr;
          v.modified = true;
          p.next[i] = v;
        }
      }
    }
    function recur(n) {
      if(n.func.remove) n.func.remove();
      Object.keys(rhythmNodes).forEach(k=>{
        if(rhythmNodes[k] == n) delete rhythmNodes[k];
      });
      for(let c of n.next) {
        recur(c);
      }
    }
    recur(n);
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

  g.switchRhythm = (i,n)=>{
    if(rhythmNodes[i] === n) {
      delete rhythmNodes[i];
      return false;
    }
    rhythmNodes[i] = n;
    return true;
  };
  g.recording = _=>recording;
  g.note = i=>{
    if(recording && !recordFirst) recordFirst = S.X.currentTime;
    return rhythmNote(i);
  };
  g.rhythmNode = i=>{
    return rhythmNodes[i];
  };
  g.record = _=>{
    recording = true;
    if(!bpmMeasured) {
      estimator = BPMEstimator();
      estimator.next();
    }
    Object.keys(rhythmNodes).forEach(i=>{
      rhythmNodes[i].func.record();
    });
    recordFirst = recordLast = null;
  };
  g.stop = _=>{
    recording = false;
    recordLast = S.X.currentTime;
    if(estimator) estimator.next(false);
    Object.keys(rhythmNodes).forEach(i=>{
      rhythmNodes[i].func.stop();
    });
    recordFirst = recordLast = null;
  };
  g.beatIndex = _=>{
    if(bpm == null) return null;
    return (S.X.currentTime - firstBeat) * (bpm / 60);
  };

  return g;
};
