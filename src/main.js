module.exports = o=>{
  const R = o.render;
  const G = o.render.gl;
  const I = o.input;
  const L = o.log;
  const S = o.sound;

  let scroll = {
    grab: null,
    x: 0, y: 0,
    mx: 0, my: 0
  };
  let selection = null, selectionParent = null;
  let selectionType = null;

  const Graph = require('./kino/graph.js')(o);
  const Pad = require('./kino/pad.js')(o, Graph);

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
    I.domain(
      R.width/2+M.scale*M.offsetX,
      R.height/2+M.scale*(M.offsetY+M.cell),
      I.width, I.height, M.scale);
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
        const scrX = scroll.x > 0 ? (1 - Math.exp(-scroll.x/M.multScale))*M.multScale : scroll.x;
        scroll.mx += (scrX - scroll.mx) / 8.0;
        scroll.my += (scroll.y - scroll.my) / 8.0;
        // TODO: display level position
        R.translate(scroll.mx, scroll.my+M.centerY).with(_=>{
          const s = M.multScale, cr = 5;
          function d(x,y,passed,parent,n) {
            let md = 0;
            if(passed > 0.05) {
              n.mx += (n.x - n.mx) / 4.0;
              n.my += (n.y - n.my) / 4.0;
              n.mr += (n.op.r - n.mr) / 4.0;
              n.passed += dt;
            }
            if(n.grab) n.grabEff += (1 - n.grabEff) / 2.0;
            else n.grabEff += (0 - n.grabEff) / 8.0;
            // (x,y) -> (cx, cy)
            const cx = x + n.mx*s, cy = y + n.my*s;
            const selVal = selection == n ? 0.4 : 0.2;
            if(n.grabType == "edge") {
              R.blend("lighter",_=>{
                let px = x, py = y;
                if(parent == Graph.root) px = -100*M.multScale, py = 0;
                curvedLine(px, py, cx, cy, cr).stroke(1,0,selVal*n.grabEff,5);
              });
            }
            if(n.type == Graph.Ty.inst) {
              R.X.setLineDash([6,3,0,3]);
            } else if(n.type == Graph.Ty.pattern) {
              R.X.setLineDash([0,4]);
            }
            curvedLine(x, y, cx, cy, cr).stroke(1,0,0.7,2);
            R.X.setLineDash([]);
            for(let t of n.next) {
              d(cx, cy, n.passed, n, t);
            }
            if(n.mr > 0.001) {
              const shape = n.op == Graph.Op.rhythm ? R.poly(cx, cy, n.mr*s, 4, 0) : R.circle(cx, cy, n.mr*s);
              if(n.grabType == "node") {
                R.blend("lighter",_=>{
                  shape.fill(0,0,0).stroke(1,0,selVal*n.grabEff,6);
                });
              }
              shape.fill(0,0,0).stroke(1,0,0.7,2);
            }
            // R.rect(cx+n.bb[0]*s, cy+n.bb[1]*s, (n.bb[2]-n.bb[0])*s, (n.bb[3]-n.bb[1])*s).stroke(1,0,0.5,0.5);
          }
          d(-(100-1)*s, 0, 1, null, Graph.root);
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
                R.scale(M.rect/4).with(_=>{
                  Pad.icon(k, padVisual[k]);
                });
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
    let c = yield;
    while(c.force < 50) c = yield;
    const cx = (c.x-scroll.mx) * M.touchScale;
    const cy = (c.y-I.height/2-scroll.my) * M.touchScale;
    let type = null, parent = null, node = null;
    Graph.collide(cx, cy, (t,x,y,p,n)=>{
      if(type != null) return;
      type = t;
      parent = p;
      node = n;
      if(t == "node") {
        L.add(`Op.${n.op.name}`);
        addEffect(0.5, d=>{
          const rd = (0.5 - d) * 1.5;
          R.circle(x*M.multScale, y*M.multScale, (n.op.r+rd)*M.multScale).stroke(1,0,0.5*d,16*d*d);
        });
      } else {
        L.add(`Ty.${n.type.name}`);
        const wi = n.length + 1;
        addEffect(0.5, d=>{
          const rd = (0.5 - d) * 1.5;
          R.line(
            (x-n.op.r-Math.pow(rd,3)*wi)*M.multScale, y*M.multScale,
            (x-n.op.r-Math.pow(rd,0.4)*wi)*M.multScale, y*M.multScale
          ).stroke(1,0,0.5*Math.sqrt(d),8*Math.sqrt(d));
        });
      }
    });
    if(type == null) {
      // scroll
      while(true) {
        const cm = yield;
        if(cm.state == I.state.END) return;
        const dx = cm.x - c.x;
        const dy = cm.y - c.y;
        if(Math.sqrt(dx*dx+dy*dy) > 5.0) break;
      }
      const capture = {};
      scroll.grab = capture;
      let x = scroll.mx, y = scroll.my;
      while(true) {
        const cm = yield;
        if(scroll.grab != capture) return;
        if(cm.state == I.state.END) break;
        scroll.x = x + (cm.x - c.x) * 2;
        scroll.y = y + (cm.y - c.y) * 2;
      }
      if(scroll.x > 0) scroll.x = 0;
      // TODO: inertia
      return;
    }
    node.grab = true;
    node.grabType = type;
    selection = node;
    selectionParent = parent;
    selectionType = type;
    Pad.setHandler(selection.op == Graph.Op.none ? "leaf" : type, selection);
    if(type == "node") {
      while(true) {
        const cm = yield;
        if(cm.state == I.state.END) break;
      }
    } else {
      const nx = node.x - node.length;
      const nl = node.length;
      while(true) {
        const cm = yield;
        if(cm.state == I.state.END) break;
        const cd = (cm.x - c.x) * M.touchScale * 2;
        if(!node.grab) return;
        node.length = Math.max(0, Math.floor(nl + cd + 0.5));
        node.x = nx + node.length;
      }
      if(node.op == Graph.Op.some) {
        Graph.revert(node);
      }
      Graph.layoutAll();
    }
    node.grab = false;
    if(selection == node) {
      selection = null;
      Pad.setHandler("basic");
    }
  });
  I.onPad(function*(k,v){
    padTarget[k] = v*0.5+0.5;
    const h = Pad.handler(k);
    if(h.name == "basic") {
      if(h.i == 0) {
        if(Graph.recording()) {
          Graph.stop();
          L.add("Stop");
        } else {
          Graph.record();
          L.add("Record");
        }
        Pad.setHandler("basic");
      } else if(h.i >= 8) {
        const m = Graph.note(h.i-8);
        m.attack(1, 0.001);
        yield;
        padTarget[k] = 0;
        m.release(0.1);
        return;
      }
    } else if(h.name == "edge") {
      if(h.i == 0) {
        Graph.insert(selectionParent, selection);
        selection.grab = false;
        selection = null;
        Pad.setHandler("basic");
      } else if(h.i == 1) {
        Graph.remove(selectionParent, selection);
        selection.grab = false;
        selection = null;
        Pad.setHandler("basic");
      }
    } else if(h.name == "leaf") {
      if(h.i == 0) {
        const gen = Graph[selection.type.name + "Gen"];
        if(gen.length == 1) {
          Graph.setOp(selection, gen[0].op);
          selection.grab = false;
          selection = null;
          Pad.setHandler("basic");
        } else {
          Graph.replace(selection);
          Pad.setHandler("create-" + selection.type.name);
        }
      }
    } else if(h.name == "node") {
      if(h.i >= 8) {
        if(selection.op == Graph.Op.rhythm) {
          const b = Graph.switchRhythm(h.i-8, selection);
          if(b) L.add(`Register: #${h.i-8}`);
          else L.add(`Release: #${h.i-8}`);
          Pad.setHandler("node", selection);
        }
      }
      // TODO: bypass (if available)
    } else if(h.name.substr(0,7) == "create-") {
      const gen = h.name == "create-inst" ? Graph.instGen
                : h.name == "create-pattern" ? Graph.patternGen : Graph.soundGen;
      if(h.i < gen.length) {
        Graph.setOp(selection, gen[h.i].op);
      } else {
        Graph.revert(selection);
      }
      selection.grab = false;
      selection = null;
      Pad.setHandler("basic");
    }
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
