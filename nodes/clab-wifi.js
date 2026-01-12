/**
 * CompuLab WiFi Node
 * Konsolidierter Node für WiFi-Funktionen
 */

const WiFiHelper = require('../lib/wifi-helper');

module.exports = function(RED) {
    
    function ClabWifiNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const wifi = new WiFiHelper({ interface: config.interface });

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'status';
            
            try {
                let result;
                
                switch (action) {
                    case 'status':
                        result = await wifi.getStatus();
                        node.status({ fill: result.connected ? 'green' : 'yellow', shape: 'dot', text: result.connection || 'Getrennt' });
                        break;
                        
                    case 'enable':
                        result = await wifi.enable();
                        node.status({ fill: 'green', shape: 'dot', text: 'Aktiviert' });
                        break;
                        
                    case 'disable':
                        result = await wifi.disable();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Deaktiviert' });
                        break;
                        
                    case 'scan':
                        node.status({ fill: 'blue', shape: 'ring', text: 'Scanning...' });
                        result = await wifi.scan();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} Netzwerke` });
                        break;
                        
                    case 'connect':
                        const ssid = msg.ssid || msg.payload?.ssid || config.ssid;
                        const password = msg.password || msg.payload?.password || config.password;
                        if (!ssid) throw new Error('SSID erforderlich');
                        node.status({ fill: 'blue', shape: 'ring', text: 'Verbinde...' });
                        result = await wifi.connect(ssid, password);
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? 'Verbunden' : 'Fehler' });
                        break;
                        
                    case 'disconnect':
                        result = await wifi.disconnect();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Getrennt' });
                        break;
                        
                    case 'saved':
                        result = await wifi.getSavedConnections();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} gespeichert` });
                        break;
                        
                    case 'delete':
                        const connName = msg.name || msg.ssid || msg.payload;
                        if (!connName) throw new Error('Verbindungsname erforderlich');
                        result = await wifi.deleteConnection(connName);
                        node.status({ fill: 'green', shape: 'dot', text: 'Gelöscht' });
                        break;
                        
                    case 'ap-start':
                        const apSsid = msg.ssid || config.apSsid || 'CompuLab-AP';
                        const apPassword = msg.password || config.apPassword;
                        const band = msg.band || config.band || 'bg';
                        node.status({ fill: 'blue', shape: 'ring', text: 'Starte AP...' });
                        result = await wifi.createAccessPoint(apSsid, apPassword, band);
                        node.status({ fill: 'green', shape: 'dot', text: `AP: ${apSsid}` });
                        break;
                        
                    case 'ap-stop':
                        result = await wifi.stopAccessPoint();
                        node.status({ fill: 'grey', shape: 'dot', text: 'AP gestoppt' });
                        break;
                        
                    default:
                        throw new Error(`Unbekannte Aktion: ${action}`);
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
    
    RED.nodes.registerType('clab-wifi', ClabWifiNode);
};
