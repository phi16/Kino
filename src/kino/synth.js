module.exports = (o)=>{
  const G = o.render.gl;
  const S = o.sound;
  const I = o.input;
  const out = S.node();
  const samples = 2048;
  const loopBuffer = G.DataLoopBuffer(samples/4, 4);

  let lastX = 0.;
  let targetX = 0.;
  I.onTouch(function*(){
    while(true) {
      let c = yield;
      targetX = c.x*0.004;
    }
  });

  const n = S.X.createScriptProcessor(samples, 0, 2);
  n.onaudioprocess = e=>{
    loopBuffer.render(_=>{
      G.granular.texture(loopBuffer.use());
      G.granular.samples(samples);
      G.granular.frequency(40);
      G.granular.window(0.5);
      G.granular.offset(lastX, targetX);
      G.granular();
    });
    lastX = targetX;
    const b = loopBuffer.pixels(2);
    const c0 = e.outputBuffer.getChannelData(0);
    const c1 = e.outputBuffer.getChannelData(1);
    c0.set(b.subarray(0, samples));
    c1.set(b.subarray(samples, samples*2));
  };
  n.connect(out);

  return {};
};
