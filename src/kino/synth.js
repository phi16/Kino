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
    { freq: 440,    name: "AmebientSamplePack/Oneshot/bell_a.wav" },
    { freq: 495,    name: "BKAYE_brass_pad_G.wav" },
    { freq: 288,    name: "glsl_inst0.wav" },
    { freq: 192.5,  name: "glsl_dist.wav" },
    { freq: 282.5,  name: "voice1627.wav" },
    { freq: 356,    name: "voice1630.wav" },
    { freq: 361,    name: "voice1400.wav" },
    { freq: 442,    name: "voice1401.wav" },
    { freq: 656,    name: "whistle_low.wav" },
    { freq: 1216.5, name: "whistle_high.wav" },
  ];
  const audioBuffer = G.DataBuffer(2048,1024);
  for(let i=0;i<raws.length;i++) {
    if(i >= 8) break;
    const j = i;
    S.load("sound/" + raws[j].name).then(b=>{
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
    const notes = new Float32Array(unitNotes*4); // (freq, gain, prevFreq, prevGain)
    for(let i=0;i<unitNotes;i++) {
      notes[i*4+0] = 1;
      notes[i*4+1] = 0;
      notes[i*4+2] = 1;
      notes[i*4+3] = 0;
    }
    const aix = 2;
    n.onaudioprocess = e=>{
      loopBuffer.render(_=>{
        G.granular.tex(loopBuffer.use());
        G.granular.audioIndex(aix);
        G.granular.offset(0.0);
        G.granular.offsetRandom(0.5);
        G.granular.baseGrainDur((Math.random()+0.5)*4);
        G.granular.basePlaybackRate(1);
        G.granular.notes.v4(notes);
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
      for(let i=0;i<unitNotes;i++) {
        notes[i*4+2] = notes[i*4+0];
        notes[i*4+3] = notes[i*4+1];
      }
    };
    n.connect(outNode);
    for(let i=1;i<unitNotes;i++) {
      const j = i;
      noteCandidates.push({
        freq: f=>{ notes[j*4+0] = f/raws[aix].freq; },
        gain: g=>{ notes[j*4+1] = g; }
      });
    }
    L.add("New Synth Acquired.");
  }

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
