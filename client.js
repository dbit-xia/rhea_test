'use strict';
var container = require('runsa-rhea');
const _ = require('lodash');

var args = {
    // hosts:['192.168.14.105'],
    // ports:[5672],
    hosts: ['amqp01.nr01.runsasoft.com','amqp01.nr01.runsasoft.com'],
    ports: [56233,56242],
    // hosts: ['47.110.224.59'],
    // ports: [61616]
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
    username: 'admin',
    password: process.env.MQ_PASSWORD,
    // idle_time_out:50 * 1000
    //non_fatal_errors:['ECONNREFUSED']

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
    console.warn('connection_open OK',context.connection.socket._peername);
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
    receiver = connection.open_receiver('rwin_trade::rwin_trade-all');
    receiver.on('receiver_open', () => {
        console.warn('receiver_open OK');  //not print this line
    });
    receiver.on('message',(ctx)=>{
        console.log('收到消息',ctx.message);
    })
}
function addSender(){
    if (sender) return ;
    console.log('start open_sender...');
    sender = connection.open_sender({
        name: 'sender-' + Date.now(),
        autosettle: true, //必须设置为true,否则只能发送2048个消息
        target: {
            address: 'rwin-trade',
            timeout: 2
        }, source: {timeout: 2}, timeout: 2
        // snd_settle_mode:0 //0:发送到MQ,即收到accepted事件,1:收不到accepted事件
    });
    sender.on('settled',(ctx)=>{
        console.debug(`connection.on(settled)`, '消息发送成功:', ctx.delivery.tag);
    });
    sender.on('sendable', (ctx) => {
        sender.send({
            message_id:Date.now(), //header.messageID
            application_properties: {"app":"test"},
            message_annotations: {}, //{ "x-opt-delivery-delay": 1000 /*延时消息*/},
            body:JSON.stringify({a:123}),
            // delivery_count: 8,//未体现
            durable: 2 /*持久消息*/, //header.durable=true
            //group_id:"group_id", //_AMQ_GROUP_ID消息分组发送到同一个consumer,(如果filter匹配不上,则会导致消息一直不能消费,直到consumer关闭后才能被其它consumer消费)
            // user_id:'user_id', //JMSXUserID
            // to: 'to', //未体现
            // subject: 'subject', //JMSType
            // reply_to:'reply_to', //JMSReplyTo
            // correlation_id:'correlation_id', //JMSCorrelationID
            // content_type:'content_type', //JMS_AMQP_ContentType
            // content_encoding:'content_encoding', //JMS_AMQP_ContentEncoding
            absolute_expiry_time: Date.now() + 3 * 24 * 60 * 60 * 1000, //header.expiration 过期时间
            creation_time: Date.now(), //header.timestamp
            // group_sequence: 77, //JMSXGroupSeq
            // reply_to_group_id:'reply_to_group_id', //JMS_AMQP_ReplyToGroupID
            priority: 3, //header.priority
            first_acquirer: false
        },Date.now().toString());
        console.warn('sendable OK',sender.target.value[0].value); 
    });
}
// addReceiver();

connection.on('disconnected', function (context) {

    let {reconnecting,error} = context; //
    console.error(String(attempt),new Date().toString(),'artemis:connection.disconnected:', (error && error.message || error), (reconnecting ? ',reconnecting...' : ''));

    // if (reconnecting) {
    //     // setTimeout(() => {
    //     // addReceiver();
    //     addSender()
    //     // }, 1000); //wait 1second can success
    // }
});

connection.connect();
addReceiver();
addSender();

// console.warn('test 15672-->fail, 5672-->success');

