module.exports = (o)=>{
  const G = o.render.gl;
  const S = o.sound;
  const I = o.input;
  const out = S.node();
  const samples = 2048;

  const audioBuffer = G.DataBuffer(2048,1024);
  S.load("sound/AmebientSamplePack/Oneshot/bell_a.wav").then(b=>{
    audioBuffer.set(0,  b.getChannelData(0));
    audioBuffer.set(64, b.getChannelData(1));
  })

  let lastX = 0.;
  I.onTouch(function*(){
    while(true) {
      let c = yield;
      lastX = c.x*0.01;
    }
  });

  function create(grainDur) {
    const n = S.X.createScriptProcessor(samples, 0, 2);
    const loopBuffer = G.DataLoopBuffer(samples/4, 4);
    n.onaudioprocess = e=>{
      loopBuffer.render(_=>{
        G.granular.tex(loopBuffer.use());
        G.granular.samples(samples);
        G.granular.grainDur(grainDur);
        G.granular.offset(lastX);
        G.granular.random(Math.random(), Math.random());
        G.granular.audio(audioBuffer.use());
        G.granular();
      });
      const b = loopBuffer.pixels(2);
      const c0 = e.outputBuffer.getChannelData(0);
      const c1 = e.outputBuffer.getChannelData(1);
      c0.set(b.subarray(0, samples));
      c1.set(b.subarray(samples, samples*2));
    };
    const lpf = S.X.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 10000.0;
    const hpf = S.X.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 20.0;
    n.connect(lpf).connect(hpf).connect(out);
  }
  create(0.4);

  return {};
};
