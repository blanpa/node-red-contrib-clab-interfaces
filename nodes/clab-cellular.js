/**
 * CompuLab Cellular Node
 * Consolidated node for LTE/4G modem functions
 */

const CellularHelper = require('../lib/cellular-helper');

module.exports = function(RED) {
    
    function ClabCellularNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const cellular = new CellularHelper({ apn: config.apn });
        
        let intervalId = null;

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'status';
            
            try {
                let result;
                
                switch (action) {
                    case 'status':
                        result = await cellular.getConnectionStatus();
                        node.status({ fill: result.connected ? 'green' : 'yellow', shape: 'dot', text: result.connected ? 'Connected' : result.state });
                        break;
                        
                    case 'info':
                        result = await cellular.getModemInfo();
                        node.status({ fill: 'green', shape: 'dot', text: result.model || 'OK' });
                        break;
                        
                    case 'sim':
                        result = await cellular.getSimInfo();
                        node.status({ fill: result.success ? 'green' : 'yellow', shape: 'dot', text: result.operatorName || 'SIM' });
                        break;
                        
                    case 'signal':
                        result = await cellular.getSignalStrength();
                        const color = result.quality > 50 ? 'green' : result.quality > 20 ? 'yellow' : 'red';
                        node.status({ fill: color, shape: 'dot', text: `${result.quality || 0}%` });
                        break;
                        
                    case 'connect':
                        const apn = msg.apn || config.apn;
                        node.status({ fill: 'blue', shape: 'ring', text: 'Connecting...' });
                        result = await cellular.connect(apn);
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? 'Connected' : 'Error' });
                        break;
                        
                    case 'disconnect':
                        result = await cellular.disconnect();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Disconnected' });
                        break;
                        
                    case 'enable':
                        result = await cellular.setPowerState(true);
                        node.status({ fill: 'green', shape: 'dot', text: 'Enabled' });
                        break;
                        
                    case 'disable':
                        result = await cellular.setPowerState(false);
                        node.status({ fill: 'grey', shape: 'dot', text: 'Disabled' });
                        break;
                        
                    case 'reset':
                        node.status({ fill: 'blue', shape: 'ring', text: 'Reset...' });
                        result = await cellular.reset();
                        node.status({ fill: 'green', shape: 'dot', text: 'Reset OK' });
                        break;
                        
                    case 'at-command':
                        const command = msg.command || msg.payload;
                        if (!command) throw new Error('AT command required');
                        result = await cellular.sendATCommand(command);
                        node.status({ fill: 'green', shape: 'dot', text: 'AT OK' });
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

        // Automatic signal polling if configured
        if (config.interval && config.interval > 0) {
            intervalId = setInterval(async () => {
                try {
                    const result = await cellular.getSignalStrength();
                    const color = result.quality > 50 ? 'green' : result.quality > 20 ? 'yellow' : 'red';
                    node.status({ fill: color, shape: 'dot', text: `${result.quality || 0}%` });
                    node.send({ payload: result, action: 'signal' });
                } catch (err) {
                    node.error(err.message);
                }
            }, config.interval);
        }

        node.on('close', function() {
            if (intervalId) clearInterval(intervalId);
            node.status({});
        });
    }
    
    RED.nodes.registerType('clab-cellular', ClabCellularNode);
};
