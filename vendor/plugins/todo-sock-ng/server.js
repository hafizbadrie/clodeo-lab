var express = require('express');
var sockjs  = require('sockjs');
var http    = require('http');

var sock = sockjs.createServer({});

var pool = [];

sock.on('connection', function(conn) {
	pool.push(conn);

    pool[pool.length-1].write(JSON.stringify({id:conn.id, status:"connect"}));
    conn.on('data', function(message) {
    	var id = conn.id;
    	/* broadcast message */
    	for(var i = 0; i < pool.length; i++){
    		if (pool[i].id != id) {
    			pool[i].write(JSON.stringify({ id: id, status:"data", text : message}));
    		}
    	}
    })
})

var app = express();
app.use(express.static(__dirname + '/public'));
var server = http.createServer(app);
sock.installHandlers(server, {prefix:'/sock'});
console.log('3001');
server.listen(3001);
