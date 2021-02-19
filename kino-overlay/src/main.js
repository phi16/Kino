document.oncontextmenu = _=>false;

const Kino = require('kino-core');
Kino.L.toConsole();

// Renderer
const container = document.getElementById("container");
const stream = require('./stream')(Kino);
Kino.L.add("Launched.");

Kino.I.keyboard.use(document);

require('./connect')(Kino, stream);
