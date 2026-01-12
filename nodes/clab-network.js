/**
 * CompuLab Network Node
 * Consolidated node for network diagnostics
 */

const NetworkHelper = require('../lib/network-helper');

module.exports = function(RED) {
    
    function ClabNetworkNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const network = new NetworkHelper();

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'ping';
            
            try {
                let result;
                
                switch (action) {
                    case 'ping':
                        const pingHost = msg.host || msg.payload?.host || config.host;
                        if (!pingHost) throw new Error('Host required');
                        node.status({ fill: 'blue', shape: 'ring', text: `Ping ${pingHost}...` });
                        result = await network.ping(pingHost, {
                            count: msg.count || config.count || 4,
                            timeout: msg.timeout || config.timeout || 5
                        });
                        node.status({ fill: result.alive ? 'green' : 'red', shape: 'dot', text: result.alive ? `${result.rtt.avg?.toFixed(1)}ms` : 'Unreachable' });
                        break;
                        
                    case 'dns':
                        const hostname = msg.hostname || msg.payload?.hostname || msg.payload || config.hostname;
                        if (!hostname) throw new Error('Hostname required');
                        node.status({ fill: 'blue', shape: 'ring', text: `DNS ${hostname}...` });
                        result = await network.dnsLookup(hostname, { type: msg.type || config.dnsType || 'A' });
                        node.status({ fill: result.success ? 'green' : 'yellow', shape: 'dot', text: result.records[0] || 'No records' });
                        break;
                        
                    case 'reverse-dns':
                        const ip = msg.ip || msg.payload?.ip || msg.payload;
                        if (!ip) throw new Error('IP required');
                        result = await network.reverseDns(ip);
                        node.status({ fill: result.success ? 'green' : 'yellow', shape: 'dot', text: result.hostnames[0] || 'Not found' });
                        break;
                        
                    case 'traceroute':
                        const traceHost = msg.host || msg.payload?.host || config.host;
                        if (!traceHost) throw new Error('Host required');
                        node.status({ fill: 'blue', shape: 'ring', text: `Traceroute ${traceHost}...` });
                        result = await network.traceroute(traceHost, { maxHops: msg.maxHops || config.maxHops || 30 });
                        node.status({ fill: result.reached ? 'green' : 'yellow', shape: 'dot', text: `${result.totalHops} Hops` });
                        break;
                        
                    case 'port-check':
                        const portHost = msg.host || msg.payload?.host || config.host;
                        const port = msg.port || msg.payload?.port || config.port;
                        if (!portHost || !port) throw new Error('Host and port required');
                        node.status({ fill: 'blue', shape: 'ring', text: `Check ${portHost}:${port}...` });
                        result = await network.checkPort(portHost, parseInt(port), msg.timeout || config.portTimeout || 5000);
                        node.status({ fill: result.open ? 'green' : 'red', shape: 'dot', text: result.open ? `Open (${result.responseTime}ms)` : 'Closed' });
                        break;
                        
                    case 'http-check':
                        const url = msg.url || msg.payload?.url || msg.payload || config.url;
                        if (!url) throw new Error('URL required');
                        node.status({ fill: 'blue', shape: 'ring', text: 'HTTP Check...' });
                        result = await network.checkHttp(url, { timeout: msg.timeout || config.httpTimeout || 10000 });
                        node.status({ fill: result.ok ? 'green' : 'red', shape: 'dot', text: result.statusCode ? `${result.statusCode} (${result.responseTime}ms)` : 'Error' });
                        break;
                        
                    case 'routes':
                        result = await network.getRoutes();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} routes` });
                        break;
                        
                    case 'arp':
                        result = await network.getArpTable();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} entries` });
                        break;
                        
                    case 'speed-test':
                        node.status({ fill: 'blue', shape: 'ring', text: 'Speed Test...' });
                        result = await network.speedTest({ url: msg.url || config.speedTestUrl });
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? `${result.speedMbps} Mbps` : 'Error' });
                        break;
                        
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                msg.payload = result;
                msg.action = action;
                node.send(msg);
                
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                node.error(err.message, msg);
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }
    
    RED.nodes.registerType('clab-network', ClabNetworkNode);
};
