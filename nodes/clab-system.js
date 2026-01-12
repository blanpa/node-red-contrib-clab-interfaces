/**
 * CompuLab System Node
 * Konsolidierter Node für System-Funktionen
 */

const SystemHelper = require('../lib/system-helper');

module.exports = function(RED) {
    
    function ClabSystemNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const system = new SystemHelper();

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'info';
            
            try {
                let result;
                
                switch (action) {
                    // System Info
                    case 'info':
                        result = await system.getSystemInfo();
                        node.status({ fill: 'green', shape: 'dot', text: result.hostname || 'OK' });
                        break;
                        
                    case 'uptime':
                        result = await system.getUptime();
                        node.status({ fill: 'green', shape: 'dot', text: result.uptime });
                        break;
                        
                    case 'temperature':
                        result = await system.getTemperature();
                        const temp = result.celsius;
                        node.status({ 
                            fill: temp > 70 ? 'red' : temp > 50 ? 'yellow' : 'green', 
                            shape: 'dot', 
                            text: `${temp}°C` 
                        });
                        break;
                    
                    // RTC
                    case 'rtc-read':
                        result = await system.getRtcTime();
                        node.status({ fill: 'green', shape: 'dot', text: result.time });
                        break;
                        
                    case 'rtc-set':
                        const time = msg.time || msg.payload;
                        result = await system.setRtcTime(time);
                        node.status({ fill: 'green', shape: 'dot', text: 'RTC gesetzt' });
                        break;
                        
                    case 'rtc-sync':
                        result = await system.syncRtcToSystem();
                        node.status({ fill: 'green', shape: 'dot', text: 'RTC sync' });
                        break;
                    
                    // Watchdog
                    case 'watchdog-status':
                        result = await system.getWatchdogStatus();
                        node.status({ fill: result.enabled ? 'green' : 'grey', shape: 'dot', text: result.enabled ? 'Aktiv' : 'Inaktiv' });
                        break;
                        
                    case 'watchdog-enable':
                        const timeout = msg.timeout || config.timeout || 60;
                        result = await system.enableWatchdog(timeout);
                        node.status({ fill: 'green', shape: 'dot', text: `WD ${timeout}s` });
                        break;
                        
                    case 'watchdog-disable':
                        result = await system.disableWatchdog();
                        node.status({ fill: 'grey', shape: 'dot', text: 'WD aus' });
                        break;
                        
                    case 'watchdog-kick':
                        result = await system.kickWatchdog();
                        node.status({ fill: 'green', shape: 'dot', text: 'WD kick' });
                        break;
                    
                    // TPM
                    case 'tpm-status':
                        result = await system.getTpmStatus();
                        node.status({ fill: result.available ? 'green' : 'yellow', shape: 'dot', text: result.available ? 'TPM OK' : 'Kein TPM' });
                        break;
                        
                    case 'tpm-random':
                        const bytes = msg.bytes || config.bytes || 32;
                        result = await system.getTpmRandom(bytes);
                        node.status({ fill: 'green', shape: 'dot', text: `${bytes} Bytes` });
                        break;
                    
                    // Power
                    case 'reboot':
                        const delay = msg.delay || config.delay || 0;
                        result = await system.reboot(delay);
                        node.status({ fill: 'red', shape: 'dot', text: 'Reboot...' });
                        break;
                        
                    case 'shutdown':
                        result = await system.shutdown(msg.delay || 0);
                        node.status({ fill: 'red', shape: 'dot', text: 'Shutdown...' });
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
    
    RED.nodes.registerType('clab-system', ClabSystemNode);
};
