/*
 * Tests the defined typings for the module. This code is not intended to make
 * sense as an actual executable program; instead, it tests that common use
 * cases of the library compile without typing errors and that the correct
 * types are inferred where necessary.
 */

/// <reference types="node" />
import * as packet from 'dns-packet';
import * as multicastDns from './index';

let mdns = multicastDns.default();
let mdnsWithOptions = multicastDns.default({
    interface: 'lo0',
    ip: '127.0.0.1',
    loopback: false,
    multicast: true,
    port: 1234,
    ttl: 500,
    reuseAddr: true
});

let callback = (err: any) => {
    if (err) {
        console.log('Failed to send mDNS query');
    } else {
        console.log('query sent');
    }
};

let rinfo = {
    address: '169.254.1.1',
    family: 'ipv4',
    port: 5353
};

let queryPacket: packet.Packet = {
    questions: [{
        name: 'testing.local',
        type: 'A'
    }]
};

let responsePacket: packet.Packet = {
    type: 'response',
    answers: [{
        type: 'A',
        name: 'testing.local',
        data: '127.1.2.3'
    }]
};

namespace QueryTests {
    {
        // query just using a name
        mdns.query('testing.local');
        mdns.query('testing.local', callback);

        // query using a name and a type
        mdns.query('testing.local', 'AAAA');
        mdns.query('testing.local', 'AAAA', callback);

        // query using a name and a type, on a specific address
        mdns.query('testing.local', 'SRV', rinfo);
        mdns.query('testing.local', 'SRV', rinfo, callback);

        // query using a packet object
        mdns.query(queryPacket);

        // query using a list of questions
        mdns.query([
            { name: 'testing.local', type: 'A' },
            { name: 'testing.local', type: 'AAAA' },
            { name: 'testing.local', type: 'SRV' }
        ]);
    }
}

namespace SendTests {
    {
        mdns.send(queryPacket);
        mdns.send(queryPacket, callback);

        mdns.send(responsePacket, rinfo);
        mdns.send(responsePacket, rinfo, callback);
    }
}

namespace RespondTests {
    {
        mdns.respond(responsePacket);
        mdns.respond(responsePacket, callback);

        mdns.respond(responsePacket, rinfo);
        mdns.respond(responsePacket, rinfo, callback);
    }
}

namespace EventTests {
    {
        // capture a query response
        mdns.on('response', (response) => {
            console.log('got a response packet:', response);
            response.answers!.forEach((answer) => {
                // based on the answer type, we should be able to infer the correct
                // data payload type
                switch (answer.type) {
                    case 'A':
                        console.log('Answer for A lookup' + answer.data);
                        break;
                    case 'SRV':
                        console.log('Answer for SRV lookup: '
                            + '[' + answer.data.target + ':'
                            + answer.data.port);
                    default:
                        console.log('Answer for some other type:' + answer.type);
                }
            });
        });

        // capture a query
        mdns.on('query', (query) => {
            console.log('got a query packet:', query);
            query.questions!.forEach((question) => {
                if (question.type === 'A') {
                    console.log('query is for a hostname to address mapping');
                }
            });
        });

    }
}

namespace DestroyTests {
    {
        mdns.destroy();
        mdns.destroy(callback);
    }
}
