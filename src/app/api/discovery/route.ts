import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
    // Get local IP addresses to help the mobile app identify the server
    const networkInterfaces = os.networkInterfaces();
    const addresses = [];

    for (const interfaceName of Object.keys(networkInterfaces)) {
        const networkInterface = networkInterfaces[interfaceName];
        if (networkInterface) {
            for (const addr of networkInterface) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    addresses.push(addr.address);
                }
            }
        }
    }

    return NextResponse.json({
        service: 'odsm-server',
        status: 'online',
        hostname: os.hostname(),
        ips: addresses,
        timestamp: new Date().toISOString()
    });
}
