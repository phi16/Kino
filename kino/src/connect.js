module.exports = Kino=>{
  const o = {};
  const { desktopCapturer } = require('electron');

  async function useScreen() {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    const source = sources[0];
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    });
    return stream;
  };
  function useWindow() {
    const stream = Kino.visualCanvas.captureStream();
    return stream;
  };
  let retainVisualStream = useWindow;

  let audioTrack = null, visualTrack = null;
  function getAudioTrack(c) {
    if(audioTrack) return audioTrack;
    const audioStream = Kino.S.audioStream();
    audioTrack = audioStream.getTracks()[0];
    return audioTrack;
  }
  async function getVisualTrack(c) {
    if(visualTrack) return visualTrack;
    const visualStream = await retainVisualStream();
    visualTrack = visualStream.getTracks()[0];
    return visualTrack;
  }

  const cons = {};
  async function addConnection(k,C) {
    cons[k] = C;
    C.addTrack("audio", getAudioTrack());
    C.addTrack("visual", await getVisualTrack());
  }
  function removeConnection(k,C) {
    delete cons[k];
  }
  o.switch = b=>{
    retainVisualStream = b ? useScreen : useWindow;
    if(visualTrack) {
      visualTrack.stop();
      visualTrack = null;
      getVisualTrack().then(newVisual=>{
        Object.values(cons).forEach(C=>{
          C.removeTrack("visual");
          C.addTrack("visual", newVisual);
        });
      });
    }
  };

  const app = require('express')();
  const server = require('http').createServer(app);
  const io = require('socket.io')(server);
  io.on("connection", socket=>{
    Kino.L.add("Observer found.");
    const C = Kino.C(socket);
    const k = Math.random();
    addConnection(k,C);
    socket.on("disconnect", _=>{
      Kino.L.add("Observer left.");
      removeConnection(k,C);
    });
  });
  server.listen(3000);
  return o;
};
