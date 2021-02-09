module.exports = (o, outNode)=>{
  const G = o.render.gl;
  const S = o.sound;
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
    S.load("../sound/" + raws[j].name).then(b=>{
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

const granular = G.buildMaterial(vert,`
#define tau (2.*3.1415926535)
#define sampleRate 48000.
#define window 1.
#define samples ${samples}.
#define unitNotes ${unitNotes}
#define grains ${grains}
in vec2 coord;
uniform sampler2D tex;
uniform sampler2D audio;
uniform float baseGrainDur;
uniform float offset;
uniform float offsetRandom;
uniform float basePlaybackRate;
uniform float audioIndex;
uniform vec2 randoms;
uniform vec4 notes[32];
out vec4 fragColor;
float rand(vec2 co){
  return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
}
float sampleAudio(float t, int i, int ch) {
  float s = t * sampleRate;
  int s0 = int(s), s1 = int(s) + 1;
  float f = s - floor(s);
  ivec2 base = ivec2(0, (i*2+ch)*64);
  int sw = 2048;
  float m0 = texelFetch(audio, base + ivec2(s0/4%sw, s0/4/sw), 0)[s0%4];
  float m1 = texelFetch(audio, base + ivec2(s1/4%sw, s1/4/sw), 0)[s1%4];
  if(s0 < 0 || s0 >= 524288) m0 = 0.;
  if(s1 < 0 || s1 >= 524288) m1 = 0.;
  return mix(m0, m1, smoothstep(0., 1., f));
}
float wave(float t) {
  return sampleAudio(t, int(audioIndex), 0);
}
vec4 grain(vec4 p, vec4 q, vec4 t) {
  // p: Offset, Duration, PlayOffset, PlayDuration
  // q: Volume, 1, FadeCut, 0
  if(p.w == 0.) return vec4(0.);
  vec4 r = (t - p.z) / p.w;
  vec4 u = abs(r - 0.5);
  bool fadeCut = q.z > 0.5;
  if(fadeCut) u = max(vec4(0.), r - 0.5);
  vec4 w = smoothstep(0., 0.5, 0.5-u);
  vec4 tt = p.x + p.y*r;
  vec4 waves = vec4(wave(tt.x), wave(tt.y), wave(tt.z), wave(tt.w));
  return waves * q.x * w;
}
void gen(float t, float d, int waveIx, vec2 note, bool fadeCut, out vec4 p, out vec4 q) {
  float dur = samples / sampleRate;
  vec2 seed = vec2(float(waveIx), t);
  float rate = basePlaybackRate * note.x;
  // if(rand(seed+0.) < 0.5) rate *= 0.5; // TODO: be stable (waveIx)
  p = vec4(offset + rand(seed+1.)*offsetRandom, d*rate, t, d);
  q = vec4(rand(seed+2.)*0.0+1.0, 1.0, fadeCut ? 1. : 0., 0.);
}
void main() {
  float dur = samples / sampleRate;
  float res = samples/4.;
  int x = int((coord.x*0.5+0.5)*res);
  int y = int((coord.y*0.5+0.5)*float(unitNotes*grains));
  float t = (coord.x*0.5+0.5) * dur;
  bool wave = true;
  int dataInRow = int(res/4.);
  int waveIx = y;
  if(y < grains) {
    t = dur;
    wave = false;
    waveIx = x/4 + y*dataInRow;
  }
  float dt = 1. / sampleRate;
  vec4 ts = t + vec4(0,1,2,3) * dt;
  vec4 result = vec4(0.);

  ivec2 dataOffset = ivec2(waveIx%dataInRow*4, waveIx/dataInRow);
  vec4 p0 = texelFetch(tex, dataOffset + ivec2(0, 0), 0);
  vec4 q0 = texelFetch(tex, dataOffset + ivec2(1, 0), 0);
  vec4 p1 = texelFetch(tex, dataOffset + ivec2(2, 0), 0);
  vec4 q1 = texelFetch(tex, dataOffset + ivec2(3, 0), 0);
  vec4 note = notes[waveIx/8];
  vec2 curNote = note.xy, prevNote = note.zw;
  float grainDur = baseGrainDur/curNote.x;
  float startTime = p1.z + p1.w * mix(1.0, 0.5, q1.y);
  float singleDur = mix(1.0, 0.5, window) * grainDur;
  if(p1.w > grainDur) startTime = p1.z + p1.w - (grainDur - singleDur);
  startTime += rand(vec2(waveIx,0) + randoms)*grainDur; // randomize phase
  // ^ TODO
  bool fadeCut = false;
  if(distance(curNote.x, prevNote.x) > 0.00001) {
    // Prepare for the next note
    q0.x = q1.x = 0.;
    startTime = 0.;
    fadeCut = true;
  }
  startTime = max(0., startTime); // may occur from sudden grainDur decreasing
  if(startTime < t) {
    float i = floor((t-startTime) / singleDur);
    p0 = p1, q0 = q1;
    gen(startTime+i*singleDur, grainDur, waveIx, curNote, fadeCut, p1, q1);
    if(i > 0.5) {
      i--;
      gen(startTime+i*singleDur, grainDur, waveIx, curNote, fadeCut, p0, q0);
    }
  }

  if(wave) {
    vec4 v = grain(p0, q0, ts) + grain(p1, q1, ts);
    result = v*2.*mix(prevNote.y, curNote.y, coord.x*0.5+0.5);
  } else {
    p0.z -= dur, p1.z -= dur;
    int xi = x%4;
    if(xi == 0) result = p0;
    if(xi == 1) result = q0;
    if(xi == 2) result = p1;
    if(xi == 3) result = q1;
  }
  fragColor = result;
}
`,rect,["tex","audio","baseGrainDur","offset","offsetRandom","basePlaybackRate","randoms","audioIndex","notes"]);

const accum = G.buildMaterial(`
in vec2 vertex;
out vec2 coord;
void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
}
`,`
#define samples ${samples}.
#define unitNotes ${unitNotes}
#define grains ${grains}
in vec2 coord;
uniform sampler2D tex;
out vec4 fragColor;
void main() {
  float res = samples/4.;
  int x = int((coord.x*0.5+0.5)*res);
  int y = int((coord.y*0.5+0.5)*float(unitNotes*grains));
  if(y < unitNotes*grains-2) {
    fragColor = texelFetch(tex, ivec2(x,y), 0);
  } else {
    vec4 result = vec4(0.);
    for(int i=y;i>=grains;i-=2) { // TODO: reduce
      result += texelFetch(tex, ivec2(x,i), 0);
    }
    result /= float(grains) / 2.;
    fragColor = result;
  }
}
`,rect,["tex"]);

};
