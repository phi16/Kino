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
    const prec = "precision mediump float;\n";
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
    function setting(name, args) {
      if(args.length == 1 && args[0].texture !== undefined) {
        gl.uniform1i(locs[name], args[0].texture);
      } else {
        const func = "uniform" + args.length + "fv";
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
      setting("resolution",[1,height/width]);
      const sec = (new Date() - startTime) / 1000;
      setting("time", [sec]);
      setting("randSeed", [randSeed]);
      gl.bindAttribLocation(p,0,"vertex");
      gl.bindAttribLocation(p,1,"normal");
      mesh();
    };
    params.forEach(l=>{
      o[l] = function() {
        task.push(_=>{setting(l, arguments);});
      };
    });
    return o;
  }

  // FrameBuffers

  const clone = buildMaterial(`
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  varying vec2 coord;
  uniform sampler2D texture;
  void main() {
      vec2 uv = coord * 0.5 + 0.5;
      vec3 col = texture2D(texture, uv).rgb;
      gl_FragColor = vec4(col,1);
  }
  `,rect,["texture"]);

  let lastTexture = 0;
  const RenderBuffer = _=>{
    const textureIndex = lastTexture++;
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
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
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
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return { texture: textureIndex };
      },
      copyCanvas: _=>{
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
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
        clone.texture(buffers[0].use());
        clone();
      });
      buffers[0].resize(nw,nh);
      buffers[0].render(_=>{
        clone.texture(buffers[1].use());
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
    const textureIndex = lastTexture++;

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
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
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
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        return { texture: textureIndex };
      },
      pixels: hi=>{
        const b = new Float32Array(w*hi*4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.readPixels(0, 0, w, hi, gl.RGBA, gl.FLOAT, b);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return b;
      }
    };
  };
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
      pixels: hi=>{
        return buffers[0].pixels(hi);
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
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  varying vec2 coord;
  uniform sampler2D texture;
  uniform sampler2D original;
  void main() {
      vec2 colUV = coord * 0.5 * vec2(1,-1) + 0.5;
      vec3 col = texture2D(texture, colUV).rgb;
      vec2 origUV = coord * 0.505 + 0.5;
      vec3 orig = texture2D(original, origUV).rgb;
      gl_FragColor = vec4(mix(col, orig, 0.5),1);
  }
  `,rect,["texture", "original"]);

  o.color = buildMaterial(`
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  varying vec2 coord;
  uniform vec3 color;
  void main() {
      gl_FragColor = vec4(color,1);
  }
  `,rect,["color"]);

  o.additive = buildMaterial(`
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
  }
  `,`
  varying vec2 coord;
  uniform sampler2D texture;
  uniform sampler2D self;
  uniform float scale;
  uniform vec2 pixelRes;
  void main() {
    vec3 col = texture2D(self, coord*0.5+0.5).rgb;
    vec2 pixUV = (coord*0.5+0.5) * scale * pixelRes - 0.5;
    pixUV = floor(pixUV) + smoothstep(vec2(0.),vec2(1.),fract(pixUV));
    col += texture2D(texture, (pixUV+0.5) / pixelRes).rgb * 0.2;
    gl_FragColor = vec4(col,1);
  }
  `,rect,["texture","self","scale","pixelRes"]);

  o.minimize = buildMaterial(`
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
  }
  `,`
  varying vec2 coord;
  uniform sampler2D texture;
  uniform vec2 pixelRes;
  void main() {
    vec2 center = (coord*0.5+0.5) * 2.0 * pixelRes;
    vec3 col = vec3(0.);
    col += texture2D(texture, (center + vec2(+1,+1)) / pixelRes).xyz;
    col += texture2D(texture, (center + vec2(-1,+1)) / pixelRes).xyz;
    col += texture2D(texture, (center + vec2(+1,-1)) / pixelRes).xyz;
    col += texture2D(texture, (center + vec2(-1,-1)) / pixelRes).xyz;
    col /= 4.0;
    gl_FragColor = vec4(col,1);
  }
  `,rect,["texture","pixelRes"]);

  o.postprocess = buildMaterial(`
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
    coord = vertex;
    gl_Position = vec4(vertex,0,1);
  }
  `,`
  varying vec2 coord;
  uniform sampler2D texture;
  uniform sampler2D overlay;
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
    //   col += texture2D(texture, distort(coord,i)*0.5+0.5).rgb * w;
    //   weight += w;
    // }
    // col /= weight;
    // col = pow(col, vec3(2.));

    col = vec3(0.1);
    vec3 bloom = texture2D(texture, coord*0.5+0.5).rgb;
    vec3 original = texture2D(overlay, coord*0.5*vec2(1,-1)+0.5).rgb;
    col += mix(bloom, original, 0.5) * 1.5;

    float dist = 3.0;
    float vignette = pow(normalize(vec3(coord*resolution,dist)).z,4.);
    col *= vignette;
    col = floor(col*255.+rand(coord))/255.;
    gl_FragColor = vec4(col,1);
  }
  `,rect,["texture","overlay"]);

  o.granular = buildMaterial(`
  attribute vec2 vertex;
  varying vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `,`
  #define tau (2.*3.1415926535)
  #define sampleRate 48000.
  varying vec2 coord;
  uniform sampler2D texture;
  uniform vec2 offset;
  uniform float samples;
  uniform float frequency;
  uniform float window;
  float rand(vec2 co){
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
  }
  float noise0(float t, float s) {
    float r = floor(t);
    float f = fract(t);
    f = smoothstep(0., 1., f);
    float u0 = rand(vec2(r+0.,s)) - 0.5;
    float u1 = rand(vec2(r+1.,s)) - 0.5;
    return mix(u0, u1, f);
  }
  float inst0(float f, float t, float m, float o) {
    float rep = 1./f;
    float fac = mod(t,rep);
    float mult = m;
    float offset = t*o;
    return mix(
      noise0(fac*mult + offset, 1.),
      noise0((fac+rep)*mult + offset, 1.),
      smoothstep(0.,1.,1.-fac/rep));
  }
  float wave(float t) {
    return inst0(40.*4., t/4., 1000., 100.);
  }
  vec4 grain(vec4 p, vec4 q, vec4 t) {
    // p: Offset, Duration, PlayOffset, PlayDuration
    // q: Volume, WindowWidthRatio, 0, 0
    if(p.w == 0.) return vec4(0.);
    vec4 r = (t - p.z) / p.w;
    vec4 u = abs(r - 0.5);
    vec4 w = smoothstep(0., 0.5*q.y, 0.5-u);
    vec4 tt = p.x + p.y*r;
    return vec4(wave(tt.x), wave(tt.y), wave(tt.z), wave(tt.w)) * q.x * w;
  }
  void gen(float t, float d, float ch, inout vec4 p, inout vec4 q) {
    float dur = samples / sampleRate;
    p = vec4(mix(offset.x, offset.y, t/dur) + ch, 0.1, t, d);
    q = vec4(1., window, 0., 0.);
  }
  void main() {
    float dur = samples / sampleRate;
    float res = samples/4.;
    float paramLoc = fract((coord.y*0.5+0.5)*2.)/2.+.5;
    vec4 p0 = texture2D(texture, vec2(0.5/res, paramLoc));
    vec4 q0 = texture2D(texture, vec2(1.5/res, paramLoc));
    vec4 p1 = texture2D(texture, vec2(2.5/res, paramLoc));
    vec4 q1 = texture2D(texture, vec2(3.5/res, paramLoc));
    float t = (coord.x*0.5+0.5) * dur;
    if(coord.y > 0.) t = dur;
    float startTime = p1.z + p1.w * mix(1.0, 0.5, q1.y);
    float ch = paramLoc*100.;
    if(startTime < t) {
      float grainDur = 1.0/frequency;
      float singleDur = mix(1.0, 0.5, window) * grainDur;
      if(p1.w > grainDur) startTime = p1.z + p1.w - (grainDur - singleDur);
      float i = floor((t-startTime) / singleDur);
      gen(startTime+i*singleDur, grainDur, ch, p0, q0);
      if(i > 0.5) {
        i--;
        p1 = p0, q1 = q0;
        gen(startTime+i*singleDur, grainDur, ch, p0, q0);
      }
    }
    if(coord.y < 0.) {
      float dt = 1. / sampleRate;
      vec4 ts = t + vec4(0,1,2,3) * dt;
      vec4 v = grain(p0, q0, ts) + grain(p1, q1, ts);
      gl_FragColor = v*0.5;
    } else {
      int x = int((coord.x*0.5+0.5)*res);
      vec4 v = vec4(0);
      p0.z -= dur, p1.z -= dur;
      if(x == 0) v = p0;
      if(x == 1) v = q0;
      if(x == 2) v = p1;
      if(x == 3) v = q1;
      gl_FragColor = v;
    }
  }
  `,rect,["samples","texture","frequency","window","offset"]);

  return o;
};
