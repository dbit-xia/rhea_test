'use strict';
var container = require('rhea');
const _ = require('lodash');

var args = {
    hosts: ['localhost', 'localhost'],
    ports: [15672,5672]
};

var sender;
let successIndex=0;

var attempt = 0;
var connect_options = {
    connection_details: function() {
        var details = {
            port: args.ports.length ? args.ports[attempt % args.ports.length] : args.ports,
            host: args.hosts.length ? args.hosts[attempt % args.hosts.length] : args.hosts,
            timeout: 0
        };
        attempt++;
        return details;
    },
    // username: 'test',
    // password: '123456',
    // non_fatal_errors:['ECONNREFUSED']

};
connect_options.reconnect =function() {
    // console.log(attempt, attempt % args.ports.length);
    if ((attempt - successIndex) % args.ports.length === 0) {
        return Math.min(Math.floor((attempt - successIndex) / args.ports.length) * 1000, 5000);
    }
    return 0;
} ;


var connection = container.create_connection(connect_options);

connection.on('connection_open', function (context) {
    console.warn('connection_open OK');
    attempt = attempt % args.ports.length;
    successIndex = attempt;
});


process.on('uncaughtException',(err)=> {
    console.error(err && err.message || err.condition)
});


let receiver;
function addReceiver(){
    if (receiver) return ;
    console.log('start open_receiver...');
    receiver = connection.open_receiver('examples');
    receiver.on('receiver_open', () => {
        console.warn('receiver_open OK');  //not print this line
    });
}
// addReceiver();

connection.on('disconnected', function (context) {

    let {reconnecting,error} = context; //
    console.error(String(attempt),new Date().toString(),'artemis:connection.disconnected:', (error && error.message || error), (reconnecting ? ',reconnecting...' : ''));

    if (reconnecting) {
        // setTimeout(() => {
        addReceiver();
        // }, 1000); //wait 1second can success
    }
});

connection.connect();

console.warn('test 15672-->fail, 5672-->success');

