var express = require('express');
var app = express();
var ROT = require('./libs/rot');

//Create a static file server
app.configure(function() {
  app.use(express.static(__dirname + '/public'));
});

// routes
app.get('/seeds/:floor', function(req, res) {
  // @todo seedの値を返す。指定されたfloorのseedがなければgenerateして返す。
});

var port = 8080;
app.listen(port);
console.log('Express server started on port %s', port);
