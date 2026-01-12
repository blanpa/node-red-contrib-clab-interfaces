/**
 * CompuLab Network Diagnostic Helper
 * Netzwerk-Diagnose Funktionen für CompuLab IoT Gateways
 */

const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const dns = require('dns');
const dnsPromises = dns.promises;

class NetworkHelper {
    constructor() {}

    /**
     * Führt Ping aus
     */
    async ping(host, options = {}) {
        const count = options.count || 4;
        const timeout = options.timeout || 5;
        const interval = options.interval || 1;

        try {
            const { stdout, stderr } = await execAsync(
                `ping -c ${count} -W ${timeout} -i ${interval} ${host}`,
                { timeout: (count * timeout + 5) * 1000 }
            );

            const result = {
                success: true,
                host: host,
                packets: {
                    transmitted: 0,
                    received: 0,
                    loss: 100
                },
                rtt: {
                    min: null,
                    avg: null,
                    max: null
                },
                alive: false
            };

            // Parse Statistiken
            const statsMatch = stdout.match(/(\d+) packets transmitted, (\d+) received/);
            if (statsMatch) {
                result.packets.transmitted = parseInt(statsMatch[1]);
                result.packets.received = parseInt(statsMatch[2]);
                result.packets.loss = 100 - (result.packets.received / result.packets.transmitted * 100);
                result.alive = result.packets.received > 0;
            }

            // Parse RTT
            const rttMatch = stdout.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)/);
            if (rttMatch) {
                result.rtt.min = parseFloat(rttMatch[1]);
                result.rtt.avg = parseFloat(rttMatch[2]);
                result.rtt.max = parseFloat(rttMatch[3]);
            }

