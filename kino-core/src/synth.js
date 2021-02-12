module.exports = Kino=>{
  const o = {};

  const G = Kino.G;
  const S = Kino.S;
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
  ${G.library}
  uniform sampler2D audio;
  uniform float region[${channels*2 + allocBlock}];
  uniform vec4 blocks[${allocBlock}];
  uniform vec4 params[${paramCount * allocBlock}];
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
    float rate = pow(2., float(i/32)/12.0);
    p = vec4(rand(seed+1.), d*rate, t, d);
    q = vec4(1., 0., 0., 0.);
  }`;

  const grainStep = `
  vec4 p0 = texelFetch(tex, ivec2(0, y), 0);
  vec4 q0 = texelFetch(tex, ivec2(1, y), 0);
  vec4 p1 = texelFetch(tex, ivec2(2, y), 0);
  vec4 q1 = texelFetch(tex, ivec2(3, y), 0);
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
    int x = ci.x, y = ci.y, blockIndex = y / allocUnit;
    vec4 result = vec4(0);

    vec4 b0 = blocks[blockIndex];
    int type = int(b0.x);
    if(type == 1 || true) { // Grain
      float t = dur;
      ${grainStep}
      p0.z -= dur, p1.z -= dur;
      if(x == 0) result = p0;
      if(x == 1) result = q0;
      if(x == 2) result = p1;
      if(x == 3) result = q1;
    }

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
    int x = ci.x, y = ci.y, blockIndex = y / allocUnit;
    float t = (coord.x*0.5+0.5) * dur;
    float dt = 1. / sampleRate;
    vec4 ts = t + vec4(0,1,2,3) * dt;
    vec4 result = vec4(0);

    vec4 b0 = blocks[blockIndex];
    int type = int(b0.x);
    if(type == 1 || true) { // Grain
      ${grainStep}
      vec4 v = grain(p0, q0, ts) + grain(p1, q1, ts);
      result = v * 0.05;
    }

    int ch = int(region[channels*2 + y / allocUnit]);
    fragColor = ch == -1 ? vec4(0) : result;
  }
  `,rect,["tex","audio","randoms","region","params","blocks"]);

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

  const generators = new Array(channels);
  const memoryBuffer = G.DataLoopBuffer(8, units);
  const waveBuffer = G.DataLoopBuffer(samples/4, units);

  const blockParams = new Float32Array(4 * allocBlock); // genId, 0, 0, 0
  const synthParams = new Float32Array(4 * paramCount * allocBlock);
  // Consistency: all used blocks align consecutively from head
  const allocRegion = new Float32Array(channels*2 + allocBlock);
  for(let i=0;i<32;i++) allocRegion[i] = -1;
  let allocatedBlocks = 0;

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
      return true;
    },
    releaseAll: i=>{
      let first = allocRegion[i], count = allocRegion[i+channels];
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
    }
  };

  const n = S.X.createScriptProcessor(samples, 0, channels*2);
  n.onaudioprocess = e=>{
    for(let i=0;i<channels;i++) if(generators[i]) generators[i].step();
    const st = new Date();
    const randoms = [Math.random(), Math.random()];
    waveBuffer.render(_=>{
      render.tex(memoryBuffer.use());
      render.audio(audioBuffer.use());
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
