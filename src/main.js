module.exports = o=>{
  const R = o.render;
  const G = o.render.gl;
  const I = o.input;
  const L = o.log;
  const S = o.sound;

  const graph = require('./kino/graph.js')();
  const M = {
    pad: 5,
    frame: 7,
    multScale: 20,
  };
  M.rect = (I.width-M.pad*7)/8;
  M.cell = M.rect+M.pad;
  M.mainW = I.width + M.frame*2;
  M.mainH = I.height + (M.pad+M.rect+M.frame)*2;
  M.offsetX = -M.mainW/2+M.frame;
  M.offsetY = -M.mainH/2+M.frame;
  M.centerY = M.mainH/2-M.frame;
  M.touchScale = 1/M.multScale;
  R.resizeCallback = _=>{
    M.scale = Math.min(R.width/M.mainW, R.height/M.mainH);
  };
  R.resizeCallback();


  const effects = [];
  function addEffect(dur,cb){
    effects.push({ dur, cb });
  };

  const padVisual = Array(16).fill(0), padTarget = Array(16).fill(0);
  let prevTime = new Date();
  function render() {
    const curTime = new Date();
    const dt = (curTime - prevTime) / 1000;
    prevTime = curTime;
    R.translate(R.width/2, R.height/2).with(_=>{
      R.scale(M.scale).translate(M.offsetX,M.offsetY).with(_=>{
        const curvedLine = (x0, y0, x1, y1, ru)=>R.shape(X=>{
          let xv = x0, yv = y0;
          let dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
          if(dx < dy) {
            xv = x1, yv += dx * Math.sign(y1-y0);
          } else {
            xv += dy * Math.sign(x1-x0), yv = y1;
          }

          // (x0,y0) - (xv,yv) - (x1,y1)
          const eps = 0.0001;
          let tx0 = xv-x0, ty0 = yv-y0, tl0 = Math.sqrt(tx0*tx0+ty0*ty0);
          if(tl0 < eps) tx0 = 1, ty0 = 0;
          else tx0 /= tl0, ty0 /= tl0;
          let tx1 = x1-xv, ty1 = y1-yv, tl1 = Math.sqrt(tx1*tx1+ty1*ty1);
          if(tl1 < eps) tx1 = 1, ty1 = 0;
          else tx1 /= tl1, ty1 /= tl1;

          const rm = Math.min(ru, Math.min(tl0,tl1));
          X.moveTo(x0, y0);
          X.lineTo(xv-tx0*rm,yv-ty0*rm);
          X.quadraticCurveTo(xv, yv, xv+tx1*rm, yv+ty1*rm);
          X.lineTo(x1, y1);
        });
        R.translate(0,M.centerY).with(_=>{
          const s = M.multScale, cr = 5;
          function d(x,y,passed,n) {
            let md = 0;
            if(passed > 0.05) {
              n.mx += (n.x - n.mx) / 4.0;
              n.my += (n.y - n.my) / 4.0;
              n.passed += dt;
            }
            // (x,y) -> (cx, cy)
            const cx = x + n.mx*s, cy = y + n.my*s;
            curvedLine(x, y, cx, cy, cr).stroke(1,0,0.7,2);
            for(let t of n.next) {
              d(cx, cy, n.passed, t);
            }
            if(n.op.r > 0.001) R.circle(cx, cy, n.op.r*s).fill(0,0,0).stroke(1,0,0.7,2);
            // if(n.bb) R.rect(cx+n.bb[0]*s, cy+n.bb[1]*s, (n.bb[2]-n.bb[0])*s, (n.bb[3]-n.bb[1])*s).stroke(1,0,0.5,0.5);
          }
          d(-(10-1)*s, 0, 1, graph.root);
          R.blend("lighter",_=>{
            for(let i=0;i<effects.length;i++) {
              const e = effects[i];
              e.cb(e.dur);
              e.dur -= dt;
              if(e.dur < 0) {
                effects.splice(i,1);
                i--;
              }
            }
          });
        });

        // Input Overlay
        R.blend("lighter",_=>{
          for(let i=0;i<8;i++) {
            for(let j=0;j<2;j++) {
              R.translate(i*M.cell+M.rect/2, j*(M.mainH-M.frame*2-M.rect)+M.rect/2).with(_=>{
                let k = i*2+1-j;
                padVisual[k] += (padTarget[k] - padVisual[k]) / 2.0;
                let s = padVisual[k] * M.rect;
                if(s > 1.0) R.rect(-s/2, -s/2, s, s).stroke(1,0,0.2,0.5);
                R.rect(-M.rect/2, -M.rect/2, M.rect, M.rect).stroke(1,0,0.3,0.5);
              });
            }
          }
          R.translate(0, M.cell).with(_=>{
            for(let id in I.touches) {
              let c = I.touches[id];
              p = 1 - Math.exp(-c.force*0.002);
              R.ellipse(c.x, c.y, c.minor_axis*p, c.major_axis*p, c.orientation*Math.PI/180).stroke(1,0,0.2,0.5);
            }
            R.rect(0, 0, I.width, I.height).stroke(1,0,0.3,0.5);
          });
        });
      });
    });
  }

  function* effect() {
    const mainBuffer = G.LoopBuffer();
    const bloomBuffer = G.LoopBuffer();
    while(yield) {
      mainBuffer.render(_=>{
        G.cloneFlip.texture(G.front.use());
        G.cloneFlip();
      });
      bloomBuffer.render(_=>{
        G.color.color(0,0,0);
        G.color();
      });
      for(let i=0;i<8;i++) {
        bloomBuffer.render(_=>{
          G.additive.self(bloomBuffer.use());
          G.additive.texture(mainBuffer.use());
          G.additive.pixelRes(R.width, R.height);
          G.additive.scale(Math.pow(2,-i));
          G.additive();
        });
        mainBuffer.render(_=>{
          G.minimize.texture(mainBuffer.use());
          G.minimize.pixelRes(R.width, R.height);
          G.minimize();
        });
      }
      G.postprocess.overlay(G.front.use());
      G.postprocess.texture(bloomBuffer.use());
      G.postprocess();
    }
  }

  R.onRender(render);
  R.onEffect(effect);

  I.onTouch(function*(){
    const c = yield;
    console.log(c);
    const cx = c.x * M.touchScale;
    const cy = (c.y-I.height/2) * M.touchScale;
    let type = null, node = null;
    graph.collide(cx, cy, (t,x,y,n)=>{
      type = t;
      node = n;
      if(t == "node") {
        addEffect(0.5, d=>{
          const rd = (0.5 - d) * 1.5;
          R.circle(x*M.multScale, y*M.multScale, (n.op.r+rd)*M.multScale).stroke(1,0,0.5*d,16*d*d);
        });
      } else {
        const wi = n.length + 1;
        addEffect(0.5, d=>{
          const rd = (0.5 - d) * 1.5;
          R.line(
            (x-n.op.r-Math.pow(rd,3)*wi)*M.multScale, y*M.multScale,
            (x-n.op.r-Math.pow(rd,0.5)*wi)*M.multScale, y*M.multScale
          ).stroke(1,0,0.5*Math.sqrt(d),8*Math.sqrt(d));
        });
      }
    });
    if(type == "edge") {
      const nx = node.x - node.length;
      const nl = node.length;
      while(true) {
        const cm = yield;
        if(cm.state == I.state.END) break;
        const cd = (cm.x - c.x) * M.touchScale * 2;
        node.length = Math.max(0, Math.floor(nl + cd + 0.5));
        node.x = nx + node.length;
      }
      graph.layout(graph.root);
    }
  });
  I.onPad(function*(k,v){
    padTarget[k] = v*0.5+0.5;
    yield;
    padTarget[k] = 0;
  });

  L.add("Launched.");
  setTimeout(_=>{
    I.onError(m=>{
      L.add(m);
    });
  },250);
};
