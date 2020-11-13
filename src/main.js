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

  const Keyboard = require('./kino/keyboard.js')(o);
  Keyboard.open(1);

  const M = {
    pad: 0,
    frame: 5,
    multScale: 20,
  };
  M.rect = 0;
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

  let prevTime = new Date();
  function render() {
    const curTime = new Date();
    const dt = (curTime - prevTime) / 1000;
    prevTime = curTime;
    R.translate(R.width/2, R.height/2).with(_=>{
      R.scale(M.scale).translate(M.offsetX,M.offsetY).with(_=>{
        R.translate(0, M.cell).with(_=>{
          Keyboard.render(dt);
        });

        // Input Overlay
        R.blend("lighter",_=>{
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
    const miniBuffer = G.LoopBuffer();
    const bloomBuffer = G.LoopBuffer();
    while(yield) {
      mainBuffer.render(_=>{
        G.blend.texture(G.front.use());
        G.blend.original(mainBuffer.use());
        G.blend();
      });
      miniBuffer.render(_=>{
        G.clone.texture(mainBuffer.use());
        G.clone();
      });
      bloomBuffer.render(_=>{
        G.color.color(0,0,0);
        G.color();
      });
      for(let i=0;i<8;i++) {
        bloomBuffer.render(_=>{
          G.additive.self(bloomBuffer.use());
          G.additive.texture(miniBuffer.use());
          G.additive.pixelRes(R.width, R.height);
          G.additive.scale(Math.pow(2,-i));
          G.additive();
        });
        miniBuffer.render(_=>{
          G.minimize.texture(miniBuffer.use());
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

  L.add("Launched.");
  setTimeout(_=>{
    I.onError(m=>{
      L.add(m);
    });
  },250);
};
