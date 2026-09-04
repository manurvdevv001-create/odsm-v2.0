const dgram = require('dgram');
const server = dgram.createSocket('udp4');

// MDNS standard UDP port and address
const MDNS_PORT = 5353;
const MDNS_ADDRESS = '224.0.0.251';

server.on('listening', () => {
    server.addMembership(MDNS_ADDRESS);
    console.log("Broadcasting 'odsm.local' to your Canalbox network... Press Ctrl+C to stop.");
});

server.on('message', (msg, rinfo) => {
    // Simple check if something is looking for odsm.local
    if (msg.toString().includes('odsm')) {
        // Broadcasts your PC's IP (192.168.1.67) back to the network
        const response = Buffer.from(`odsm.local A 192.168.1.67`);
        server.send(response, 0, response.length, MDNS_PORT, MDNS_ADDRESS);
    }
});

server.bind(MDNS_PORT);