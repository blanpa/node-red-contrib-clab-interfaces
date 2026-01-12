/**
 * CompuLab Ethernet Node
 * Konsolidierter Node für Ethernet-Funktionen
 */

const EthernetHelper = require('../lib/ethernet-helper');

module.exports = function(RED) {
    
    function ClabEthernetNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const eth = new EthernetHelper({ interface: config.interface });

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'status';
            const iface = msg.interface || config.interface;
            
            try {
                let result;
                
                switch (action) {
                    case 'status':
                        result = await eth.getStatus(iface);
                        node.status({ fill: result.connected ? 'green' : 'yellow', shape: 'dot', text: result.ipAddress || 'Getrennt' });
                        break;
                        
                    case 'interfaces':
                        result = await eth.getInterfaces();
                        node.status({ fill: 'green', shape: 'dot', text: `${result.count} Interfaces` });
                        break;
                        
                    case 'statistics':
                        result = await eth.getStatistics(iface);
                        node.status({ fill: 'green', shape: 'dot', text: `RX: ${result.statistics.rxMB}MB` });
                        break;
                        
                    case 'enable':
                        result = await eth.enable(iface);
                        node.status({ fill: 'green', shape: 'dot', text: 'Aktiviert' });
                        break;
                        
                    case 'disable':
                        result = await eth.disable(iface);
                        node.status({ fill: 'grey', shape: 'dot', text: 'Deaktiviert' });
                        break;
                        
                    case 'dhcp':
                        node.status({ fill: 'blue', shape: 'ring', text: 'DHCP...' });
                        result = await eth.setDHCP(iface);
                        node.status({ fill: 'green', shape: 'dot', text: 'DHCP' });
                        break;
                        
                    case 'static':
                        node.status({ fill: 'blue', shape: 'ring', text: 'Konfiguriere...' });
                        result = await eth.setStaticIP({
                            interface: iface,
                            ipAddress: msg.ipAddress || config.ipAddress,
                            netmask: msg.netmask || config.netmask || '255.255.255.0',
                            gateway: msg.gateway || config.gateway,
                            dns: msg.dns || (config.dns ? config.dns.split(',').map(s => s.trim()) : ['8.8.8.8'])
                        });
                        node.status({ fill: 'green', shape: 'dot', text: result.ipAddress });
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
    
    RED.nodes.registerType('clab-ethernet', ClabEthernetNode);
};
