/**
 * CompuLab LED Node
 * Konsolidierter Node für LED Steuerung
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

module.exports = function(RED) {
    
    function ClabLedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        const ledPath = '/sys/class/leds/user-led';
        let blinkInterval = null;

        async function setLed(state) {
            const value = state ? '1' : '0';
            await execAsync(`echo ${value} | sudo tee ${ledPath}/brightness`);
        }

        async function getLedState() {
            try {
                const { stdout } = await execAsync(`cat ${ledPath}/brightness`);
                return parseInt(stdout.trim()) > 0;
            } catch (e) {
                return false;
            }
        }

        function stopBlink() {
            if (blinkInterval) {
                clearInterval(blinkInterval);
                blinkInterval = null;
            }
        }

        node.on('input', async function(msg) {
            const action = msg.action || config.action || 'on';
            
            try {
                stopBlink();
                let result;
                
                switch (action) {
                    case 'on':
                        await setLed(true);
                        result = { state: true, action: 'on' };
                        node.status({ fill: 'green', shape: 'dot', text: 'AN' });
                        break;
                        
                    case 'off':
                        await setLed(false);
                        result = { state: false, action: 'off' };
                        node.status({ fill: 'grey', shape: 'dot', text: 'AUS' });
                        break;
                        
                    case 'toggle':
                        const currentState = await getLedState();
                        await setLed(!currentState);
                        result = { state: !currentState, action: 'toggle' };
                        node.status({ fill: !currentState ? 'green' : 'grey', shape: 'dot', text: !currentState ? 'AN' : 'AUS' });
                        break;
                        
                    case 'blink':
                        const interval = msg.interval || config.interval || 500;
                        let ledOn = false;
                        blinkInterval = setInterval(async () => {
                            ledOn = !ledOn;
                            await setLed(ledOn).catch(() => {});
                        }, interval);
                        result = { state: 'blinking', interval: interval, action: 'blink' };
                        node.status({ fill: 'yellow', shape: 'ring', text: `Blinkt (${interval}ms)` });
                        break;
                        
                    case 'status':
                        const state = await getLedState();
                        result = { state: state, action: 'status' };
                        node.status({ fill: state ? 'green' : 'grey', shape: 'dot', text: state ? 'AN' : 'AUS' });
                        break;
                        
                    default:
                        // Wenn payload boolean ist
                        if (typeof msg.payload === 'boolean') {
                            await setLed(msg.payload);
                            result = { state: msg.payload, action: 'set' };
                            node.status({ fill: msg.payload ? 'green' : 'grey', shape: 'dot', text: msg.payload ? 'AN' : 'AUS' });
                        } else {
                            throw new Error(`Unbekannte Aktion: ${action}`);
                        }
                }

                msg.payload = result;
                node.send(msg);
                
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                node.error(err.message, msg);
            }
        });

        node.on('close', function() {
            stopBlink();
            node.status({});
        });
    }
    
    RED.nodes.registerType('clab-led', ClabLedNode);
};
