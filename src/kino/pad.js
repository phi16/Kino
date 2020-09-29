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
    close: _=>{
      return R.shape(_=>{
        R.X.arc(0,0,0.8,0,Math.PI*2);
        R.X.moveTo(0,-1.1);
        R.X.lineTo(0,-0.8);
        R.X.moveTo(0,0.8);
        R.X.lineTo(0,1.1);
      });
    },
    open: _=>{
      return R.shape(_=>{
        for(let i=0;i<4;i++) {
          const x = Math.cos(i*2*Math.PI/4);
          const y = Math.sin(i*2*Math.PI/4);
          R.X.moveTo(x*0.6,y*0.6);
          R.X.lineTo(x*1.1,y*1.1);
        }
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
    fm: _=>{
      return R.shape(_=>{
        R.X.moveTo(-0.3,0.9);
        R.X.arc(0.3,-0.3,0.6,Math.PI,Math.PI/2);
        R.X.lineTo(-0.9,0.3);
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

  const padIcons = [];
  for(let i=0;i<16;i++) padIcons.push({ cur: Icons.none, prev: Icons.none, time: 0.5 });

  const padHandler = Array(16);
  padHandler.fill(function*(){});

  const p = {};
  p.set = h=>{
    for(let i=0;i<16;i++) {
      let ni = Icons.none;
      padHandler[i] = function*(){};
      h(i,(n,a)=>{
        ni = Icons[n];
        padHandler[i] = a;
      });
      if(ni == padIcons[i].cur) continue;
      if(padIcons[i].time > 0.5) padIcons[i].prev = padIcons[i].cur;
      padIcons[i].cur = ni;
      padIcons[i].time = 0;
    }
  };
  const padVisual = Array(16).fill(0), padTarget = Array(16).fill(0);
  p.icon = k=>{
    padVisual[k] += (padTarget[k] - padVisual[k]) / 2.0;
    const v = padVisual[k];
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
  p.sizeAt = k=>{
    return padVisual[k];
  };

  I.onPad(function*(k,v){
    padTarget[k] = v*0.5+0.5;
    const i = Math.floor(k/2) + (k%2) * 8;
    const g = padHandler[i](v);
    g.next();
    yield;
    g.next();
    padTarget[k] = 0;
  });

  return p;
};
