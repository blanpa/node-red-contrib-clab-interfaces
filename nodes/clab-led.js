/**
 * CompuLab LED Node
 * Konsolidierter Node für LED Steuerung
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const execAsync = util.promisify(exec);

// LED Mappings für verschiedene CompuLab Geräte
const LED_MAPPINGS = {
    'IOT-GATE-IMX8PLUS': {
        green: '/sys/class/leds/Green_1',
        yellow: '/sys/class/leds/Red_1',  // Red_1 als "yellow"
        red: '/sys/class/leds/Red_2',
        green2: '/sys/class/leds/Green_2'
    },
    'IOT-GATE-iMX8': {
        green: '/sys/class/leds/Green_1',
        yellow: '/sys/class/leds/Red_1',
        red: '/sys/class/leds/Red_2',
        green2: '/sys/class/leds/Green_2'
    },
    'default': {
        green: '/sys/class/leds/Green_1',
        yellow: '/sys/class/leds/Red_1',
        red: '/sys/class/leds/Red_2'
    }
};

module.exports = function(RED) {
    
    function ClabLedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        const deviceType = config.deviceType || 'IOT-GATE-IMX8PLUS';
        const ledMapping = LED_MAPPINGS[deviceType] || LED_MAPPINGS['default'];
        const color = config.color || 'green';
        const ledPath = ledMapping[color] || ledMapping.green;
        let blinkInterval = null;

        async function setLed(state) {
            const value = state ? '1' : '0';
            try {
                await fs.writeFile(`${ledPath}/brightness`, value);
            } catch (e) {
                // Fallback mit echo (für Kompatibilität)
                await execAsync(`echo ${value} > ${ledPath}/brightness`);
            }
        }

        async function getLedState() {
            try {
                const data = await fs.readFile(`${ledPath}/brightness`, 'utf8');
                return parseInt(data.trim()) > 0;
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
