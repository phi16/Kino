module.exports = Kino=>{
  const app = require('express')();
  const server = require('http').createServer(app);
  const io = require('socket.io')(server);
  let ms = null;
  io.on("connection", socket=>{
    Kino.L.add("Observer found.");
    socket.on("disconnect", _=>{
      Kino.L.add("Observer left.");
    });
    const C = Kino.C(socket);

    if(ms == null) {
      ms = new MediaStream();
      const visualStream = Kino.visualCanvas.captureStream();
      const audioStream = Kino.S.audioStream();
      ms.addTrack(visualStream.getTracks()[0]);
      ms.addTrack(audioStream.getTracks()[0]);
    }
    C.addStream(ms);
  });
  server.listen(3000);
};
