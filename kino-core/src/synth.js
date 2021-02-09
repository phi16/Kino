module.exports = Kino=>{
  const o = {};

  const G = Kino.G;
  const S = Kino.S;
  const L = Kino.L;
  const vert = G.vert;
  const rect = G.rect;

  const samples = 2048;
  const units = 256;
  const channels = 1;

  const library = `
  #define sampleRate 48000.
  #define samples ${samples}.
  #define units ${units}.
  ${G.library}
  uniform sampler2D audio;
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
  `;

  const granular = `
  uniform vec2 randoms;
  float wave(float t) {
    return sampleAudio(t, 0, 0);
  }
  // p: Offset, Duration, PlayOffset, PlayDuration
  // q: Volume, 0, 0, 0
  vec4 grain(vec4 p, vec4 q, vec4 t) {
    if(p.w == 0.) return vec4(0.);
    vec4 r = (t - p.z) / p.w;
    vec4 u = abs(r - 0.5);
    vec4 w = smoothstep(0., 0.5, 0.5-u);
    vec4 tt = p.x + p.y*r;
    vec4 waves = vec4(wave(tt.x), wave(tt.y), wave(tt.z), wave(tt.w));
    return waves * q.x * w;
  }
  void gen(float t, float d, int i, out vec4 p, out vec4 q) {
    vec2 seed = vec2(float(i), t);
    p = vec4(rand(seed+1.), d, t, d);
    q = vec4(1., 0., 0., 0.);
  }`;

  const grainStep = `
  float grainDur = 1.0;
  float startTime = p1.z + p1.w * 0.5;
  float singleDur = 0.5 * grainDur;
  if(p1.w > grainDur) startTime = p1.z + p1.w - (grainDur - singleDur);
  startTime += rand(vec2(0,y) + randoms)*grainDur;
  startTime = max(0., startTime);
  if(startTime < t) {
    float i = floor((t-startTime) / singleDur);
    p0 = p1, q0 = q1;
    gen(startTime+i*singleDur, grainDur, y, p1, q1);
    if(i > 0.5) {
      i--;
      gen(startTime+i*singleDur, grainDur, y, p0, q0);
    }
  }
  `;

  const step = G.buildMaterial(vert,`
  ${library}
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  ${granular}
  void main() {
    float dur = samples / sampleRate;
    ivec2 ci = ivec2((coord*0.5+0.5)*resolution);
    int x = ci.x, y = ci.y;
    vec4 result = vec4(0);

    vec4 m = texelFetch(tex, ivec2(0, y), 0);
    if(m.x < 0.5) {
      // Granular Generator
      vec4 p0 = texelFetch(tex, ivec2(1, y), 0);
      vec4 q0 = texelFetch(tex, ivec2(2, y), 0);
      vec4 p1 = texelFetch(tex, ivec2(3, y), 0);
      vec4 q1 = texelFetch(tex, ivec2(4, y), 0);
      float t = dur;
      ${grainStep}
      p0.z -= dur, p1.z -= dur;
      if(x == 1) result = p0;
      if(x == 2) result = q0;
      if(x == 3) result = p1;
      if(x == 4) result = q1;
    }
    if(x == 0) result = m;

    fragColor = result;
  }
  `,rect,["tex","randoms"]);

  const render = G.buildMaterial(vert,`
  ${library}
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  ${granular}
  void main() {
    float dur = samples / sampleRate;
    ivec2 ci = ivec2((coord*0.5+0.5)*resolution);
    int x = ci.x, y = ci.y;
    float t = (coord.x*0.5+0.5) * dur;
    float dt = 1. / sampleRate;
    vec4 ts = t + vec4(0,1,2,3) * dt;
    vec4 result = vec4(0);

    vec4 m = texelFetch(tex, ivec2(0, y), 0);
    if(m.x < 0.5) {
      // Granular Generator
      vec4 p0 = texelFetch(tex, ivec2(1, y), 0);
      vec4 q0 = texelFetch(tex, ivec2(2, y), 0);
      vec4 p1 = texelFetch(tex, ivec2(3, y), 0);
      vec4 q1 = texelFetch(tex, ivec2(4, y), 0);
      ${grainStep}
      vec4 v = grain(p0, q0, ts) + grain(p1, q1, ts);
      result = v * 0.5;
    }

    fragColor = result;
  }
  `,rect,["tex","audio"]);

  const accum = G.buildMaterial(vert,`
  ${library}
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  void main() {
    ivec2 ci = ivec2((coord*0.5+0.5)*resolution);
    int x = ci.x, y = ci.y;
    if(y < int(resolution.y) / 4) {
      vec4 result = vec4(0);
      y = y % 2 + (y / 2) * 8;
      for(int i=0;i<4;i++) {
        result += texelFetch(tex, ivec2(x, y + 2*i), 0);
      }
      fragColor = result;
    }
  }
  `,rect,["tex"]);

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
    S.load(raws[j].name).then(b=>{
      audioBuffer.set(j*128+0,  b.getChannelData(0));
      audioBuffer.set(j*128+64, b.getChannelData(1));
    });
  }

  const memoryBuffer = G.DataLoopBuffer(8, units);
  const waveBuffer = G.DataLoopBuffer(samples/4, units);
  const n = S.X.createScriptProcessor(samples, 0, channels*2);
  let t = 0;
  n.onaudioprocess = e=>{
    memoryBuffer.render(_=>{
      step.tex(memoryBuffer.use());
      step.randoms(Math.random(), Math.random());
      step();
    });
    waveBuffer.render(_=>{
      render.tex(memoryBuffer.use());
      render.audio(audioBuffer.use());
      render();
    });
    for(let i=0;i<4;i++) { // 4^4 < units/2
      waveBuffer.render(_=>{
        accum.tex(waveBuffer.use());
        accum();
      });
    }

    const b = waveBuffer.pixels(samples/4, channels*2);
    for(let i=0;i<channels*2;i++) {
      const c = e.outputBuffer.getChannelData(i);
      c.set(b.subarray(i*samples, (i+1)*samples));
    }
  };
  const outNode = S.node();
  n.connect(outNode);

  return o;
};
