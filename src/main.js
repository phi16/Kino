let R = null, G = null, I = null, L = null, S = null;

let a = 0;
function render() {
  a += 0.1;
  R.translate(R.width/2, R.height/2).with(_=>{
    R.scale(Math.min(R.width/I.width, R.height/I.height)*0.9).with(_=>{
      R.rect(-I.width/2, -I.height/2, I.width, I.height).fill(1,0,0.1);
      R.circle(Math.cos(a)*100,Math.sin(a)*100,100).fill(0.7,1,1);
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
    //
  });
  I.onPad(function*(k,v){
    console.log(`${k},${v}`);
    yield;
    console.log(k);
  });
  L.add("Launched.");
  setTimeout(_=>{
    I.onError(m=>{
      L.add(m);
    });
  },250);
};
