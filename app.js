var express = require('express');
var app = express();
var http = require('http').Server(app)
var io = require('socket.io')(http);

//Create a static file server
app.configure(function() {
  app.use(express.static(__dirname + '/public'));
});
var floors = [];
floors[0] = 0;
floors[1] = 2525;

var players = [];
players[0] = {};
players[1] = {};

// HTTP API
app.get('/seeds/:level', function(req, res) {
  var level = req.params.level;
  var seed = floors[level];
  if (!seed) {
    seed = new Date().getMilliseconds();
    floors[level] = seed;
    players[level] = {};
  }
  res.send({seed: seed});
});

var LIMIT = 90;

// WebSocket
io.on('connect', function(socket) {
  var level;
  var resetHandles;
  
  socket.on('join', function(msg) {
    var loc = msg.loc;
    level = msg.lvl;
    socket.emit('timer', LIMIT);
    resetHandles = timerStart(LIMIT, socket, level);
    socket.join(level);
    players[level][socket.id] = loc;
    Object.keys(players[level]).forEach(function(key) {
      socket.emit("others", {id: key, loc: players[level][key]});
    });
    io.in(level).emit("others", {id: socket.id, loc: loc});
  });
  
  socket.on('leave', function(lvl) {
    clearInterval(resetHandles.interval);
    clearTimeout(resetHandles.timeout);
    socket.leave(lvl);
    io.in(lvl).emit("others over", {id: socket.id, loc: players[lvl][socket.id]});
    delete players[lvl][socket.id];
  });
  
  socket.on('move', function(loc) {
    players[level][socket.id] = loc;
    
    io.in(level).emit("others", {id: socket.id, loc: loc});
  });
  
  socket.on('disconnect', function() {
    if (resetHandles) {
      clearInterval(resetHandles.interval);
      clearTimeout(resetHandles.timeout);
    }
    if (players && players[level] && players[level][socket.id]) {
      io.in(level).emit("others over", {id: socket.id, loc: players[level][socket.id]});
      delete players[level][socket.id];
    }
  });
});

function timerStart(limit, socket, level) {
  var interval = setInterval(function() {
    limit--;
    socket.emit('timer', limit);
  }, 1 * 1000);
  var timeout = setTimeout(function() {
    clearInterval(interval);
    delete players[level][socket.id];
    socket.emit('over');
  }, limit * 1000);
  return {
    interval: interval,
    timeout: timeout
  };
}

var port = 8080;
http.listen(port);
console.log('Express server started on port %s', port);
