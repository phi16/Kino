module.exports = canvas=>{
  const X = canvas.getContext("2d");

  const Hue = (h,l,d)=>{
    const a = h*Math.PI*2;
    let r = Math.cos(a+0)*0.5+0.5;
    let g = Math.cos(a+Math.PI*2/3)*0.5+0.5;
    let b = Math.cos(a-Math.PI*2/3)*0.5+0.5;
    r = (1-(1-r)*l) * d;
    g = (1-(1-g)*l) * d;
    b = (1-(1-b)*l) * d;
    r = Math.round(r*255);
    g = Math.round(g*255);
    b = Math.round(b*255);
    return "rgb(" + r + "," + g + "," + b + ")";
  };

  let lastShape = null;
  const Affine = _=>{
    const q = [];
    const f = {};
    f.with = cb=>{
      X.save();
      q.forEach(e=>{
        e(X);
      });
      cb();
      X.restore();
      lastShape = null;
    };
    f.translate = (x,y)=>{
      q.push(X=>X.translate(x,y));
      return f;
    };
    f.rotate = a=>{
      q.push(X=>X.rotate(a));
      return f;
    };
    f.scale = s=>{
      q.push(X=>X.scale(s,s));
      return f;
    };
    return f;
  };

  function shape(s) {
    const o = {
      fill: (h,l,d)=>{
        if(lastShape != o) {
          lastShape = o;
          s();
        }
        X.fillStyle = Hue(h,l,d);
        X.fill();
        return o;
      },
      stroke: (h,l,d,b)=>{
        if(lastShape != o) {
          lastShape = o;
          s();
        }
        X.strokeStyle = Hue(h,l,d);
        X.lineWidth = b;
        X.stroke();
        return o;
      },
      clip: (cb)=>{
        if(lastShape != o) {
          lastShape = o;
          s();
        }
        X.save();
        X.clip();
        cb();
        X.restore();
      }
    };
    return o;
  }

  const Drawing = _=>{
    const r = {};
    r.text = (t,x,y,s)=>{
      let align = "center";
      const o = {
        fill: (h,l,d)=>{
          lastShape = null;
          X.textAlign = align;
          X.fillStyle = Hue(h,l,d);
          X.font = s + "px Comfortaa";
          X.fillText(t,x,y);
          return o;
        },
        stroke: (h,l,d,b)=>{
          lastShape = null;
          X.textAlign = align;
          X.strokeStyle = Hue(h,l,d);
          X.lineWidth = b;
          X.font = s + "px Comfortaa";
          X.strokeText(t,x,y);
          return o;
        }
      };
      o.l = _=>{
        align = "left";
        return o;
      };
      o.r = _=>{
        align = "right";
        return o;
      };
      return o;
    };
    r.shape = s=>shape(_=>{
      X.beginPath();
      s(X);
    });
    r.poly = (x,y,s,n,a)=>shape(_=>{
      X.beginPath();
      for(let i=0;i<=n;i++) {
        const dx = Math.cos((i/n+a)*Math.PI*2), dy = Math.sin((i/n+a)*Math.PI*2);
        if(i == 0) X.moveTo(x+dx*s, y+dy*s);
        else X.lineTo(x+dx*s,y+dy*s);
      }
    });
    r.polyOutline = (x,y,s,n,a,v)=>shape(_=>{
      X.beginPath();
      for(let i=0;i<=n;i++) {
        const dx = Math.cos((i/n+a)*Math.PI*2), dy = Math.sin((i/n+a)*Math.PI*2);
        if(i == 0) X.moveTo(x+dx*s, y+dy*s);
        else X.lineTo(x+dx*s,y+dy*s);
      }
      s *= v;
      for(let i=n;i>-1;i--) {
        const dx = Math.cos((i/n+a)*Math.PI*2), dy = Math.sin((i/n+a)*Math.PI*2);
        if(i == n) X.moveTo(x+dx*s, y+dy*s);
        else X.lineTo(x+dx*s,y+dy*s);
      }
    });
    r.circle = (x,y,r)=>shape(_=>{
      X.beginPath();
      X.arc(x,y,r,0,2*Math.PI,false);
    });
    r.ellipse = (x,y,r0,r1,o)=>shape(_=>{
      X.beginPath();
      X.ellipse(x,y,r0,r1,o,0,2*Math.PI,false);
    });
    r.rect = (x,y,w,h)=>shape(_=>{
      X.beginPath();
      X.rect(x,y,w,h);
    });
    r.line = (x0,y0,x1,y1)=>shape(_=>{
      X.beginPath();
      X.moveTo(x0,y0);
      X.lineTo(x1,y1);
    });

    r.translate = (x,y)=>Affine().translate(x,y);
    r.rotate = a=>Affine().rotate(a);
    r.scale = s=>Affine().scale(s);
    r.blend = (m,cb)=>{
      const o = X.globalCompositeOperation;
      X.globalCompositeOperation = m;
      cb();
      X.globalCompositeOperation = o;
    };
    r.alpha = (a,cb)=>{
      const o = X.globalAlpha;
      X.globalAlpha = a;
      cb();
      X.globalAlpha = o;
    }
    r.measure = (t,s)=>{
      X.font = s + "px Comfortaa";
      return X.measureText(t).width;
    };
    return r;
  };

  const o = Drawing();
  o.X = X;
  o.resize = (w,h)=>{
    canvas.width = o.w = w;
    canvas.height = o.h = h;
  };
  o.clear = _=>{
    X.clearRect(0,0,o.w,o.h);
    X.fillStyle = "rgb(0,0,0)";
    X.fillRect(0,0,o.w,o.h);
    X.lineCap = X.lineJoin = "round";
  };

  return o;
};
