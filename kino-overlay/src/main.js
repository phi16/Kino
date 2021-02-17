document.oncontextmenu = _=>false;

const Kino = require('kino-core');

// Renderer
const container = document.getElementById("container");
Kino.container(container);
window.addEventListener("resize", Kino.resize);
const visual = require('./visual')(Kino);
Kino.L.add("Launched.");
Kino.L.propShow(false);

Kino.I.keyboard.use(document);

require('./connect')(Kino, visual);

const openvr = require('node-openvr');
const overlay = openvr.VR_Init(openvr.EVRApplicationType.Overlay);
window.openvr = openvr;
window.overlay = overlay;
