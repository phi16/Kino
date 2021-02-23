module.exports = Kino=>{
  const o = {};
  const { desktopCapturer } = require('electron');
  let ms = null, currentVisualTrack = null;
  function useVisual(stream) {
    if(currentVisualTrack) {
      ms.removeTrack(currentVisualTrack);
      currentVisualTrack.stop();
    }
    currentVisualTrack = stream.getTracks()[0];
    ms.addTrack(currentVisualTrack);
  }
  function useScreen() {
    desktopCapturer.getSources({ types: ['screen'] }).then(async sources=>{
      const source = sources[0];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: 1280, maxWidth: 1280,
            minHeight: 720, maxHeight: 720
          }
        }
      });
      useVisual(stream);
    });
  };
  function useWindow() {
    const stream = Kino.visualCanvas.captureStream();
    useVisual(stream);
  };
  let retainVisualStream = useWindow;
  o.switch = b=>{
    retainVisualStream = b ? useScreen : useWindow;
    if(ms) retainVisualStream();
  };
  function getStream() {
    if(ms == null) {
      ms = new MediaStream();
      const audioStream = Kino.S.audioStream();
      ms.addTrack(audioStream.getTracks()[0]);
    }
    retainVisualStream();
    return ms;
  };

  const app = require('express')();
  const server = require('http').createServer(app);
  const io = require('socket.io')(server);
  io.on("connection", socket=>{
    Kino.L.add("Observer found.");
    socket.on("disconnect", _=>{
      Kino.L.add("Observer left.");
    });
    const C = Kino.C(socket);

    const ms = getStream();
    // TODO: it doesn't add a delayed track to stream
    C.addStream(ms);
  });
  server.listen(3000);
  return o;
};
