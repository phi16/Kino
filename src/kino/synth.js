module.exports = (o)=>{
  const G = o.render.gl;
  const S = o.sound;
  const I = o.input;
  const out = S.node();
  const samples = 2048;

  const amebient = "";
  const raws = [
    "AmebientSamplePack/Oneshot/bell_a.wav",
    "AmebientSamplePack/SE/draft_normal.wav",
    "AmebientSamplePack/SE/thunder_normal.wav",
    "TA_MK_STAB_9_A.wav",
    "BKAYE_brass_pad_G.wav",
    "glsl_inst0.wav",
    "glsl_dist.wav",
  ];
  const audioBuffer = G.DataBuffer(2048,1024);
  for(let i=0;i<raws.length;i++) {
    let j = i;
    S.load("sound/" + raws[j]).then(b=>{
      audioBuffer.set(j*128+0,  b.getChannelData(0));
      audioBuffer.set(j*128+64, b.getChannelData(1));
    });
  }

  let lastX = 0.;
  I.onTouch(function*(){
    while(true) {
      let c = yield;
      lastX = c.x*0.01;
    }
  });

  function create() {
    const n = S.X.createScriptProcessor(samples, 0, 2);
    const loopBuffer = G.DataLoopBuffer(samples/4, 4);
    n.onaudioprocess = e=>{
      loopBuffer.render(_=>{
        G.granular.tex(loopBuffer.use());
        G.granular.samples(samples);
        G.granular.offset(lastX);
        G.granular.offsetRandom(0.5);
        G.granular.grainDur(1.0);
        G.granular.playbackRate(1.0);
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
  create();

  return { audioBuffer };
};
