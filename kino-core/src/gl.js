module.exports = canvas=>{
  const startTime = new Date();
  const randSeed = Math.random();

  const gl = canvas.getContext("webgl2");
  gl.getExtension("EXT_color_buffer_float");
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE,gl.ONE,gl.ONE);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.clearColor(0.2,0.2,0.2,1);

  const o = {};
  let width = 1, height = 1;
  const resizeCallback = [];
  o.resize = (w,h)=>{
    width = w, height = h;
    gl.viewport(0,0,width,height);
    resizeCallback.forEach(cb=>{ cb(width, height); });
  };

  // Mesh and Material

  function buildMesh(verts, struct) {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
    let offset = 0;
    let size = 0;
    const attribs = [];
    for(let i=0;i<struct.length/2;i++) {
      const dim = struct[i*2+1];
      const stride = 4 * dim;
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,dim,gl.FLOAT,false,stride,offset);
      size += dim;
      offset += stride;
      attribs.push(struct[i*2+0]);
    }
    gl.bindVertexArray(null);
    const elems = verts.length/size;

    return p=>{
      for(let i=0;i<attribs.length;i++) {
        gl.bindAttribLocation(p, i, attribs[i]);
      }
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,elems);
    };
  };
  const rect = buildMesh([-1,-1,1,-1,-1,1,1,1], ["vertex", 2]);

  let targetResolution = null;
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
        const type = args.constructor.name;
        let as = null;
        if(type == "Array" || type == "Float32Array") {
          as = args;
        } else if(type == "Object") {
          as = [];
          for(let i=0;i<args.length;i++)as.push(args[i]);
        } else {
          console.log("Argument Type Mismatched: " + type);
          as = args;
        }
        gl[func](locs[name],as);
      }
    }
    let task = [];
    const o = _=>{
      gl.useProgram(p);
      task.forEach(t=>{t();});
      task = [];
      setting("resolution", 0, 2, targetResolution ? targetResolution : [width,height]);
      const sec = (new Date() - startTime) / 1000;
      setting("time", 0, 1, [sec]);
      setting("randSeed", 0, 1, [randSeed]);
      mesh(p);
    };
    for(let i=0;i<params.length;i++) {
      const l = params[i];
      const j = i;
      o[l] = function() {
        task.push(_=>{setting(l, j, arguments.length, arguments);});
      };
      o[l].v1 = function(a) {
        task.push(_=>{setting(l, j, 1, a);});
      };
      o[l].v2 = function(a) {
        task.push(_=>{setting(l, j, 2, a);});
      };
      o[l].v4 = function(a) {
        task.push(_=>{setting(l, j, 4, a);});
      };
    }
    return o;
  }

  // FrameBuffers

  const defaultVert = `
  in vec2 vertex;
  out vec2 coord;
  void main() {
      coord = vertex;
      gl_Position = vec4(vertex,0,1);
  }
  `;

  const clone = buildMaterial(defaultVert,`
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
      copyCanvas: cvs=>{
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, cvs);
        gl.generateMipmap(gl.TEXTURE_2D);
      }
    };
  };
  o.RenderBuffer = RenderBuffer;
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
        targetResolution = [w,h];
        e();
        targetResolution = null;
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
      pixels: (wi,hi)=>{
        const b = new Float32Array(wi*hi*4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.readPixels(0, 0, wi, hi, gl.RGBA, gl.FLOAT, b);
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
      pixels: (wi,hi)=>{
        return buffers[0].pixels(wi,hi);
      }
    };
  };
  o.DataLoopBuffer = DataLoopBuffer;

  o.library = `
  uniform vec2 resolution;
  uniform float time;
  uniform float randSeed;

  float saturate(float x) {
    return clamp(x,0.,1.);
  }
  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453 + randSeed);
  }
  `;
  o.vert = defaultVert;
  o.buildMesh = buildMesh;
  o.buildMaterial = buildMaterial;
  o.clone = clone;
  o.rect = rect;

  // Auxiliary Materials

  o.color = buildMaterial(defaultVert,`
  in vec2 coord;
  uniform vec4 color;
  out vec4 fragColor;
  void main() {
      fragColor = color;
  }
  `,rect,["color"]);

  return o;
};
