/**
 * CompuLab Bluetooth Node
 * Konsolidierter Node für Bluetooth-Funktionen
 */

const BluetoothHelper = require('../lib/bluetooth-helper');

module.exports = function(RED) {
    
    function ClabBluetoothNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const bt = new BluetoothHelper();

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'status';
            
            try {
                let result;
                
                switch (action) {
                    case 'status':
                    case 'info':
                        result = await bt.getAdapterInfo();
                        node.status({ fill: result.status === 'up' ? 'green' : 'yellow', shape: 'dot', text: result.status });
                        break;
                        
                    case 'enable':
                        result = await bt.enable();
                        node.status({ fill: 'green', shape: 'dot', text: 'Aktiviert' });
                        break;
                        
                    case 'disable':
                        result = await bt.disable();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Deaktiviert' });
                        break;
                        
                    case 'scan':
                        const duration = msg.duration || config.duration || 10;
                        node.status({ fill: 'blue', shape: 'ring', text: 'Scanning...' });
                        result = await bt.scan(duration);
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} Geräte` });
                        break;
                        
                    case 'devices':
                        result = await bt.getDevices();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} Geräte` });
                        break;
                        
                    case 'connect':
                        const connectAddr = msg.address || msg.payload?.address || config.address;
                        if (!connectAddr) throw new Error('Adresse erforderlich');
                        node.status({ fill: 'blue', shape: 'ring', text: 'Verbinde...' });
                        result = await bt.connect(connectAddr);
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? 'Verbunden' : 'Fehler' });
                        break;
                        
                    case 'disconnect':
                        const disconnectAddr = msg.address || msg.payload?.address || config.address;
                        if (!disconnectAddr) throw new Error('Adresse erforderlich');
                        result = await bt.disconnect(disconnectAddr);
                        node.status({ fill: 'grey', shape: 'dot', text: 'Getrennt' });
                        break;
                        
                    case 'remove':
                        const removeAddr = msg.address || msg.payload?.address || config.address;
                        if (!removeAddr) throw new Error('Adresse erforderlich');
                        result = await bt.remove(removeAddr);
                        node.status({ fill: 'green', shape: 'dot', text: 'Entfernt' });
                        break;
                        
                    case 'connection-status':
                        const statusAddr = msg.address || msg.payload?.address || config.address;
                        if (!statusAddr) throw new Error('Adresse erforderlich');
                        result = await bt.getConnectionStatus(statusAddr);
                        node.status({ fill: result.connected ? 'green' : 'grey', shape: 'dot', text: result.connected ? 'Verbunden' : 'Getrennt' });
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
    
    RED.nodes.registerType('clab-bluetooth', ClabBluetoothNode);
};
