module.exports = (gl,front)=>{
  const o = {};

  const randSeed = Math.random() * Math.PI * 2;
  const startTime = new Date();

  gl.getExtension("EXT_color_buffer_float");
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.clearColor(0.2,0.2,0.2,1);
  let width = 1, height = 1;
  const resizeCallback = [];
  o.resize = (w,h)=>{
    width = w, height = h;
    gl.viewport(0,0,width,height);
    resizeCallback.forEach(cb=>{ cb(width,height); });
  };

  // Mesh and Material

  function buildMesh(verts, dim, nrm) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
    return _=>{
      gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
      const stride = 4*(dim+nrm);
      gl.vertexAttribPointer(0,dim,gl.FLOAT,false,stride,0);
      gl.enableVertexAttribArray(0);
      if(nrm > 0) {
        const offset = 4*dim;
        gl.vertexAttribPointer(1,nrm,gl.FLOAT,false,stride,offset);
        gl.enableVertexAttribArray(1);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP,0,verts.length/(dim+nrm));
    };
  }
  const rect = buildMesh([-1,-1,1,-1,-1,1,1,1], 2, 0);
  const groundMesh = frameCount=>{
    const pss = [];
    let ps = [];
    const n = frameCount;
    const w = 1.0, l = 0.15, h = 0.025;
    ps = [];
    for(let i=0;i<=n;i++) {
      ps.push(-w, h, i);
      ps.push(-w+l, h, i);
    }
    pss.push(ps);
    ps = [];
    for(let i=0;i<=n;i++) {
      ps.push(-w+l, -h, i);
      ps.push(w-l, -h, i);
    }
    pss.push(ps);
    ps = [];
    for(let i=0;i<=n;i++) {
      ps.push(w-l, h, i);
      ps.push(w, h, i);
    }
    pss.push(ps);
    // Combine
    ps = [];
    for(let i=0;i<pss.length;i++) {
      let us = pss[i];
      for(let j=0;j<3;j++) ps.push(us[j]);
      for(let j=0;j<us.length;j++) ps.push(us[j]);
      for(let j=0;j<3;j++) ps.push(us[us.length-3+j]);
    }
    return buildMesh(ps, 3, 0);
  };
  const particleMesh = count=>{
    const pss = [];
    for(let i=0;i<count;i++) {
      let ps = [];
      ps.push(-1, -1, i);
      ps.push(+1, -1, i);
      ps.push(-1, +1, i);
      ps.push(+1, +1, i);
      pss.push(ps);
    }
    // Combine
    ps = [];
    for(let i=0;i<pss.length;i++) {
      let us = pss[i];
      for(let j=0;j<3;j++) ps.push(us[j]);
      for(let j=0;j<us.length;j++) ps.push(us[j]);
      for(let j=0;j<3;j++) ps.push(us[us.length-3+j]);
    }
    return buildMesh(ps, 3, 0);
  };
  const trailMesh = (count,frames)=>{
    const pss = [];
    for(let i=0;i<count;i++) {
      let ps = [];
      for(let j=0;j<frames;j++) {
        ps.push(-1, j, i);
        ps.push(+1, j, i);
      }
      pss.push(ps);
    }
    // Combine
    ps = [];
    for(let i=0;i<pss.length;i++) {
      let us = pss[i];
      for(let j=0;j<3;j++) ps.push(us[j]);
      for(let j=0;j<us.length;j++) ps.push(us[j]);
      for(let j=0;j<3;j++) ps.push(us[us.length-3+j]);
    }
    return buildMesh(ps, 3, 0);
  };

  function buildMaterial(vs,fs,mesh,params) {
    const prec = "#version 300 es\nprecision mediump float;\n";
    function buildShader(type,src) {
      const s = gl.createShader(type);
      gl.shaderSource(s,prec+src);
      gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    function buildProgram(v,f) {
      const p = gl.createProgram();
      gl.attachShader(p,v);
      gl.attachShader(p,f);
      gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
        console.error(gl.getProgramInfoLog(p));
      }
      return p;
    }
    const v = buildShader(gl.VERTEX_SHADER,vs);
    const f = buildShader(gl.FRAGMENT_SHADER,fs);
    const p = buildProgram(v,f);
    const locs = {};
    params.push("resolution");
    params.push("time");
    params.push("randSeed");
    params.forEach(pa=>{
      locs[pa] = gl.getUniformLocation(p,pa);
    });
    function setting(name, ix, n, args) {
      if(args.length == 1 && args[0].texture !== undefined) {
        gl.activeTexture(gl.TEXTURE0 + ix);
        gl.bindTexture(gl.TEXTURE_2D, args[0].texture);
        gl.uniform1i(locs[name], ix);
      } else {
        const func = "uniform" + n + "fv";
        const as = [];
        for(let i=0;i<args.length;i++)as.push(args[i]);
        gl[func](locs[name],as);
      }
    }
    let task = [];
    const o = _=>{
      gl.useProgram(p);
      task.forEach(t=>{t();});
      task = [];
      setting("resolution", 0, 2, [1,height/width]);
      const sec = (new Date() - startTime) / 1000;
      setting("time", 0, 1, [sec]);
      setting("randSeed", 0, 1, [randSeed]);
      gl.bindAttribLocation(p,0,"vertex");
      gl.bindAttribLocation(p,1,"normal");
      mesh();
    };
    for(let i=0;i<params.length;i++) {
      const l = params[i];
      const j = i;
      o[l] = function() {
        task.push(_=>{setting(l, j, arguments.length, arguments);});
      };
      o[l].v2 = function(a) {
        task.push(_=>{setting(l, j, 2, a);});
      };
      o[l].v4 = function(a) {
        task.push(_=>{setting(l, j, 4, a);});
      }
    }
    return o;
  }

  // FrameBuffers

  const clone = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  void main() {
      vec2 uv = coord * 0.5 + 0.5;
      vec3 col = texture(tex, uv).rgb;
      fragColor = vec4(col,1);
  }
  `,rect,["tex"]);

  const RenderBuffer = _=>{
    const rb = gl.createRenderbuffer();
    let w = width, h = height;
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    const samples = Math.min(8, gl.getParameter(gl.MAX_SAMPLES));
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const drb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, drb);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT16, w, h);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, drb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);

    const ofb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ofb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      resize: (nw,nh)=>{
        w = nw, h = nh;
        gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
        gl.bindRenderbuffer(gl.RENDERBUFFER, drb);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT16, w, h);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      },
      render: e=>{
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.depthMask(false);
        e();
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, ofb);
        gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      use: _=>{
        return { texture: tex };
      },
      copyCanvas: _=>{
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, front);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
    };
  };
  const LoopBuffer = _=>{
    const buffers = [RenderBuffer(), RenderBuffer()];
    resizeCallback.push((nw,nh)=>{
      buffers[1].resize(nw,nh);
      buffers[1].render(_=>{
        clone.tex(buffers[0].use());
        clone();
      });
      buffers[0].resize(nw,nh);
      buffers[0].render(_=>{
        clone.tex(buffers[1].use());
        clone();
      });
    });
    return {
      render: e=>{
        const target = buffers.pop();
        target.render(e);
        buffers.unshift(target);
      },
      use: _=>{
        return buffers[0].use();
      }
    };
  };

  o.front = RenderBuffer();
  o.copyCanvas = o.front.copyCanvas;
  resizeCallback.push((nw,nh)=>{
    o.front.resize(nw,nh);
  });
  o.LoopBuffer = LoopBuffer;

  // Data Buffer

  const DataBuffer = (w,h)=>{
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA32F, w, h);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);

    const ofb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ofb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
      render: e=>{
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        gl.viewport(0,0,w,h);
        e();
        gl.viewport(0,0,width,height);
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, ofb);
        gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      use: _=>{
        return { texture: tex };
      },
      pixels: (yi,hi)=>{
        const b = new Float32Array(w*hi*4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.readPixels(0, yi, w, hi, gl.RGBA, gl.FLOAT, b);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return b;
      },
      set: (hi,c)=>{
        const lw = c.length < w ? c.length : w;
        const lh = Math.ceil(c.length / w / 4);
        const lc = new Float32Array(lw*lh*4);
        lc.set(c);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, hi, lw, lh, gl.RGBA, gl.FLOAT, lc);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    };
  };
  o.DataBuffer = DataBuffer;
  const DataLoopBuffer = (w,h)=>{
    const buffers = [DataBuffer(w,h), DataBuffer(w,h)];
    return {
      render: e=>{
        const target = buffers.pop();
        target.render(e);
        buffers.unshift(target);
      },
      use: _=>{
        return buffers[0].use();
      },
      pixels: (yi,hi)=>{
        return buffers[0].pixels(yi,hi);
      }
    };
  };
  o.DataLoopBuffer = DataLoopBuffer;

  const library = `
  uniform vec2 resolution;
  uniform float time;
  uniform float randSeed;

  float saturate(float x) {
    return clamp(x,0.,1.);
  }
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453 + randSeed);
  }
  float noise(float t, float s) {
    float lv = rand(vec2(floor(t+0.)*0.01,s));
    float uv = rand(vec2(floor(t+1.)*0.01,s));
    return mix(lv,uv,smoothstep(0.,1.,fract(t)))*2.-1.;
  }
  `;

  o.clone = clone;

  o.blend = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform sampler2D original;
  out vec4 fragColor;
  void main() {
      vec2 colUV = coord * 0.5 * vec2(1,-1) + 0.5;
      vec3 col = texture(tex, colUV).rgb;
      vec2 origUV = coord * 0.505 + 0.5;
      vec3 orig = texture(original, origUV).rgb;
      fragColor = vec4(mix(col, orig, 0.5),1);
  }
  `,rect,["tex", "original"]);

  o.color = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  in vec2 coord;
  uniform vec4 color;
  out vec4 fragColor;
  void main() {
      fragColor = color;
  }
  `,rect,["color"]);

  o.additive = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
  }
  `,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform sampler2D self;
  uniform float scale;
  uniform vec2 pixelRes;
  out vec4 fragColor;
  void main() {
    vec3 col = texture(self, coord*0.5+0.5).rgb;
    vec2 pixUV = (coord*0.5+0.5) * scale * pixelRes - 0.5;
    pixUV = floor(pixUV) + smoothstep(vec2(0.),vec2(1.),fract(pixUV));
    col += texture(tex, (pixUV+0.5) / pixelRes).rgb * 0.2;
    fragColor = vec4(col,1);
  }
  `,rect,["tex","self","scale","pixelRes"]);

  o.minimize = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
  }
  `,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform vec2 pixelRes;
  out vec4 fragColor;
  void main() {
    vec2 center = (coord*0.5+0.5) * 2.0 * pixelRes;
    vec3 col = vec3(0.);
    col += texture(tex, (center + vec2(+1,+1)) / pixelRes).xyz;
    col += texture(tex, (center + vec2(-1,+1)) / pixelRes).xyz;
    col += texture(tex, (center + vec2(+1,-1)) / pixelRes).xyz;
    col += texture(tex, (center + vec2(-1,-1)) / pixelRes).xyz;
    col /= 4.0;
    fragColor = vec4(col,1);
  }
  `,rect,["tex","pixelRes"]);

  o.postprocess = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
  }
  `,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform sampler2D overlay;
  out vec4 fragColor;
  ${library}
  vec2 distort(vec2 u, int i) {
    float l = length(u);
    l -= l*l*float(i)*0.005;
    return normalize(u) * l;
  }
  void main() {
    vec3 col = vec3(0.), weight = vec3(0.0);

    // for(int i=0;i<16;i++) {
    //   vec3 w = pow(cos((vec3(0,1,-1)/3. + float(i)/16.0)*3.1415926535*2.)*0.5+0.5,vec3(1.4));
    //   w *= 1. - pow(float(i)/16.*2.-1., 2.0);
    //   col += texture(tex, distort(coord,i)*0.5+0.5).rgb * w;
    //   weight += w;
    // }
    // col /= weight;
    // col = pow(col, vec3(2.));

    col = vec3(0.1);
    vec3 bloom = texture(tex, coord*0.5+0.5).rgb;
    vec3 original = texture(overlay, coord*0.5*vec2(1,-1)+0.5).rgb;
    col += mix(bloom, original, 0.5) * 1.5;

    float dist = 3.0;
    float vignette = pow(normalize(vec3(coord*resolution,dist)).z,4.);
    col *= vignette;
    col = floor(col*255.+rand(coord))/255.;
    fragColor = vec4(col,1);
  }
  `,rect,["tex","overlay"]);

  o.synthParams = (samples, unitNotes, grains)=>{
    if(samples/4*grains < unitNotes*grains*4) {
      console.error("Unit Limit Exceeded");
    }
    o.granular = buildMaterial(`
  in vec2 vertex;
  out vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
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

    o.accum = buildMaterial(`
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

  return o;
};
