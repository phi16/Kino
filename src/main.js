let R = null, G = null, I = null, L = null, S = null;

const padVisual = Array(16).fill(0), padTarget = Array(16).fill(0);
function render() {
  const pad = 5, frame = 7, rect = (I.width-pad*7)/8;
  const mainW = I.width + frame*2, mainH = I.height + (pad+rect+frame)*2;
  R.translate(R.width/2, R.height/2).with(_=>{
    R.scale(Math.min(R.width/mainW, R.height/mainH)).translate(-mainW/2+frame, -mainH/2+frame).with(_=>{
      for(let i=0;i<8;i++) {
        for(let j=0;j<2;j++) {
          R.translate(i*(rect+pad)+rect/2, j*(mainH-frame*2-rect)+rect/2).with(_=>{
            let k = i*2+1-j;
            padVisual[k] += (padTarget[k] - padVisual[k]) / 2.0;
            let s = padVisual[k] * rect;
            if(s > 1.0) R.rect(-s/2, -s/2, s, s).stroke(1,0,0.2,0.5);
            R.rect(-rect/2, -rect/2, rect, rect).stroke(1,0,0.3,0.5);
          });
        }
      }
      R.translate(0, rect+pad).with(_=>{
        for(let id in I.touches) {
          let c;
          c = I.touches[id];
          p = 1 - Math.exp(-c.force*0.002);
          R.ellipse(c.x, c.y, c.minor_axis*p, c.major_axis*p, c.orientation*Math.PI/180).stroke(1,0,0.2,0.5);
        }
        R.rect(0, 0, I.width, I.height).stroke(1,0,0.3,0.5);
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

module.exports = o=>{
  R = o.render;
  G = o.render.gl;
  I = o.input;
  L = o.log;
  S = o.sound;

  R.onRender(render);
  R.onEffect(effect);
  I.onTouch(function*(){
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
