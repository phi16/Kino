module.exports = (Kino,visual)=>{
  const io = require('socket.io-client');
  const socket = io("http://192.168.10.9:3000");

  socket.on("connect", _=>{
    Kino.L.add("Connected to Kino.");
    socket.on("disconnect", _=>{
      Kino.L.add("Kino disconnected.");
    });
    const C = Kino.C(socket);

    C.pc.ontrack = e=>{
      visual.setStream(e.streams[0]);
    };
  });
};
