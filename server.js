var express = require('express');
var cookieParser = require('cookie-parser');
var uuid = require('node-uuid');
var extend = require('util')._extend;
var path = require('path');
var mysql = require('mysql');
//externalize cookie secret
var credentials = require('./credentials.js');
var agents = {};
var app = express();

//TODO: update 'what' at every location.

var connection = mysql.createConnection({
  host     : 'mysql.eecs.ku.edu',
  user     : 'chogan',
  password : '581!!'
});

connection.connect();
connection.query('use chogan');

app.use(cookieParser(credentials.cookieSecret));
app.use(express.static(path.join(__dirname, 'public')));

app.use(require('express-session')({
	secret: credentials.cookieSecret,
	resave: true,
	saveUninitialized: true,
	genid: uuid.v1
}));

app.get('/', function(req, res){
	agents[req.session.id] = {
		"location": "strong-hall",
		"inventory": [],
		"campus": [{ 
			"id": "strong-hall",
			"where": "StrongHall.jpg",
			"next": {"east": "eaton-hall", "south": "dole-institute"},
			"text": "Please log in."
		}],
	}
	res.status(200);
	res.sendFile(__dirname + "/index.html");
});

app.get('/:id', function(req, res){
	var agent = req.session.id;
	var inventory = agents[agent].inventory;
	var campus= agents[agent].campus;
	
	if (req.params.id == "inventory") {
	    res.set({'Content-Type': 'application/json'});
	    res.status(200);
	    res.send(inventory);
	    return;
	}
	
	if (agents[agent].location == "jail") {
		res.set({'Content-Type': 'application/json'});
	    res.status(200);
	    res.send(campus[campus.length - 1]);
	    return;
	}
	
	for (var i in campus) {
		if (req.params.id == campus[i].id) {
		    res.set({'Content-Type': 'application/json'});
		    res.status(200);
		    agents[agent].location = campus[i].id;
		    res.send(campus[i]);
		    return;
		}
	}
	res.status(404);
	res.send("not found, sorry");
});

app.get('/:id/interaction', function (req, res) {
	var agent = req.session.id;
	var peopleHere = [];
	var location = req.params.id;

	for(var i in agents) {
		if(agents[i].location.id == location && i != agent) {
			peopleHere.push(i);
		}
	}
	res.set({'Content-Type': 'application/json'});
	res.status(200);
	res.send(peopleHere);
	return;
});

app.get('/images/:name', function (req, res) {
	res.status(200);
	res.sendFile(__dirname + "/" + req.params.name);
});

app.delete('/:id/:item', function (req, res) {
	var agent = req.session.id;
	var campus = agents[agent].campus;
	var inventory = agents[agent].inventory; 
	for (var i in campus) {
		if (req.params.id == campus[i].id) {
		    res.set({'Content-Type': 'application/json'});
		    var ix = -1;
		    if (campus[i].what !== undefined) {
					ix = campus[i].what.indexOf(req.params.item);
		    }
		    if (ix >= 0) {
		      res.status(200);
					inventory.push(campus[i].what[ix]); // stash
				  res.send(inventory);
					campus[i].what.splice(ix, 1); // room no longer has this
					return;
		    }
		    res.status(200);
		    res.send([]);
		    return;
		}
	}
	res.status(404);
	res.send("location not found");
});