            result.raw = stdout;
            return result;

        } catch (e) {
            return {
                success: false,
                host: host,
                alive: false,
                error: e.message,
                packets: { transmitted: count, received: 0, loss: 100 }
            };
        }
    }

    /**
     * Führt Traceroute aus
     */
    async traceroute(host, options = {}) {
        const maxHops = options.maxHops || 30;
        const timeout = options.timeout || 5;

        try {
            const { stdout } = await execAsync(
                `traceroute -m ${maxHops} -w ${timeout} ${host}`,
                { timeout: maxHops * timeout * 1000 + 10000 }
            );

            const hops = [];
            const lines = stdout.split('\n').slice(1); // Skip header

            for (const line of lines) {
                const match = line.match(/^\s*(\d+)\s+(.+)/);
                if (match) {
                    const hopNum = parseInt(match[1]);
                    const hopData = match[2];
                    
                    // Parse hop details
                    const ipMatch = hopData.match(/\(([\d.]+)\)/);
                    const timeMatches = [...hopData.matchAll(/([\d.]+)\s*ms/g)];
                    
                    hops.push({
                        hop: hopNum,
                        host: hopData.split(/\s+/)[0].replace('*', ''),
                        ip: ipMatch ? ipMatch[1] : null,
                        times: timeMatches.map(m => parseFloat(m[1])),
                        timeout: hopData.includes('*')
                    });
                }
            }

            return {
                success: true,
                host: host,
                hops: hops,
                totalHops: hops.length,
                reached: hops.length > 0 && !hops[hops.length - 1].timeout,
                raw: stdout
            };

        } catch (e) {
            throw new Error(`Traceroute fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * DNS Lookup
     */
    async dnsLookup(hostname, options = {}) {
        const recordType = options.type || 'A';

        try {
            let result;
            
            switch (recordType.toUpperCase()) {
                case 'A':
                    result = await dnsPromises.resolve4(hostname);
                    break;
                case 'AAAA':
                    result = await dnsPromises.resolve6(hostname);
                    break;
                case 'MX':
                    result = await dnsPromises.resolveMx(hostname);
                    break;
                case 'TXT':
                    result = await dnsPromises.resolveTxt(hostname);
                    break;
                case 'NS':
                    result = await dnsPromises.resolveNs(hostname);
                    break;
                case 'CNAME':
                    result = await dnsPromises.resolveCname(hostname);
                    break;
                case 'PTR':
                    result = await dnsPromises.reverse(hostname);
                    break;
                default:
                    result = await dnsPromises.resolve(hostname, recordType);
            }

            return {
                success: true,
                hostname: hostname,
                type: recordType,
                records: Array.isArray(result) ? result : [result]
            };

        } catch (e) {
            return {
                success: false,
                hostname: hostname,
                type: recordType,
                error: e.message,
                records: []
            };
        }
    }

    /**
     * Reverse DNS Lookup
     */
    async reverseDns(ip) {
        try {
            const hostnames = await dnsPromises.reverse(ip);
            return {
                success: true,
                ip: ip,
                hostnames: hostnames
            };
        } catch (e) {
            return {
                success: false,
                ip: ip,
                error: e.message,
                hostnames: []
            };
        }
    }

    /**
     * Port Check (TCP)
     */
    async checkPort(host, port, timeout = 5000) {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();
            
            const startTime = Date.now();
            let resolved = false;

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                if (!resolved) {
                    resolved = true;
                    const responseTime = Date.now() - startTime;
                    socket.destroy();
                    resolve({
                        success: true,
                        host: host,
                        port: port,
                        open: true,
                        responseTime: responseTime
                    });
                }
            });

            socket.on('timeout', () => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve({
                        success: true,
                        host: host,
                        port: port,
                        open: false,
                        error: 'Timeout'
                    });
                }
            });

            socket.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve({
                        success: true,
                        host: host,
                        port: port,
                        open: false,
                        error: err.message
                    });
                }
            });

            socket.connect(port, host);
        });
    }

    /**
     * HTTP/HTTPS Check
     */
    async checkHttp(url, options = {}) {
        const timeout = options.timeout || 10000;
        const method = options.method || 'GET';

        try {
            const https = url.startsWith('https') ? require('https') : require('http');
            const urlObj = new URL(url);

            return new Promise((resolve) => {
                const startTime = Date.now();

                const req = https.request({
                    hostname: urlObj.hostname,
                    port: urlObj.port || (url.startsWith('https') ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: method,
                    timeout: timeout
                }, (res) => {
                    const responseTime = Date.now() - startTime;
                    
                    resolve({
                        success: true,
                        url: url,
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        responseTime: responseTime,
                        headers: res.headers,
                        ok: res.statusCode >= 200 && res.statusCode < 400
                    });
                });

                req.on('error', (err) => {
                    resolve({
                        success: false,
                        url: url,
                        error: err.message,
                        ok: false
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        url: url,
                        error: 'Timeout',
                        ok: false
                    });
                });

                req.end();
            });

        } catch (e) {
            return {
                success: false,
                url: url,
                error: e.message,
                ok: false
            };
        }
    }

    /**
     * Netzwerk Geschwindigkeitstest (einfach)
     */
    async speedTest(options = {}) {
        const testUrl = options.url || 'http://speedtest.tele2.net/1MB.zip';
        const timeout = options.timeout || 30000;

        try {
            const https = testUrl.startsWith('https') ? require('https') : require('http');
            
            return new Promise((resolve) => {
                const startTime = Date.now();
                let totalBytes = 0;

                const req = https.get(testUrl, { timeout: timeout }, (res) => {
                    res.on('data', (chunk) => {
                        totalBytes += chunk.length;
                    });

                    res.on('end', () => {
                        const duration = (Date.now() - startTime) / 1000; // Sekunden
                        const speedBps = totalBytes / duration;
                        const speedMbps = (speedBps * 8) / 1000000;

                        resolve({
                            success: true,
                            bytes: totalBytes,
                            duration: duration,
                            speedBps: speedBps,
                            speedMbps: speedMbps.toFixed(2),
                            speedKbps: (speedBps * 8 / 1000).toFixed(2)
                        });
                    });
                });

                req.on('error', (err) => {
                    resolve({
                        success: false,
                        error: err.message
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        error: 'Timeout'
                    });
                });
            });

        } catch (e) {
            return {
                success: false,
                error: e.message
            };
        }
    }

    /**
     * ARP Tabelle auslesen
     */
    async getArpTable() {
        try {
            const { stdout } = await execAsync('arp -n');
            
            const entries = [];
            const lines = stdout.split('\n').slice(1); // Skip header

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    entries.push({
                        ip: parts[0],
                        hwType: parts[1],
                        macAddress: parts[2],
                        flags: parts[3],
                        interface: parts[4]
                    });
                }
            }

            return {
                success: true,
                entries: entries,
                count: entries.length
            };

        } catch (e) {
            throw new Error(`ARP Tabelle fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Routing Tabelle auslesen
     */
    async getRoutes() {
        try {
            const { stdout } = await execAsync('ip route');
            
            const routes = [];
            const lines = stdout.split('\n').filter(l => l.trim());

            for (const line of lines) {
                const route = { raw: line };
                
                if (line.startsWith('default')) {
                    route.destination = 'default';
                    const viaMatch = line.match(/via ([\d.]+)/);
                    if (viaMatch) route.gateway = viaMatch[1];
                } else {
                    const destMatch = line.match(/^([\d./]+)/);
                    if (destMatch) route.destination = destMatch[1];
                }

                const devMatch = line.match(/dev (\S+)/);
                if (devMatch) route.interface = devMatch[1];

                const srcMatch = line.match(/src ([\d.]+)/);
                if (srcMatch) route.source = srcMatch[1];

                routes.push(route);
            }

            return {
                success: true,
                routes: routes,
                count: routes.length
            };

        } catch (e) {
            throw new Error(`Routing Tabelle fehlgeschlagen: ${e.message}`);
        }
    }
}

module.exports = NetworkHelper;
