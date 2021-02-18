module.exports = Kino=>{
  const o = {};

  const G = Kino.G;
  const S = Kino.S;
  const H = Kino.H;
  const L = Kino.L;
  const vert = G.vert;
  const rect = G.rect;

  const samples = 2048;
  const units = 512;
  const allocBlock = 16;
  const channels = 8;
  const paramCount = 32;

  const library = `
  #define sampleRate 48000.
  #define samples ${samples}.
  #define units ${units}.
  #define channels ${channels}
  #define allocBlock ${allocBlock}
  #define allocUnit ${units / allocBlock}
  #define paramCount ${paramCount}
  ${G.library}
  uniform float region[${channels*2 + allocBlock}];
  uniform vec4 blocks[${allocBlock}];
  uniform vec4 params[${paramCount * allocBlock}];
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
    return mix(m0, m1, f);
  }
  uniform sampler2D noise;
  float sampleNoise(float t, float freq0, float freq1) {
    float s = t * sampleRate;
    int s0 = int(s), s1 = int(s) + 1;
    s0 = ((s0%131072) + 131072) % 131072;
    s1 = ((s1%131072) + 131072) % 131072;
    float f = s - floor(s);
    // float e0 = clamp(log2(freq0/20.) / 10., 0., 1.) * 63.;
    // float e1 = clamp(log2(freq1/20.) / 10., 0., 1.) * 63.;
    float e0 = clamp((freq0-20.)/(20000.-20.), 0., 1.) * 63.;
    float e1 = clamp((freq1-20.)/(20000.-20.), 0., 1.) * 63.;
    int e00 = int(e0);
    int e01 = e00 + 1;
    float e0f = smoothstep(0., 1., e0 - floor(e0));
    int e10 = int(e1);
    int e11 = e10 + 1;
    float e1f = smoothstep(0., 1., e1 - floor(e1));
    if(e01 >= 64) e01 = 63;
    if(e11 >= 64) e11 = 63;
    int sw = 2048;
    ivec2 o0 = ivec2(s0/4%sw, s0/4/sw);
    ivec2 o1 = ivec2(s1/4%sw, s1/4/sw);
    float m000 = texelFetch(noise, ivec2(0, e00*16) + o0, 0)[s0%4];
    float m001 = texelFetch(noise, ivec2(0, e00*16) + o1, 0)[s1%4];
    float m010 = texelFetch(noise, ivec2(0, e01*16) + o0, 0)[s0%4];
    float m011 = texelFetch(noise, ivec2(0, e01*16) + o1, 0)[s1%4];
    float m100 = texelFetch(noise, ivec2(0, e10*16) + o0, 0)[s0%4];
    float m101 = texelFetch(noise, ivec2(0, e10*16) + o1, 0)[s1%4];
    float m110 = texelFetch(noise, ivec2(0, e11*16) + o0, 0)[s0%4];
    float m111 = texelFetch(noise, ivec2(0, e11*16) + o1, 0)[s1%4];
    float v0 = mix(mix(m000, m001, f), mix(m010, m011, f), e0f);
    float v1 = mix(mix(m100, m101, f), mix(m110, m111, f), e1f);
    return v1 - v0;
  }
  `;

  const granular = `
  uniform vec2 randoms;
  #define grains 2
  float wave(float t) {
    return sampleAudio(t, 0, 0);
  }
  // p: Offset, Duration, PlayOffset, PlayDuration
  // q: Volume, FadeCut, 0, 0
  vec4 grain(vec4 p, vec4 q, vec4 t) {
    if(p.w == 0.) return vec4(0.);
    vec4 r = (t - p.z) / p.w;
    vec4 u = abs(r - 0.5);
    bool fadeCut = q.y > 0.5;
    if(fadeCut) u = max(vec4(0.), r - 0.5);
    vec4 w = smoothstep(0., 0.5, 0.5-u);
    vec4 tt = p.x + p.y*r;
    vec4 waves = vec4(wave(tt.x), wave(tt.y), wave(tt.z), wave(tt.w));
    return waves * q.x * w;
  }
  void gen(float t, float d, int i, vec2 note, bool fadeCut, out vec4 p, out vec4 q) {
    vec2 seed = vec2(float(i), t);
    float rate = note.x;
    p = vec4(rand(seed+1.), d*rate, t, d);
    q = vec4(1., fadeCut ? 1. : 0., 0., 0.);
  }`;

  const grainStep = `
  vec4 p0 = texelFetch(tex, ivec2(1, y), 0);
  vec4 q0 = texelFetch(tex, ivec2(2, y), 0);
  vec4 p1 = texelFetch(tex, ivec2(3, y), 0);
  vec4 q1 = texelFetch(tex, ivec2(4, y), 0);
  vec2 curNote = curParam0.xy, prevNote = prevParam0.xy;
  if(curNote.x == 0.) {
    p0 = p1 = vec4(0, 1, 0, 1);
    q0 = q1 = vec4(0, 0, 0, 0);
  } else {
    float grainDur = 1.0 / curNote.x;
    float startTime = p1.z + p1.w * 0.5;
    float singleDur = 0.5 * grainDur;
    if(p1.w > grainDur) startTime = p1.z + p1.w - (grainDur - singleDur);
    startTime += rand(vec2(0,y) + randoms)*grainDur;
    bool fadeCut = false;
    if(prevNote.x == 0. && curNote.x > 0.) {
      // Prepare for the next note
      q0.x = q1.x = 0.;
      startTime = 0.;
      fadeCut = true;
    }
    startTime = max(0., startTime); // may occur from sudden grainDur decreasing
    if(startTime < t) {
      float i = floor((t-startTime) / singleDur);
      p0 = p1, q0 = q1;
      gen(startTime+i*singleDur, grainDur, y, curNote, fadeCut, p1, q1);
      if(i > 0.5) {
        i--;
        gen(startTime+i*singleDur, grainDur, y, curNote, fadeCut, p0, q0);
      }
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
    int blockIndex = y / allocUnit, threadIndex = y - blockIndex * allocUnit;
    vec4 result = vec4(0);

    vec4 b0 = blocks[blockIndex];
    vec4 curParam0 = params[blockIndex*paramCount + threadIndex/2*2 + 0];
    vec4 curParam1 = params[blockIndex*paramCount + threadIndex/2*2 + 1];
    vec4 prevParam0 = texelFetch(tex, ivec2(0, y/2*2 + 0), 0);
    vec4 prevParam1 = texelFetch(tex, ivec2(0, y/2*2 + 1), 0);
    int type = int(b0.x);
    if(type == 1) { // Grain
      float t = dur;
      ${grainStep}
      p0.z -= dur, p1.z -= dur;
      if(x == 1) result = p0;
      if(x == 2) result = q0;
      if(x == 3) result = p1;
      if(x == 4) result = q1;
    } else if(type == 2) { // Noise
      vec4 q = texelFetch(tex, ivec2(1, y), 0);
      if(prevParam0.x == 0.) q.x = 0.;
      q.x += dur;
      q.x = mod(q.x, 131072./48000.);
      result = q;
    } else if(type == 3) { // Cycle
      vec4 q = texelFetch(tex, ivec2(1, y), 0);
      if(prevParam0.x == 0.) q.x = 0.;
      q.x += dur;
      result = q;
    }
    if(x == 0) result = y%2 == 0 ? curParam0 : curParam1;

    fragColor = result;
  }
  `,rect,["tex","randoms","params","blocks"]);

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
    int blockIndex = y / allocUnit, threadIndex = y - blockIndex * allocUnit;
    float t = (coord.x*0.5+0.5) * dur;
    float dt = 1. / sampleRate;
    vec4 ts = t + vec4(0,1,2,3) * dt;
    vec4 result = vec4(0);

    vec4 b0 = blocks[blockIndex];
    vec4 curParam0 = params[blockIndex*paramCount + threadIndex/2*2 + 0];
    vec4 curParam1 = params[blockIndex*paramCount + threadIndex/2*2 + 1];
    vec4 prevParam0 = texelFetch(tex, ivec2(0, y/2*2 + 0), 0);
    vec4 prevParam1 = texelFetch(tex, ivec2(0, y/2*2 + 1), 0);
    int type = int(b0.x);
    if(type == 1) { // Grain
      ${grainStep}
      vec4 v = grain(p0, q0, ts) + grain(p1, q1, ts);
      result = v * mix(prevNote.y, curNote.y, coord.x*0.5+0.5);
    } else if(type == 2) { // Noise
      vec4 q = texelFetch(tex, ivec2(1, y), 0);
      if(prevParam0.x == 0.) q.x = 0.;
      vec4 v = vec4(0.);
      vec4 pp = prevParam0, cp = curParam0;
      ts += q.x;
      float fx = cp.x;
      float fy = cp.y;
      float s = cp.z;
      v.x = sampleNoise(ts.x, fx, fy);
      v.y = sampleNoise(ts.y, fx, fy);
      v.z = sampleNoise(ts.z, fx, fy);
      v.w = sampleNoise(ts.w, fx, fy);
      result = v * s * mix(exp(-ts*10.), exp(-ts*100.), 0.4) * (1.-exp(-ts*400.));
    } else if(type == 3) { // Cycle
      vec4 q = texelFetch(tex, ivec2(1, y), 0);
      if(prevParam0.x == 0.) q.x = 0.;
      ts += q.x;
      vec4 pp = prevParam0, cp = curParam0;
      float fx = cp.x;
      float fy = cp.y;
      float s = cp.z;
      float rate = 1.0f;
      vec4 u = fx*ts - fy*exp(-rate*ts)/rate;
      vec4 v = sin(u * 3.14159265*2.);
      result = v * s * mix(exp(-ts*20.), exp(-ts*100.), 0.4) * (1.-exp(-ts*400.));
    }

    int ch = int(region[channels*2 + y / allocUnit]);
    fragColor = ch == -1 ? vec4(0) : result;
  }
  `,rect,["tex","audio","noise","randoms","region","params","blocks"]);

  const accum = G.buildMaterial(vert,`
  ${library}
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(0);
    ivec2 ci = ivec2((coord*0.5+0.5)*resolution);
    int x = ci.x, y = ci.y;
    int ch = int(region[channels*2 + y / allocUnit]);
    if(ch == -1) return;
    int r = int(region[ch]);
    if(r == -1) return;
    r *= allocUnit;
    int s = int(region[channels + ch]) * allocUnit;
    y -= r;
    if(y >= s / 4) return;
    vec4 result = vec4(0);
    y = y % 2 + r + (y / 2) * 8;
    for(int i=0;i<4;i++) {
      result += texelFetch(tex, ivec2(x, y + 2*i), 0);
    }
    fragColor = result;
  }
  `,rect,["tex","region"]);

  const aggregate = G.buildMaterial(vert,`
  ${library}
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(0);
    ivec2 ci = ivec2((coord*0.5+0.5)*resolution);
    int x = ci.x, y = ci.y;
    if(y >= channels*2) return;
    int r = int(region[y / 2]);
    if(r == -1) return;
    r *= allocUnit;
    y = y % 2 + r;
    vec4 result = texelFetch(tex, ivec2(x, y), 0);
    fragColor = result;
  }
  `,rect,["tex","region"]);

  const shift = G.buildMaterial(vert,`
  ${library}
  in vec2 coord;
  uniform sampler2D tex;
  uniform vec2 move;
  out vec4 fragColor;
  void main() {
    float dur = samples / sampleRate;
    ivec2 ci = ivec2((coord*0.5+0.5)*resolution);
    int x = ci.x, y = ci.y, blockIndex = y / allocUnit;
    vec4 result = vec4(0);
    int first = int(move.x), count = int(move.y);
    if(blockIndex >= first) {
      int i = blockIndex + count;
      if(first <= i && i < allocBlock) {
        y += count * allocUnit;
        result = texelFetch(tex, ivec2(x, y), 0);
      }
    } else {
      result = texelFetch(tex, ivec2(x, y), 0);
    }
    fragColor = result;
  }
  `,rect,["tex","move"]);

  const raws = [
    { freq: 442,    name: "voice1401.wav" },
    { freq: 495,    name: "BKAYE_brass_pad_G.wav" },
    { freq: 1216.5, name: "whistle_high.wav" },
    { freq: 656,    name: "whistle_low.wav" },
    { freq: 356,    name: "voice1630.wav" },
    { freq: 288,    name: "glsl_inst0.wav" },
    { freq: 192.5,  name: "glsl_dist.wav" },
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

  const noiseBuffer = G.DataBuffer(2048,1024);
  (_=>{
    const baseNoise = new Float32Array(2048*1024*4/64);
    for(let i=0;i<baseNoise.length;i++) baseNoise[i] = Math.random()*2-1;
    const b = new Float32Array(baseNoise.length);
    for(let j=0;j<64;j++) {
      // Biquad Filter (LowPass)
      const freq = 20 + (20000-20) * (j/63.0); // 20 * Math.pow(2,j*10/63);
      const q = 1;
      const omega = 2 * Math.PI * freq / S.X.sampleRate;
      const alpha = Math.sin(omega) / 2 / q;
      const cw = Math.cos(omega);
      let a0 = 1 + alpha, a1 = - 2 * cw, a2 = 1 - alpha;
      let b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = (1 - cw) / 2;
      b0 /= a0, b1 /= a0, b2 /= a0, a1 /= a0, a2 /= a0;
      let x0 = 0, x1 = 0, x2 = 0;
      let y0 = 0, y1 = 0, y2 = 0;
      function feed(v) {
        x2 = x1;
        x1 = x0;
        x0 = v;
        y2 = y1;
        y1 = y0;
        y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      }
      for(let i=b.length*(1-1/8);i<b.length;i++) {
        feed(baseNoise[i]);
      }
      for(let i=0;i<b.length;i++) {
        feed(baseNoise[i]);
        b[i] = y0;
      }
      noiseBuffer.set(j*1024/64, b);
    }
  })();

  const generators = new Array(channels);
  const memoryBuffer = G.DataLoopBuffer(16, units); // column at 0: previous synthParam
  const waveBuffer = G.DataLoopBuffer(samples/4, units);

  const blockParams = new Float32Array(4 * allocBlock); // genId, 0, 0, 0
  const synthParams = new Float32Array(4 * paramCount * allocBlock);
  // Consistency: all used blocks align consecutively from head
  const allocRegion = new Float32Array(channels*2 + allocBlock);
  for(let i=0;i<32;i++) allocRegion[i] = -1;
  let allocatedBlocks = 0;

  function storeUpdate() {
    L.add("Allocated blocks: " + allocatedBlocks);
    for(let i=0;i<channels;i++) {
      const g = generators[i];
      if(g) {
        const f = allocRegion[i], c = allocRegion[i+channels];
        g.store = {
          block: blockParams.subarray(f*4, (f+c)*4),
          synth: synthParams.subarray(f*4*paramCount, (f+c)*4*paramCount)
        };
      }
    }
  }
  const Allocator = {
    allocBlock: (i,g)=>{
      if(allocatedBlocks == allocBlock) {
        L.add("Memory blocks exhausted.");
        return false;
      }
      let first = allocRegion[i], count = allocRegion[i+channels];
      if(first == -1) {
        // First Allocation
        count = 0;
        for(let j=i+1;j<channels;j++) {
          if(allocRegion[j] != -1) {
            first = allocRegion[j];
            break;
          }
        }
        if(first == -1) {
          first = 0;
          for(let j=i-1;j>-1;j--) {
            if(allocRegion[j] != -1) {
              first = allocRegion[j] + allocRegion[j+channels];
              break;
            }
          }
        }
      }
      // Shift 1 block
      const loc = first+count;
      memoryBuffer.render(_=>{
        shift.tex(memoryBuffer.use());
        shift.move(loc, -1);
        shift();
      });
      for(let j=allocBlock-1;j>loc;j--) {
        allocRegion[channels*2 + j] = allocRegion[channels*2 + j-1];
        for(let k=0;k<4;k++) {
          blockParams[j*4+k] = blockParams[(j-1)*4+k];
        }
        for(let k=0;k<4*paramCount;k++) {
          synthParams[j*4*paramCount+k] = synthParams[(j-1)*4*paramCount+k];
        }
      }
      blockParams[loc*4+0] = g;
      blockParams[loc*4+1] = 0;
      blockParams[loc*4+2] = 0;
      blockParams[loc*4+3] = 0;
      for(let k=0;k<4*paramCount;k++) {
        synthParams[loc*4*paramCount+k] = 0;
      }
      for(let j=i+1;j<channels;j++) {
        if(allocRegion[j] == -1) continue;
        allocRegion[j] += 1;
      }
      allocRegion[i] = first;
      allocRegion[i+channels] = count+1;
      allocRegion[channels*2 + loc] = i;
      allocatedBlocks++;
      storeUpdate();
      return true;
    },
    releaseAll: i=>{
      let first = allocRegion[i], count = allocRegion[i+channels];
      if(first == -1) return;
      // Shift back blocks
      memoryBuffer.render(_=>{
        shift.tex(memoryBuffer.use());
        shift.move(first, count);
        shift();
      });
      for(let j=first;j<allocBlock;j++) {
        if(j+count < allocBlock) {
          allocRegion[channels*2 + j] = allocRegion[channels*2 + j+count];
          for(let k=0;k<4;k++) {
            blockParams[j*4+k] = blockParams[(j+count)*4+k];
          }
          for(let k=0;k<4*paramCount;k++) {
            synthParams[j*4*paramCount+k] = synthParams[(j+count)*4*paramCount+k];
          }
        } else { // Out of bounds
          allocRegion[channels*2 + j] = -1;
          for(let k=0;k<4;k++) {
            blockParams[j*4+k] = 0;
          }
          for(let k=0;k<4*paramCount;k++) {
            synthParams[j*4*paramCount+k] = 0;
          }
        }
      }
      for(let j=i+1;j<channels;j++) {
        if(allocRegion[j] == -1) continue;
        allocRegion[j] -= count;
      }
      allocRegion[i] = -1;
      allocRegion[i+channels] = -1;
      allocatedBlocks -= count;
      storeUpdate();
    }
  };

  const n = S.X.createScriptProcessor(samples, 0, channels*2);
  n.onaudioprocess = e=>{
    const st = new Date();
    const randoms = [Math.random(), Math.random()];
    waveBuffer.render(_=>{
      render.tex(memoryBuffer.use());
      render.audio(audioBuffer.use());
      render.noise(noiseBuffer.use());
      render.randoms.v2(randoms);
      render.region.v1(allocRegion);
      render.params.v4(synthParams);
      render.blocks.v4(blockParams);
      render();
    });
    for(let i=0;i<4;i++) { // 4^4 < units/2
      waveBuffer.render(_=>{
        accum.tex(waveBuffer.use());
        accum.region.v1(allocRegion);
        accum();
      });
    }
    waveBuffer.render(_=>{
      aggregate.tex(waveBuffer.use());
      aggregate.region.v1(allocRegion);
      aggregate();
    });
    memoryBuffer.render(_=>{
      step.tex(memoryBuffer.use());
      step.randoms.v2(randoms);
      step.params.v4(synthParams);
      step.blocks.v4(blockParams);
      step();
    });
    for(let i=0;i<channels;i++) {
      const g = generators[i];
      if(g && g.step) g.step();
    }
    H.step();

    const b = waveBuffer.pixels(samples/4, channels*2);
    for(let i=0;i<channels*2;i++) {
      const c = e.outputBuffer.getChannelData(i);
      c.set(b.subarray(i*samples, (i+1)*samples));
    }
    const et = new Date();
    L.prop(2, "synth: " + (et-st) + "ms");
  };
  const splitter = S.X.createChannelSplitter(channels*2);
  n.connect(splitter);
  const merger = [];
  for(let i=0;i<channels;i++) {
    const m = S.X.createChannelMerger(2);
    splitter.connect(m, i*2+0, 0);
    splitter.connect(m, i*2+1, 1);
    merger.push(m);
  }
  S.dummyOut(merger[0]);
  o.connect = (index,gen,node)=>{
    if(index < 0 || channels <= index) return;
    L.add(`Synth ${index} acquired with type ${gen.name}.`);
    merger[index].connect(node.in);
    const g = gen.acquire(_=>Allocator.allocBlock(index, gen.id));
    generators[index] = g;
    return g;
  };
  o.disconnect = index=>{
    L.add(`Synth ${index} released.`);
    Allocator.releaseAll(index);
    merger[index].disconnect();
    generators[index] = null;
  };
  return o;
};