app.post('/login/:name', function (req, res) {
	
	var name = req.params.name;
	var campus = [
		{ 
		  "id": "lied-center",
			"where": "LiedCenter.jpg",
			"next": {"east": "eaton-hall", "south": "dole-institute"},
			"text": "You are outside the Lied Center."
		},
		{ 
			"id": "dole-institute",
			"where": "DoleInstituteofPolitics.jpg",
			"next": {"east": "allen-fieldhouse", "north": "lied-center"},
			"text": "You take in the view of the Dole Institute of Politics. This is the best part of your walk to Nichols Hall."
		},
		{ 
			"id": "eaton-hall",
			"where": "EatonHall.jpg",
			"next": {"east": "snow-hall", "south": "allen-fieldhouse", "west": "lied-center"},
			"text": "You are outside Eaton Hall. You should recognize here."
		},
		{ 
			"id": "snow-hall",
			"where": "SnowHall.jpg",
			"next": {"east": "strong-hall", "south": "ambler-recreation", "west": "eaton-hall"},
			"text": "You are outside Snow Hall. Math class? Waiting for the bus?"
		},
		{ 
			"id": "strong-hall",
			"where": "StrongHall.jpg",
			"next": {"east": "outside-fraser", "north": "memorial-stadium", "west": "snow-hall"},
			"what": ["coffee"],
			"text": "You are outside Strong Hall."
		},
		{ 
			"id": "ambler-recreation",
			"where": "AmblerRecreation.jpg",
			"next": {"west": "allen-fieldhouse", "north": "snow-hall"},
			"text": "It's the starting of the semester, and you feel motivated to be at the Gym. Let's see about that in 3 weeks."
		},
		{ 
			"id": "outside-fraser",
		  "where": "OutsideFraserHall.jpg",
			"next": {"west": "strong-hall","north":"spencer-museum"},
			"what": ["basketball"],
			"text": "On your walk to the Kansas Union, you wish you had class outside."
		},
		{ 
			"id": "spencer-museum",
			"where": "SpencerMuseum.jpg",
			"next": {"south": "outside-fraser","west":"memorial-stadium", "east": "jail"},
			"what": ["art"],
			"text": "You are at the Spencer Museum of Art."
		},
		{ 
			"id": "memorial-stadium",
			"where": "MemorialStadium.jpg",
			"next": {"south": "strong-hall","east":"spencer-museum"},
			"what": ["ku flag"],
			"text": "Half the crowd is wearing KU Basketball gear at the football game."
		},
		{ 
			"id": "allen-fieldhouse",
			"where": "AllenFieldhouse.jpg",
			"next": {"north": "eaton-hall","east": "ambler-recreation","west": "dole-institute"},
			"text": "Rock Chalk! You're at the field house."
		},
		{ 
			"id": "jail",
		  "where": "Jail.jpg",
		  "next": {},
		  "text": "You've been put in prison!  Maybe you were framed..."
		}
    ];

	connection.query('SELECT * FROM Users WHERE Name = ?', [name], function(err, results) {
		if (results.length != 0) {
			connection.query('SELECT * FROM Inventory WHERE Name = ?', 
											 [name], function (err, inv) {
				console.log(name + " already in db.");
				agents[req.session.id] = {
				  "name": name,
				  "inventory": [inv[0]],//getInventory(inv)
				  "location": results[0].location,
				  "campus": campus
			  };
			});
			if(err) {
				console.log(err);
			}
		} else {
			//Add this user to the database.
			
			connection.query('INSERT INTO Users (Name, Location) VALUES (?, ?)',
							  [name, 'strong-hall'], function (err) {
			  	console.log(name + " inserted into db.");
			  	if(err) {
			  		console.log(err);
			  	}
			});
			connection.query('INSERT INTO Inventory (Name, Inventory) VALUES (?,?)',
							  [name, 'laptop'], function (err) {
				if(err) {
					console.log(err);
				}
			});

			//add this user to the agents in memory
			agents[req.session.id] = {
				"name": name,
				"inventory": ['laptop'],
				"location": "strong-hall",
				"campus": campus
			}
		}
	});

	res.set({'Content-Type': 'application/json'});
	res.status(200);
	res.send([]);
});

app.put('/logout/:name', function (req, res) {
	//TODO: Update the database with this user's info
	var agent = req.session.id;
	//Insert user's inventory
	for(var i in agents[agent].inventory){
		connection.query('UPDATE Inventory SET Name = ?, Inventory = ?',
						  [agents[agent].name, 
						   agents[agent].inventory[i]], function(err, rows, fields) {
		  if (err) throw err;
		});		
	}

	//Insert user's location
	connection.query('UPDATE Users SET Name = ?, Location = ?',
					  [agents[agent].name, 
					   agents[agent].location,
					  ], function(err, rows, fields) {
	  if (err) throw err;

	});

	//Remove agent from memory
	agents[req.session.id] = {};
	res.redirect('/');
});

app.put('/send/tojail/:cookie', function (req, res) {
	agents[req.params.cookie].location = "jail";
	agents[req.params.cookie].inventory = [];
	res.set({'Content-Type': 'application/json'});
	res.status(200);
	res.send([]);
});

app.put('/:id/:item', function (req, res) {
	var agent = req.session.id;
	var campus = agents[agent].campus;
	var inventory = agents[agent].inventory;
	for (var i in campus) {
		if (req.params.id == campus[i].id) {
				// Check you have this
				var ix = inventory.indexOf(req.params.item);
				if (ix >= 0) {
					dropbox(ix, campus[i], req);
					res.set({'Content-Type': 'application/json'});
					res.status(200);
					res.send([]);
				} else {
					res.status(404);
					res.send("you do not have this");
				}
				return;
		}
	}
	res.status(404);
	res.send("location not found");
});



app.listen(3000);



var dropbox = function(ix, room, req) {
	var agent = req.session.id;
	var campus = agents[agent].campus;
	var inventory = agents[agent].inventory;
	var item = inventory[ix];
	inventory.splice(ix, 1);	 // remove from inventory
	if (room.id == 'allen-fieldhouse' && item == "basketball") {
		room.text	+= " Someone found the ball so there is a game going on!";
		return;
	}
	if (room.id == 'outside-fraser' && item == 'ku flag') {
		room.text += " You brought the flag to Fraser!";
		return;
	}
	if (room.what === undefined) {
		room.what = [];
	}
	room.what.push(item);
};

/* param: inventory - a mysql query result
 * return: an array of strings
 */
function getInventory(rows) {
	var inv = [];
	for (var i in rows) {
		inv.push(rows[i].Inventory);
	}
	return inv;
}   

