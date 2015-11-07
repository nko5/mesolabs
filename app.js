var express = require('express');
var app = express();
var ROT = require('./libs/rot');

//Create a static file server
app.configure(function() {
  app.use(express.static(__dirname + '/public'));
});
var floors = [];
floors[0] = 0;
floors[1] = 2525;

// routes
app.get('/seeds/:level', function(req, res) {
  var level = req.params.level;
  var seed = floors[level];
  if (!seed) {
    seed = new Date().getMilliseconds();
    floors[level] = seed;
  }
  res.send({seed: seed});
});

var port = 8080;
app.listen(port);
console.log('Express server started on port %s', port);
