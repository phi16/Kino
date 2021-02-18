module.exports = socket=>{
  const o = {};
  const config = { iceServers: [] };
  const pc = new RTCPeerConnection(config);
  pc.onicecandidate = ({candidate}) => {
    if(candidate) socket.emit("iceCand", candidate);
  };
  pc.onnegotiationneeded = async _=>{
    try {
      await pc.setLocalDescription(await pc.createOffer());
      socket.emit("offer", pc.localDescription);
    } catch(e) {
      console.error("RTC Error: " + e);
    }
  };
  socket.on("iceCand", candidate=>{
    pc.addIceCandidate(candidate);
  });
  let hasRemoteAnswer = false;
  socket.on("offer", async remoteDesc=>{
    if(remoteDesc.type == "offer") {
      await pc.setRemoteDescription(remoteDesc);
      await pc.setLocalDescription(await pc.createAnswer());
      socket.emit("offer", pc.localDescription);
    } else if(remoteDesc.type == "answer" && !hasRemoteAnswer) {
      await pc.setRemoteDescription(remoteDesc);
      hasRemoteAnswer = true;
    }
  });
  o.addStream = ms=>{
    ms.getTracks().forEach(track=>{
      pc.addTrack(track, ms);
    });
  };
  o.onTrack = cb=>{
    pc.ontrack = cb;
  };
  return o;
};
