var request = window.superagent;
var socket = io();

var Game = {
  width: 95,
  height: 30,
  level: 1,
  display: null,
  map: {},
  drawnMap: {},
  fovData: {},
  player: null,
  engine: null,
  others: {},
  messages: {},
  
  init: function(level) {
    this.display = new ROT.Display({width: this.width, height: this.height});
    this.display.setOptions({
      fontFamily: "Cousine",
      spacing: 1.2
    });
    document.getElementById("game").appendChild(this.display.getContainer());
    this.level = !level ? 1 : level;
    
    var that = this;
    this._getSeed(function(seed, messages, max) {
      that._showLevel(max);
      that.messages = messages;
      ROT.RNG.setSeed(seed);
      that._generateMap();
      that.player.checkMessages();


      var scheduler = new ROT.Scheduler.Simple();
      scheduler.add(that.player, true);
      that.engine = new ROT.Engine(scheduler);
      that.engine.start();
      
      var data = {
        lvl: that.level,
        loc: {x: that.player._x, y: that.player._y}
      }
      socket.emit("join", data);
      document.getElementById("input").focus();
    });
  },
  
  _getSeed: function(callback) {
    request
     .get("/seeds/" + this.level)
     .end(function(err, res) {
       if (err) throw err;
       return callback(res.body.seed, res.body.messages, res.body.max);
     });
  },
  
  _showLevel: function(max) {
    var str = "";
    if (parseInt(this.level / 10) % 10 !==1) {
      if (this.level % 10 === 1) {
        str = this.level + "st";
      } else if (this.level % 10 === 2) {
        str = this.level + "nd";
      } else if (this.level % 10 === 3) {
        str = this.level + "rd";
      } else {
        str = this.level + "th";
      }
    } else {
        str = this.level + "th";
    }
    str += " (of " + max + ")";
    str = this.level + "/" + max;
    document.getElementById("level").textContent = str;
  },
  
  _reset: function() {
    window.removeEventListener("keydown", this.player);
    document.getElementById("game").lastChild.remove();
    socket.emit("leave", this.level);
    this.display = null;
    this.map = {};
    this.drawnMap = {};
    this.fovData = {};
    this.player = null;
    this.engine = null;
    this.others = {};
    this.messages = {};
  },
  
  nextLevel: function() {
    this._reset();
    this.init(this.level + 1);
  },
  
  over: function() {
    window.removeEventListener("keydown", this.player);
    Game.engine.lock();
    var str = "%c{red}G A M E  O V E R !!";
    Game.display.drawText(32, 20, str);
    document.getElementById("input").focus();
  },
  
  _generateMap: function() {
    var digger = new ROT.Map.Digger(this.width, this.height);
    var freeCells = [];
    
    var digCallback = function(x, y, value) {
      var key = x + "," + y;
      this.fovData[key] = value;
      if (value) {
        this.map[key] = "#";
      } else {
        this.map[key] = ".";
        freeCells.push(key);
      }
    }
    digger.create(digCallback.bind(this));
    
    this._generateMessages();
    this._generateGoal(freeCells);
//    this._drawWholeMap();
    this._createPlayer(freeCells);
  },
  
  _generateGoal: function(freeCells) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    this.map[freeCells[index]] = ">";
  },
  
  _generateMessages: function() {
    Object.keys(this.messages).forEach(function(key) {
      Game.map[key] = "+"; //"\u2755";
    });
  },

  _drawWholeMap: function() {
    for(var key in this.map) {
      var parts = key.split(",");
      var x = parseInt(parts[0]);
      var y = parseInt(parts[1]);
      this.display.draw(x, y, this.map[key]);
    }
  },
  
  _createPlayer: function(freeCells) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    var parts = freeCells[index].split(",");
    var x = parseInt(parts[0]);
    var y = parseInt(parts[1]);
    this.player = new Player(x, y);
  }
}

var Player = function(x, y) {
  this._x = x;
  this._y = y;
  this._draw();
//  window.addEventListener("keydown", this);
}

Player.prototype._draw = function() {
  this._drawFov();
  this._drawOthers();
  Game.display.draw(this._x, this._y, "@", "#ff0");
}

Player.prototype._drawOthers = function() {
  Object.keys(Game.others).forEach(function(key) {
    var loc = Game.others[key];
    if (Game.drawnMap[loc.x + "," + loc.y]) {
      Game.display.draw(loc.x, loc.y, "@", "#999");
    }
  });
}

