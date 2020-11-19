module.exports = {
  sensel: _=>{
    let domain = e=>({ x: e.clientX, y: e.clientY });
    let state = "release", pos = { x:0, y:0 }, force = 0;
    document.addEventListener("mousedown",e=>{
      if(e.button != 0) return;
      pos = domain(e);
      if(pos.active) {
        state = "start";
        force = 0;
      }
    });
    document.addEventListener("mousemove",e=>{
      if(state == "move") {
        pos = domain(e);
      }
    });
    document.addEventListener("mouseup",e=>{
      if(state == "move" || state == "start") {
        state = "end";
        pos = domain(e);
      }
    });
    return {
      frame: cb=>{
        function f(s) {
          cb({ contact: cb=>{
            cb({
              id: 0, x: pos.x, y: pos.y,
              state: s,
              force: force, area: 3.14*40*40,
              orientation: 0, major_axis: 40, minor_axis: 40
            });
          }});
        }
        if(state == "start") {
          state = "move";
          f(0x1); // START
        } else if(state == "move") {
          force += (500 - force) / 4.0;
          f(0x2); // MOVE
        } else if(state == "end") {
          f(0x3); // END
          state = "release";
        }
      },
      domain: (x,y,w,h,s)=>{
        domain = e=>{
          const o = {
            x: (e.clientX-x)/s,
            y: (e.clientY-y)/s
          };
          if(0 <= o.x && o.x < w && 0 <= o.y && o.y < h) o.active = true;
          return o;
        };
      }
    }
  },
  nanoPad: cb=>{
    const keys = "q1w2e3r4t5y6u7i8";
    const pressed = Array(16);
    pressed.fill(false);
    document.addEventListener("keydown",e=>{
      const i = keys.indexOf(e.key);
      if(i != -1 && !pressed[i]) {
        pressed[i] = true;
        cb({ data: [ 0x90, (i+4)%16, 100 ] });
      }
    });
    document.addEventListener("keyup",e=>{
      const i = keys.indexOf(e.key);
      if(i != -1 && pressed[i]) {
        pressed[i] = false;
        cb({ data: [ 0x80, (i+4)%16, 0x80 ] });
      }
    });
  }
};
