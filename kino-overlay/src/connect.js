module.exports = (Kino,stream)=>{
  const io = require('socket.io-client');
  const socket = io("http://localhost:3000");
  // const socket = io("http://192.168.10.9:3000");

  socket.on("connect", _=>{
    Kino.L.add("Connected to Kino.");
    socket.on("disconnect", _=>{
      Kino.L.add("Kino disconnected.");
    });
    const C = Kino.C(socket);
    C.onTrack(e=>{
      console.log(e);
      stream.setStream(e.streams[0]);
    });
  });
};
