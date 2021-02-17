module.exports = Kino=>{
  const o = {};

  const R = Kino.R;
  const G = Kino.G;
  const container = document.getElementById("container");
  const video = document.createElement("video");
  container.appendChild(video);
  video.autoplay = true;
  const videoBuffer = G.RenderBuffer();
  o.setStream = s=>{
    Kino.L.add("Set stream " + s.id);
    video.srcObject = s;
  };

  Kino.uiRender(_=>{
    R.clear();
    videoBuffer.copyCanvas(video);
  });

  const vert = G.vert;
  const rect = G.rect;
  const present = G.buildMaterial(vert,`
  in vec2 coord;
  uniform sampler2D tex;
  uniform sampler2D overlay;
  out vec4 fragColor;
  void main() {
    vec3 col = texture(tex, coord*0.5*vec2(1,-1)+0.5).rgb;
    col += texture(overlay, coord*0.5*vec2(1,-1)+0.5).rgb;
    fragColor = vec4(col,1);
  }
  `,rect,["tex","overlay"]);

  Kino.glRender(ui=>{
    present.tex(videoBuffer.use());
    present.overlay(ui.use());
    present();
  });

  return o;
};
