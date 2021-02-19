module.exports = Kino=>{
  const o = {};

  const R = Kino.R;
  const container = document.getElementById("container");
  const video = document.createElement("video");
  video.autoplay = true;
  container.appendChild(video);
  o.setStream = s=>{
    Kino.L.add("Set stream " + s.id);
    video.srcObject = s;
  };

  Kino.uiRender(_=>{
    R.clear();
    if(video.videoWidth > 0) {
      R.X.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, R.w, R.h);
    }
  });

  return o;
};
