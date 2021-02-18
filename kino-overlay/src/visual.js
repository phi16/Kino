module.exports = Kino=>{
  const o = {};

  const R = Kino.R;
  const G = Kino.G;
  const container = document.getElementById("container");
  const video = document.createElement("video");
  video.autoplay = true;
  container.appendChild(video);
  const videoBuffer = G.RenderBuffer();
  o.setStream = s=>{
    Kino.L.add("Set stream " + s.id);
    video.srcObject = s;
  };

  Kino.uiRender(_=>{
    R.clear();
    if(video.videoWidth > 0) videoBuffer.copyCanvas(video);
  });

  const vert = G.vert;
  const rect = G.rect;
  const library = G.library;
  const clone = G.clone;
  const color = G.color;

  const blend = G.buildMaterial(vert,`
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

  const additive = G.buildMaterial(vert,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform sampler2D self;
  uniform float scale;
  out vec4 fragColor;
  ${library}
  void main() {
    vec3 col = texture(self, coord*0.5+0.5).rgb;
    vec2 pixUV = (coord*0.5+0.5) * scale * resolution - 0.5;
    pixUV = floor(pixUV) + smoothstep(vec2(0.),vec2(1.),fract(pixUV));
    col += texture(tex, (pixUV+0.5) / resolution).rgb * 0.2;
    fragColor = vec4(col,1);
  }
  `,rect,["tex","self","scale"]);

  const minimize = G.buildMaterial(vert,`
  in vec2 coord;
  uniform sampler2D tex;
  out vec4 fragColor;
  ${library}
  void main() {
    vec2 center = (coord*0.5+0.5) * 2.0 * resolution;
    vec3 col = vec3(0.);
    col += texture(tex, (center + vec2(+1,+1)) / resolution).xyz;
    col += texture(tex, (center + vec2(-1,+1)) / resolution).xyz;
    col += texture(tex, (center + vec2(+1,-1)) / resolution).xyz;
    col += texture(tex, (center + vec2(-1,-1)) / resolution).xyz;
    col /= 4.0;
    fragColor = vec4(col,1);
  }
  `,rect,["tex"]);

  const postprocess = G.buildMaterial(vert,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform sampler2D overlay;
  uniform sampler2D ui;
  out vec4 fragColor;
  ${library}
  vec2 distort(vec2 u, int i) {
    float l = length(u);
    l -= l*l*float(i)*0.005;
    return normalize(u) * l;
  }
  void main() {
    vec3 col = vec3(0.), weight = vec3(0.0);

    col = vec3(0.1);
    vec3 bloom = texture(tex, coord*0.5+0.5).rgb;
    vec3 original = texture(overlay, coord*0.5*vec2(1,-1)+0.5).rgb;
    vec3 ui = texture(ui, coord*0.5*vec2(1,-1)+0.5).rgb;
    col += mix(bloom, original, 0.5) * 1.5;
    col += ui;

    float dist = 3.0;
    float ratio = resolution.x/resolution.y;
    float vignette = pow(normalize(vec3(coord.x*ratio,coord.y,dist)).z,2.);
    col *= vignette;
    col = floor(col*255.+rand(coord))/255.;
    fragColor = vec4(col,1);
  }
  `,rect,["tex","overlay","ui"]);

  const mainBuffer = G.LoopBuffer();
  const miniBuffer = G.LoopBuffer();
  const bloomBuffer = G.LoopBuffer();

  Kino.glRender(ui=>{
    mainBuffer.render(_=>{
      blend.tex(videoBuffer.use());
      blend.original(mainBuffer.use());
      blend();
    });
    miniBuffer.render(_=>{
      clone.tex(mainBuffer.use());
      clone();
    });
    bloomBuffer.render(_=>{
      color.color(0,0,0,1);
      color();
    });
    for(let i=0;i<8;i++) {
      bloomBuffer.render(_=>{
        additive.self(bloomBuffer.use());
        additive.tex(miniBuffer.use());
        additive.scale(Math.pow(2,-i));
        additive();
      });
      miniBuffer.render(_=>{
        minimize.tex(miniBuffer.use());
        minimize();
      });
    }
    postprocess.overlay(videoBuffer.use());
    postprocess.ui(ui.use());
    postprocess.tex(bloomBuffer.use());
    postprocess();
  });

  return o;
};
