var request = window.superagent;

var Game = {
  level: 1,
  display: null,
  map: {},
  fovData: {},
  player: null,
  engine: null,
  
  init: function(level) {
    var that = this;
    this.display = new ROT.Display({width: 80, height: 40});
    document.body.appendChild(this.display.getContainer());
    this.level = !level ? 1 : level;
    this._showLevel();
    
    this._getSeed(function(seed) {
      console.log(seed);
      ROT.RNG.setSeed(seed);
      that._generateMap();

      var scheduler = new ROT.Scheduler.Simple();
      scheduler.add(that.player, true);
      that.engine = new ROT.Engine(scheduler);
      that.engine.start();
    });
  },
  
  _getSeed: function(callback) {
    request
     .get("/seeds/" + this.level)
     .end(function(err, res) {
       if (err) throw err;
       return callback(res.body.seed);
     });
  },
  
  _showLevel: function() {
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
    
    document.getElementById("level").textContent = str;
  },
  
  _reset: function() {
    window.removeEventListener("keydown", this.player);
    document.body.lastChild.remove();
    this.display = null;
    this.map = {};
    this.fovData = {};
    this.player = null;
    this.engine = null;
  },
  
  nextLevel: function() {
    console.log("Level " + this.level + " GOAL!!");
    this._reset();
    this.init(this.level + 1);
  },
  
  _generateMap: function() {
    var digger = new ROT.Map.Digger(80, 40);
    var freeCells = [];
    
    var digCallback = function(x, y, value) {
      var key = x + "," + y;
      this.fovData[key] = value;
      if (value) {
        this.map[key] = "#"
      } else {
        this.map[key] = ".";
        freeCells.push(key);
      }
    }
    digger.create(digCallback.bind(this));
    
    this._generateGoal(freeCells);
//    this._drawWholeMap();
    this._createPlayer(freeCells);
  },
  
  _generateGoal: function(freeCells) {
    var index = Math.floor(ROT.RNG.getUniform() * freeCells.length);
    this.map[freeCells[index]] = ">";
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
  Game.display.draw(this._x, this._y, "@", "#ff0");
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
  fov.compute(this._x, this._y, 10, function(x, y, r, visibility) {
    // var ch = (r ? "" : "@");
    // var color = (Game.fovData[x + "," + y] ? "#aa0" : "#660");
    // Game.display.draw(x, y, ch, "#fff", color);
    Game.display.draw(x, y, Game.map[x + "," + y]);
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
  
  Game.display.draw(this._x, this._y, Game.map[this._x + "," + this._y]);
  this._x = newX;
  this._y = newY;
  this._draw();


  if (this.checkGoal()) {
    return Game.nextLevel();
  }
  window.removeEventListener("keydown", this);
  Game.engine.unlock();

}

Player.prototype.checkGoal = function() {
  var key = this._x + "," + this._y;
  return Game.map[key] ===  ">";
}