document.oncontextmenu = _=>false;

const canvas = document.getElementById("canvas");
const container = document.getElementById("container");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener("resize",resize);
resize();

const senselLib = require('node-sensel');
const sensel = senselLib.open();
sensel.startScanning();
sensel.setContactsMask(senselLib.ContactsMask.ALL);

const process = _=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = "rgb(32,32,32)";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.scale(3,3);
  sensel.frame(f=>{
    f.contact(c=>{
      ctx.strokeStyle = "rgb(64,64,64)";

      ctx.beginPath();
      ctx.rect(c.min_x, c.min_y, c.max_x-c.min_x, c.max_y-c.min_y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(c.peak_x, c.peak_y, 1, 0, Math.PI*2);
      ctx.stroke();

      ctx.strokeStyle = "rgb(128,128,128)";
      let p = Math.exp(-c.force*0.002);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.major_axis*p, c.minor_axis*p, (c.orientation+90)*Math.PI/180, 0, Math.PI*2);
      ctx.stroke();

      ctx.strokeStyle = "rgb(192,192,192)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.major_axis, c.minor_axis, (c.orientation+90)*Math.PI/180, 0, Math.PI*2);
      ctx.stroke();
    });
  });
  ctx.restore();
  requestAnimationFrame(process);
};

process();

