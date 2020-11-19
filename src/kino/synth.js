module.exports = (o, outNode)=>{
  const G = o.render.gl;
  const S = o.sound;
  const I = o.input;
  const L = o.log;
  const samples = 2048;
  const unitNotes = 32; // minus 1
  const grains = 8;
  G.synthParams(samples, unitNotes, grains);

  const raws = [
    "AmebientSamplePack/Oneshot/bell_a.wav",
    "AmebientSamplePack/SE/draft_normal.wav",
    "AmebientSamplePack/SE/thunder_normal.wav",
    "BKAYE_brass_pad_G.wav",
    "glsl_inst0.wav",
    "glsl_dist.wav",
    "voice1622.wav",
    "voice1630.wav",
  ];
  const audioBuffer = G.DataBuffer(2048,1024);
  for(let i=0;i<raws.length;i++) {
    const j = i;
    S.load("sound/" + raws[j]).then(b=>{
      audioBuffer.set(j*128+0,  b.getChannelData(0));
      audioBuffer.set(j*128+64, b.getChannelData(1));
    });
  }

  const loopBuffers = [];
  const noteCandidates = [];
  function createSynth() {
    const loopBuffer = G.DataLoopBuffer(samples/4, unitNotes*grains);
    loopBuffer.render(_=>{
      G.color.color(0,0,0,0);
      G.color();
    });
    loopBuffers.push(loopBuffer);
    const n = S.X.createScriptProcessor(samples, 0, 2);
    const notes = new Float32Array(unitNotes*2); // (freq, gain)
    for(let i=0;i<unitNotes;i++) notes[i*2] = 1;
    n.onaudioprocess = e=>{
      loopBuffer.render(_=>{
        G.granular.tex(loopBuffer.use());
        G.granular.audioIndex(7);
        G.granular.offset(0.0);
        G.granular.offsetRandom(0.1);
        G.granular.baseGrainDur((Math.random()+0.5)*2);
        G.granular.basePlaybackRate(1);
        G.granular.notes.v2(notes);
        G.granular.audio(audioBuffer.use());
        G.granular.randoms(Math.random(), Math.random());
        G.granular();
      });
      loopBuffer.render(_=>{
        G.accum.tex(loopBuffer.use());
        G.accum();
      });
      const b = loopBuffer.pixels(unitNotes*grains-2, 2);
      const c0 = e.outputBuffer.getChannelData(0);
      const c1 = e.outputBuffer.getChannelData(1);
      c0.set(b.subarray(0, samples));
      c1.set(b.subarray(samples, samples*2));
    };
    n.connect(outNode);
    for(let i=1;i<unitNotes;i++) {
      const j = i;
      noteCandidates.push({
        freq: f=>{ notes[j*2+0] = f/220; },
        gain: g=>{ notes[j*2+1] = g; }
      });
    }
    L.add("New Synth Acquired");
  }
  createSynth();

  function createNote(f) {
    if(noteCandidates.length == 0) createSynth();
    const note = noteCandidates.pop();
    // L.add("Rest: " + noteCandidates.length);
    note.freq(f);
    return {
      gain: note.gain,
      disconnect: _=>{
        note.gain(0);
        setTimeout(_=>{
          noteCandidates.push(note);
        }, 100);
      }
    };
  }

  return { note: createNote };
};
