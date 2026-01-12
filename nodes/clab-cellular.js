/**
 * CompuLab Cellular Node
 * Konsolidierter Node für LTE/4G Modem-Funktionen
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
                        node.status({ fill: result.connected ? 'green' : 'yellow', shape: 'dot', text: result.connected ? 'Verbunden' : result.state });
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
                        node.status({ fill: 'blue', shape: 'ring', text: 'Verbinde...' });
                        result = await cellular.connect(apn);
                        node.status({ fill: result.success ? 'green' : 'red', shape: 'dot', text: result.success ? 'Verbunden' : 'Fehler' });
                        break;
                        
                    case 'disconnect':
                        result = await cellular.disconnect();
                        node.status({ fill: 'grey', shape: 'dot', text: 'Getrennt' });
                        break;
                        
                    case 'enable':
                        result = await cellular.setPowerState(true);
                        node.status({ fill: 'green', shape: 'dot', text: 'Aktiviert' });
                        break;
                        
                    case 'disable':
                        result = await cellular.setPowerState(false);
                        node.status({ fill: 'grey', shape: 'dot', text: 'Deaktiviert' });
                        break;
                        
                    case 'reset':
                        node.status({ fill: 'blue', shape: 'ring', text: 'Reset...' });
                        result = await cellular.reset();
                        node.status({ fill: 'green', shape: 'dot', text: 'Reset OK' });
                        break;
                        
                    case 'at-command':
                        const command = msg.command || msg.payload;
                        if (!command) throw new Error('AT-Befehl erforderlich');
                        result = await cellular.sendATCommand(command);
                        node.status({ fill: 'green', shape: 'dot', text: 'AT OK' });
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

        // Automatisches Signal-Polling falls konfiguriert
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
