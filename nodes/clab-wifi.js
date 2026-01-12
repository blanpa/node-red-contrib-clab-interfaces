/**
 * CompuLab WiFi Node
 * Consolidated node for WiFi functions
 */

const WiFiHelper = require('../lib/wifi-helper');

module.exports = function(RED) {
    
    // WiFi Configuration Node
    function ClabWifiConfigNode(config) {
        RED.nodes.createNode(this, config);
        this.ssid = config.ssid;
        // Password is stored in this.credentials.password
    }
    RED.nodes.registerType('clab-wifi-config', ClabWifiConfigNode, {
        credentials: {
            password: { type: 'password' }
        }
    });
    
    // WiFi Control Node
    function ClabWifiNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const wifi = new WiFiHelper({ interface: config.interface });
        
        // Get WiFi config node if configured
        const wifiConfigNode = config.wifiConfig ? RED.nodes.getNode(config.wifiConfig) : null;

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'status';
            
            try {
                let result;
                
                switch (action) {
                    case 'status':
                        result = await wifi.getStatus();
                        node.status({ fill: result.connected ? 'green' : 'yellow', shape: 'dot', text: result.connection || 'Disconnected' });
                        break;
                        
                    case 'enable':
                        result = await wifi.enable();
                        node.status({ fill: 'green', shape: 'dot', text: 'Enabled' });
                        break;
                        
                    case 'disable':
                        result = await wifi.disable();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Disabled' });
                        break;
                        
                    case 'scan':
                        node.status({ fill: 'blue', shape: 'ring', text: 'Scanning...' });
                        result = await wifi.scan();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} networks` });
                        break;
                        
                    case 'connect':
                        // Priority: msg properties > WiFi Config node > error
                        let ssid = msg.ssid || msg.payload?.ssid;
                        let password = msg.password || msg.payload?.password;
                        
                        // If not in msg, try WiFi Config node
                        if (!ssid && wifiConfigNode) {
                            ssid = wifiConfigNode.ssid;
                            password = wifiConfigNode.credentials?.password;
                        }
                        
                        if (!ssid) throw new Error('SSID required (configure WiFi Config or send in msg)');
                        node.status({ fill: 'blue', shape: 'ring', text: `Connecting to ${ssid}...` });
                        result = await wifi.connect(ssid, password);
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? `Connected: ${ssid}` : 'Error' });
                        break;
                        
                    case 'disconnect':
                        result = await wifi.disconnect();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Disconnected' });
                        break;
                        
                    case 'saved':
                        result = await wifi.getSavedConnections();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} saved` });
                        break;
                        
                    case 'delete':
                        // Priority: msg properties > WiFi Config node > error
                        let connName = msg.name || msg.ssid || msg.payload;
                        if (!connName && wifiConfigNode) {
                            connName = wifiConfigNode.ssid;
                        }
                        if (!connName) throw new Error('Connection name required');
                        result = await wifi.deleteConnection(connName);
                        node.status({ fill: 'green', shape: 'dot', text: 'Deleted' });
                        break;
                        
                    case 'ap-start':
                        const apSsid = msg.ssid || config.apSsid || 'CompuLab-AP';
                        const apPassword = msg.password || config.apPassword;
                        const band = msg.band || config.band || 'bg';
                        node.status({ fill: 'blue', shape: 'ring', text: 'Starting AP...' });
                        result = await wifi.createAccessPoint(apSsid, apPassword, band);
                        node.status({ fill: 'green', shape: 'dot', text: `AP: ${apSsid}` });
                        break;
                        
                    case 'ap-stop':
                        result = await wifi.stopAccessPoint();
                        node.status({ fill: 'grey', shape: 'dot', text: 'AP stopped' });
                        break;
                        
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                msg.payload = result;
                msg.action = action;
                node.send(msg);
                
            } catch (err) {
                const errorMsg = err.message || 'Unknown error';
                node.status({ fill: 'red', shape: 'ring', text: errorMsg.substring(0, 30) });
                node.error(err.message, msg);
            }
        });

        node.on('close', function() {
            node.status({});
        });
    }
    
    RED.nodes.registerType('clab-wifi', ClabWifiNode);
};