Player.prototype._drawFov = function() {
  var lightPasses = function(x, y) {
    var key = x + "," + y;
    if (key in Game.fovData) {
      return (Game.fovData[key] == 0);
    } 
    return false;
  }
  
  var fov = new ROT.FOV.PreciseShadowcasting(lightPasses);
  fov.compute(this._x, this._y, 6, function(x, y, r, visibility) {
    // var ch = (r ? "" : "@");
    // var color = (Game.fovData[x + "," + y] ? "#aa0" : "#660");
    // Game.display.draw(x, y, ch, "#fff", color);
    Game.display.draw(x, y, Game.map[x + "," + y]);
    Game.drawnMap[x + "," + y] = true;
  });
}

Player.prototype.act = function() {
  Game.engine.lock();
  window.addEventListener("keydown", this);
}

Player.prototype.handleEvent = function(e) {
  var keyMap = {};
  keyMap[ROT.VK_UP] = 0;
  keyMap[ROT.VK_RIGHT] = 1;
  keyMap[ROT.VK_DOWN] = 2;
  keyMap[ROT.VK_LEFT] = 3;
  var code = e.keyCode;
  if (!(code in keyMap)) return;
  
  var diff = ROT.DIRS[4][keyMap[code]];
  var newX = this._x + diff[0];
  var newY = this._y + diff[1];
  var newKey = newX + ","+ newY;
  if (Game.map[newKey] === "#") return;
  socket.emit("move", {
    oldX: this._x, oldY: this._y,
    x: newX, y: newY
  });
  
  Game.display.draw(this._x, this._y, Game.map[this._x + "," + this._y]);
  this._x = newX;
  this._y = newY;
  this._draw();
  
  if (this.checkGoal()) {
    return Game.nextLevel();
  }
  this.checkMessages();
  window.removeEventListener("keydown", this);
  Game.engine.unlock();

}

Player.prototype.checkGoal = function() {
  var key = this._x + "," + this._y;
  return Game.map[key] ===  ">";
}

Player.prototype.checkMessages = function() {
  var key = this._x + "," + this._y;
  var messages = Game.messages[key];
  if (messages) {
    var html = '<blockquote>';
    messages.forEach(function(msg) {
      html += '<p>' + msg + '</p>';
    });
    html += '</blockquote>';
    document.getElementById("messages").innerHTML = html;
  } else {
    document.getElementById("messages").innerHTML = '';
  }
}

socket.on('timer', function(msg) {
  if (msg === 1) {
    msg = "1sec.";
  } else {
    msg = msg + "secs.";
  }
  document.getElementById("timer").textContent = msg;
});

socket.on('over', function(msg) {
  document.getElementById("timer").textContent = "0sec.";
  Game.over();
});

socket.on('others', function(others) {
  if (others.id === socket.id) return;
  var old = others.loc.oldX + "," + others.loc.oldY;
  var key = others.loc.x + "," + others.loc.y;
  
  if (Game.drawnMap[old] && !(Game.player._x === others.loc.oldX && Game.player._y === others.loc.oldY)) {
    Game.display.draw(others.loc.oldX, others.loc.oldY, Game.map[old]);
  }
  if (Game.drawnMap[key] && !(Game.player._x === others.loc.x && Game.player._y === others.loc.y)) {
    Game.display.draw(others.loc.x, others.loc.y, "@", "#999");
  }
  Game.others[others.id] = {x: others.loc.x, y: others.loc.y};
});

socket.on('others over', function(others) {
  if (others.id === socket.id) return;
  var key = others.loc.x + "," + others.loc.y;
  
  if (Game.drawnMap[key]) {
    Game.display.draw(others.loc.x, others.loc.y, Game.map[key]);
  }
  delete Game.others[others.id];
});

function postMessage() {
  var input = document.getElementById("input").value;
  var data = {
    loc: Game.player._x + "," + Game.player._y,
    message: input
  };
  socket.emit("message", data);
  document.getElementById("input").value = "";
  return false;
}

socket.on('message', function(data) {
  var messages = Game.messages[data.loc];
  if (!messages) {
    messages = [];
    Game.map[data.loc] = "+";
  }
  messages.push(data.message);
  Game.messages[data.loc] = messages;
  Game.player.checkMessages();
});

window.onload = function(){
  Game.init();
};