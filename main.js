var fs = require('fs');
var path = require('path');
var request = require('request');

const ConfigHandler = require('./lib/config.js');
const config = ConfigHandler.getConfig();


var express = require('express')
var favicon = require('serve-favicon')
var session = require('express-session')
var cors = require('cors')

// express stuff
var rest = express()

//cors
rest.use(cors())


rest.set('views', './views/pages')
rest.set('view engine', 'pug');
rest.use(express.static(__dirname + '/html'));
rest.use(favicon(path.join(__dirname, 'html', 'favicon.ico')))

// Session config
rest.use(session({
    secret: config.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 36000000
    }
}))

// JSON
rest.use(express.json());


// Main
rest.get('/', function(req, res) {
    var data = {};
    data.config = config;
    data.timespan = req.session.timespan ? req.session.timespan : 24;
    res.render('index', data);
});

// websocket
var WebSocketServer = require('websocket').server;
var http = require('http');

// Printer
rest.get('/plotter', function (req, res) {
    var data = {};
    data.config = config;
    // res.render('printer', data);
    res.json(data);
});


// Status
rest.get('/status', function (req, res) {
    var result = {};

    const { spawn } = require('child_process');

    const child = spawn('wpa_cli', ['-i','wlan0','status']);

    child.stdout.on('data', (data) => {
        let cmdres = data.toString().split("\n");
        let status = {};
        cmdres.forEach((l)=>{
            let p=l.split("=");
            if (p.length==2) status[p[0].trim()]=p[1].trim()
        })
        result.wifi_status = status;
        result.success=true;
        console.log(`stdout:\n${data}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    child.on('error', (error) => {
        console.error(`error: ${error.message}`);
    });

    child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        res.json(result);
    });

});

rest.get('/plot', function (req, res) {
    var data = {
        success: false
    };
    
    

    const { spawn } = require('child_process');

    const child = spawn('./send2plt', ['./spooler/file.hpgl']);

    child.stdout.on('data', (data) => {
        console.log(`stdout:\n${data}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    child.on('error', (error) => {
        console.error(`error: ${error.message}`);
    });

    child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });

    data.success=true;
    res.json(data);
    /*
    const { exec } = require('child_process');
    exec('./send2plt ./spooler/file.hpgl', (err, stdout, stderr) => {
        if (err) {
            console.log(err);
            data.errorcode = err.code;
            data.err = err;
            
            res.json(data);
            // node couldn't execute the command
            return;
        }

        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        data.success=true;
        
        res.json(data);
    });
    */
    

});

rest.post('/file', function (req, res) {
    var data = {
        success: false
    };
    
    
    if (req.body.data){
        let x = req.body.data.split(',');
        if (x[0]=='data:application/postscript;base64'){
            fs.writeFileSync(
                path.join('.','spooler','file.eps'),
                buf = Buffer.from(x[1], 'base64')
            );
            

            let input = path.join('.','spooler','file.eps');
            let output = path.join('.','spooler','file.hpgl');
            
            const { exec } = require('child_process');
            console.log('pstoedit-f plot-hpgl '+input+' '+output);
            exec('pstoedit -f plot-hpgl '+input+' '+output, (err, stdout, stderr) => {
                if (err) {
                    console.log(err);
                    // node couldn't execute the command
                    return;
                }

                // the *entire* stdout and stderr (buffered)
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);

                data.success=true;
                data.hpgl=fs.readFileSync(output).toString();

                const { exec } = require('child_process');
                console.log('pstoedit-f plot-hpgl '+input+' '+output);
                exec('./simplify '+output, (err, stdout, stderr) => {
                    if (err) {
                        console.log(err);
                        // node couldn't execute the command
                        return;
                    }

                    // the *entire* stdout and stderr (buffered)
                    console.log(`stdout: ${stdout}`);
                    console.log(`stderr: ${stderr}`);

                    data.success=true;
                    data.hpgl=fs.readFileSync(output).toString();
                    data.info=JSON.parse(fs.readFileSync(output+'.info.json').toString());
                    res.json(data);
                });

                // res.json(data);
            });

            
        }
    }
    
});

// starting rest
if (config.public) {
    rest.listen(config.port, function() {
        console.log((new Date()) + " REST is listening on port %d in %s mode", config.port, "public");
    });
} else {
    rest.listen(config.port, 'localhost', function() {
        console.log((new Date()) + " REST is listening on port %d in %s mode", config.port, "localhost");
    });
}

// websocket
var server = http.createServer(function (request, response) {
    // process HTTP request. Since we're writing just WebSockets
    // server we don't have to implement anything.
});
server.listen(config.websocket_port, function () {
    console.log((new Date()) + " Websocket is listening on port " +
        config.websocket_port);
});

// create the server
wsServer = new WebSocketServer({
    httpServer: server
});

var websockt_clients = [];

// WebSocket server
wsServer.on('request', function (request) {
    console.log((new Date()) + ' Connection from origin ' + request.origin + '.');
    var connection = request.accept(null, request.origin);
    var index = websockt_clients.push(connection) - 1;

    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function (message) { });

    connection.on('close', function (connection) {
        console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.");
        websockt_clients.splice(index, 1);
    });
});

function broadcastMsg(json) {
    for (var i = 0; i < websockt_clients.length; i++) {
        websockt_clients[i].sendUTF(JSON.stringify(json));
    }
}