/**
 * CompuLab Bluetooth Node
 * Consolidated node for Bluetooth functions
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
                        node.status({ fill: 'green', shape: 'dot', text: 'Enabled' });
                        break;
                        
                    case 'disable':
                        result = await bt.disable();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Disabled' });
                        break;
                        
                    case 'scan':
                        const duration = msg.duration || config.duration || 10;
                        node.status({ fill: 'blue', shape: 'ring', text: 'Scanning...' });
                        result = await bt.scan(duration);
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} devices` });
                        break;
                        
                    case 'devices':
                        result = await bt.getDevices();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} devices` });
                        break;
                        
                    case 'connect':
                        const connectAddr = msg.address || msg.payload?.address || config.address;
                        if (!connectAddr) throw new Error('Address required');
                        node.status({ fill: 'blue', shape: 'ring', text: 'Connecting...' });
                        result = await bt.connect(connectAddr);
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? 'Connected' : 'Error' });
                        break;
                        
                    case 'disconnect':
                        const disconnectAddr = msg.address || msg.payload?.address || config.address;
                        if (!disconnectAddr) throw new Error('Address required');
                        result = await bt.disconnect(disconnectAddr);
                        node.status({ fill: 'grey', shape: 'dot', text: 'Disconnected' });
                        break;
                        
                    case 'remove':
                        const removeAddr = msg.address || msg.payload?.address || config.address;
                        if (!removeAddr) throw new Error('Address required');
                        result = await bt.remove(removeAddr);
                        node.status({ fill: 'green', shape: 'dot', text: 'Removed' });
                        break;
                        
                    case 'connection-status':
                        const statusAddr = msg.address || msg.payload?.address || config.address;
                        if (!statusAddr) throw new Error('Address required');
                        result = await bt.getConnectionStatus(statusAddr);
                        node.status({ fill: result.connected ? 'green' : 'grey', shape: 'dot', text: result.connected ? 'Connected' : 'Disconnected' });
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
    
    RED.nodes.registerType('clab-bluetooth', ClabBluetoothNode);
};
