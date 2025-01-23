const fs = require('fs');
const path = require('path');
const request = require('request');
const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;

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

let linesTotal = 0;
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
rest.get('/plotter', async function (req, res) {
    var data = {};
    data.config = config;
    data.portsList = [];

    let ports = await SerialPort.list();
    ports.forEach((ports)=>{
        data.portsList.push(ports.comName);
    });
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
    };
    // const { spawn } = require('child_process');
    // const child = spawn('./send2plt', ['./spooler/file.hpgl']);

    const hpgl = fs.readFileSync('./spooler/file.hpgl', 'ascii')
    let lines = hpgl.split("\n");
    const tty = '/dev/ttyUSB0';
    const options = {
        autoOpen: false,
        xon: true,
        xoff: true

    }
    linesTotal = lines.length;

    
    
    function handleErrors (err) {
        if (err){ 
            console.error('handleErrors',err)
            data.success=false;
        }
    }
    function handleResponse(data) {
        console.log('Rx', data);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    



    const port = new SerialPort(tty, options, handleErrors);
    port.setEncoding('ascii');
    
    const parser = port.pipe(new Readline({
        delimiter: '\r\n',
        encoding: 'ascii',
    }));
    parser.on('data', handleResponse);
    
    port.on('open',(m)=>{
        console.log('open',tty,m);
        run();
    })
    port.on('error',(e)=>{
        console.log('error',tty,e);
    })
    port.open();

    async function run(){
    
        port.get( (error, data) => {
            console.log(error, data);
        })
    
        let cmd = lines.shift();
        port.write(cmd, handleErrors);

        if (data.success===false){
            port.close();
            res.json(data);
            return;
        }

        await sleep(25);
        // console.log(linesTotal,lines.length)
    
        if (lines.length>0){
            run();
        }else{
    
            //port.flush();
            await sleep(2000);
            port.close();
            console.log("finished");
            data.success=true;
            res.json(data);
        }
    
    }
    

    /*
    child.stdout.on('data', (data) => {
        data.success=true;
        console.log(`stdout:\n${data}`);
    });

    child.stderr.on('data', (data) => {
        data.success=false;
        console.error(`stderr: ${data}`);
    });

    child.on('error', (error) => {
        console.error(`error: ${error.message}`);
        data.success=false;
        child.kill();
    });

    child.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        res.json(data);
    });
    */

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