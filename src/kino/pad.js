module.exports = (o,G)=>{
  const R = o.render;
  const I = o.input;
  const L = o.log;

  const Icons = {
    none: _=>{ return R.shape(_=>_); },
    circle: _=>{
      return R.shape(_=>{
        R.X.arc(0,0,0.85,0,Math.PI*2);
      });
    },
    empty: _=>{
      return R.shape(_=>{
        const a = 1;
        R.X.arc(0,0,0.85,Math.PI*2-a,Math.PI+a);
      });
    },
    occupied: _=>{
      return R.shape(_=>{
        const a = 0.5;
        R.X.arc(0,0,0.85,Math.PI*2-a,Math.PI+a);
        R.X.moveTo(0,0);
        R.X.lineTo(0,-0.9);
      });
    },
    bypass: _=>{
      return R.shape(_=>{
        const a = 0.5, b = Math.PI;
        R.X.arc(0,0,0.85,a+b,Math.PI*2-a+b);
      });
    },
    inject: _=>{
      return R.shape(_=>{
        R.X.moveTo(0,0);
        R.X.lineTo(0,0.8);
        R.X.moveTo(-0.8,-0.8);
        R.X.quadraticCurveTo(0,0.6,0.8,-0.8);
      });
    },
    delete: _=>{
      return R.shape(_=>{
        R.X.moveTo(0,-0.9);
        R.X.arc(0,0.3,0.6,-Math.PI/2,Math.PI);
      });
    },
    mute: _=>{
      return R.shape(_=>{
        R.X.moveTo(-0.8,0.75);
        R.X.lineTo(0.8,0.75);
        R.X.moveTo(0,0.75);
        R.X.lineTo(0,-0.75);
      });
    },
    select: _=>{
      return R.shape(_=>{
        R.X.moveTo(-1.2,0);
        R.X.lineTo(0,0);
        R.X.moveTo(0.8,0);
        R.X.arc(0,0,0.8,0,Math.PI*2);
      });
    },
    create: _=>{
      return R.shape(_=>{
        R.X.moveTo(-1.2,0);
        R.X.lineTo(-0.8,0);
        R.X.moveTo(0.8,0);
        R.X.arc(0,0,0.8,0,Math.PI*2);
      });
    },
    sine: _=>{
      return R.shape(_=>{
        R.X.moveTo(-0.8,0.8);
        R.X.lineTo(-0.8,0);
        R.X.arc(0,0,0.8,Math.PI,0);
      });
    },
    load: _=>{
      return R.shape(_=>{
        R.X.moveTo(-0.4,-0.8);
        R.X.lineTo(1,0);
        R.X.lineTo(-0.4,0.8);
        R.X.moveTo(-0.9,0);
        R.X.lineTo(-0.2,0);
      });
    },
    rhythm: _=>{
      return R.shape(_=>{
        const u = 0.9;
        R.X.moveTo(-u,0);
        R.X.lineTo(0,u);
        R.X.lineTo(u,0);
        R.X.lineTo(0,-u);
        R.X.lineTo(-u,0);
      });
    },
    conv: _=>{
      return R.shape(_=>{
        R.X.moveTo(0,-0.9);
        R.X.lineTo(0,0.9);
        R.X.moveTo(-0.8,-0.4);
        R.X.lineTo(0.8,0.4);
        R.X.moveTo(-0.8,+0.4);
        R.X.lineTo(0.8,-0.4);
      });
    },
    record: _=>{
      return R.shape(_=>{
        R.X.arc(0,0,0.85,0,Math.PI*2);
        R.X.moveTo(0,0);
        R.X.arc(0,0,0.05,0,Math.PI*2);
      });
    },
    stop: _=>{
      return R.shape(_=>{
        const a = 0.8;
        R.X.moveTo(-a,-a);
        R.X.lineTo(+a,-a);
        R.X.lineTo(+a,+a);
        R.X.lineTo(-a,+a);
        R.X.lineTo(-a,-a);
        R.X.moveTo(0,0);
        R.X.arc(0,0,0.05,0,Math.PI*2);
      });
    }
  };
  G.instGen.forEach(g=>{
    g.icon = Icons[g.icon];
  });
  G.patternGen.forEach(g=>{
    g.icon = Icons[g.icon];
  });
  G.soundGen.forEach(g=>{
    g.icon = Icons[g.icon];
  });

  const padIcons = [];
  for(let i=0;i<16;i++) padIcons.push({ cur: Icons.none, prev: Icons.none, time: 0.5 });
  function SetHandler(h){
    padHandler = h;
    for(let i=0;i<16;i++) {
      const ni = h.icon(i);
      if(ni == padIcons[i].cur) continue;
      if(padIcons[i].time > 0.5) padIcons[i].prev = padIcons[i].cur;
      padIcons[i].cur = ni;
      padIcons[i].time = 0;
    }
  };

  let selection = null;
  const Handler = {
    basic: {
      icon: i=>{
        // For Debug
        // const v = Object.keys(Icons);
        // if(i < v.length) return Icons[v[i]];
        if(i == 0) return G.recording() ? Icons.stop : Icons.record;
        if(i >= 8) return G.rhythmNode(i-8) ? Icons.circle : Icons.none;
        return Icons.none;
      }
    },
    node: {
      icon: i=>{
        if(selection && selection.op == G.Op.rhythm) {
          if(i >= 8) {
            const r = G.rhythmNode(i-8);
            if(r == selection) return Icons.occupied;
            return r ? Icons.circle : Icons.empty;
          }
        }
        if(i == 0) return Icons.bypass;
        return Icons.none;
      }
    },
    edge: {
      icon: i=>{
        if(i == 0) return Icons.inject;
        if(i == 1) return Icons.delete;
        return Icons.none;
      }
    },
    leaf: {
      icon: i=>{
        if(i == 0) {
          if(selection && selection.type == G.Ty.inst) return Icons.select;
          return Icons.create;
        }
        return Icons.none;
      }
    },
    "create-inst": {
      icon: i=>{
        if(i < G.instGen.length) return G.instGen[i].icon;
        return Icons.none;
      }
    },
    "create-pattern": {
      icon: i=>{
        if(i < G.patternGen.length) return G.patternGen[i].icon;
        return Icons.none;
      }
    },
    "create-sound": {
      icon: i=>{
        if(i < G.soundGen.length) return G.soundGen[i].icon;
        return Icons.none;
      }
    }
  };
  Object.keys(Handler).forEach(h=>{
    Handler[h].name = h;
  });
  let padHandler = Handler.basic;
  SetHandler(padHandler);

  const p = {};
  p.setHandler = (n,s)=>{
    selection = s; // may null
    SetHandler(Handler[n]);
  };
  p.handler = k=>{
    const i = Math.floor(k/2) + (k%2) * 8;
    return { name: padHandler.name, i: i };
  };
  p.icon = (k,v)=>{
    const i = Math.floor(k/2) + (k%2) * 8;
    let pt = padIcons[i].time;
    pt += 0.08;
    if(pt > 1) pt = 1;
    padIcons[i].time = pt;
    if(pt < 0.5) {
      let s = pt*2;
      R.scale(1-Math.pow(s,2)).with(_=>{
        padIcons[i].prev().stroke(0,0,v*0.2+0.3,0.25*v+0.25);
      });
    } else {
      let s = pt*2 - 1;
      R.scale(1-Math.pow(1-s,2)).with(_=>{
        padIcons[i].cur().stroke(0,0,v*0.2+0.3,0.25*v+0.25);
      });
    }
  };
  return p;
};
