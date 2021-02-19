module.exports = Kino=>{
  const o = {};

  const container = document.getElementById("container");
  const video = document.createElement("video");
  video.style = `
    width: 100%;
    margin-left: 50vw;
    margin-top: 50vh;
    transform: translate(-50%, -50%);
  `;
  video.autoplay = true;
  container.appendChild(video);
  o.setStream = s=>{
    Kino.L.add("Set stream " + s.id);
    video.srcObject = s;
  };
  return o;
};
