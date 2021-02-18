const Kino = {};

Kino.I = require('./src/input');
Kino.L = require('./src/log');
Kino.S = require('./src/sound');
Kino.C = require('./src/rtc.js');
Kino.container = c=>{
  const ui = document.createElement("canvas");
  const gl = document.createElement("canvas");
  c.appendChild(gl);
  Kino.uiCanvas = ui;
  const R = require('./src/canvas')(ui);
  const G = require('./src/gl')(gl);
  const uiBuffer = G.RenderBuffer();
  Kino.resize = _=>{
    let w = container.clientWidth;
    let h = container.clientHeight;
    ui.width = gl.width = w;
    ui.height = gl.height = h;
    R.resize(w,h);
    G.resize(w,h);
    uiBuffer.resize(w,h);
  };
  Kino.resize();

  let uiRender = _=>_;
  let glRender = _=>_;
  Kino.uiRender = f=>{ uiRender = f; };
  Kino.glRender = f=>{ glRender = f; };

  function render() {
    const st = new Date();
    uiRender();
    Kino.L.render(R);
    uiBuffer.copyCanvas(ui);
    glRender(uiBuffer);
    const et = new Date();
    Kino.L.prop(1, "render: " + (et - st) + "ms");
    Kino.L.prop(0, "comp: " + Math.floor(Kino.S.reduction()*100+0.5)/100 + "dB");
    requestAnimationFrame(render);
  }
  render();

  Kino.R = R;
  Kino.G = G;
  Kino.activateSynth = _=>{
    Kino.Y = require('./src/synth')(Kino);
  };
};

module.exports = Kino;
