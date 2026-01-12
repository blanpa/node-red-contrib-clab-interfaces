/**
 * CompuLab LED Node
 * Consolidated node for LED control
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const fsPromises = fs.promises;
const execAsync = util.promisify(exec);

// LED mappings for various CompuLab devices
// IOT-GATE-IMX8PLUS has 2 bi-color LEDs (Green/Red each)
const LED_MAPPINGS = {
    'IOT-GATE-IMX8PLUS': {
        green: '/sys/class/leds/Green_1',    // LED 1 - Green
        red1: '/sys/class/leds/Red_1',       // LED 1 - Red
        yellow: ['Green_1', 'Red_1'],        // LED 1 - Yellow/Orange (both)
        green2: '/sys/class/leds/Green_2',   // LED 2 - Green
        red2: '/sys/class/leds/Red_2',       // LED 2 - Red
        orange: ['Green_2', 'Red_2']         // LED 2 - Yellow/Orange (both)
    },
    'IOT-GATE-iMX8': {
        green: '/sys/class/leds/Green_1',    // LED 1 - Green
        red1: '/sys/class/leds/Red_1',       // LED 1 - Red
        yellow: ['Green_1', 'Red_1'],        // LED 1 - Yellow/Orange (both)
        green2: '/sys/class/leds/Green_2',   // LED 2 - Green
        red2: '/sys/class/leds/Red_2',       // LED 2 - Red
        orange: ['Green_2', 'Red_2']         // LED 2 - Yellow/Orange (both)
    },
    'default': {
        green: '/sys/class/leds/Green_1',
        red1: '/sys/class/leds/Red_1',
        yellow: ['Green_1', 'Red_1'],
        red2: '/sys/class/leds/Red_2'
    }
};

module.exports = function(RED) {
    
    function ClabLedNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        let blinkInterval = null;
        
        function getLedPath(deviceType, color) {
            const ledMapping = LED_MAPPINGS[deviceType] || LED_MAPPINGS['default'];
            const ledPath = ledMapping[color] || ledMapping.green;
            
            // Handle multi-LED colors (yellow, orange)
            if (Array.isArray(ledPath)) {
                return ledPath.map(led => `/sys/class/leds/${led}`);
            }
            return [ledPath];  // Always return array for consistency
        }

        function setLed(state, ledPaths) {
            const value = state ? '1' : '0';
            
            // Handle array of LED paths (for yellow/orange)
            const paths = Array.isArray(ledPaths) ? ledPaths : [ledPaths];
            
            let lastError = null;
            
            for (const ledPath of paths) {
                try {
                    // Use synchronous write for reliability in setInterval
                    fs.writeFileSync(`${ledPath}/brightness`, value);
                } catch (e) {
                    // Fallback: Try with shell command
                    try {
                        require('child_process').execSync(`echo ${value} > ${ledPath}/brightness`, { stdio: 'pipe' });
                    } catch (e2) {
                        lastError = e2;
                        // Continue trying other LEDs
                    }
                }
            }
            
            // If all attempts failed, throw the last error
            if (lastError && paths.length === 1) {
                throw lastError;
            }
        }

        async function getLedState(ledPaths) {
            const paths = Array.isArray(ledPaths) ? ledPaths : [ledPaths];
            
            try {
                // For multi-LED colors, return true if ANY LED is on
                for (const ledPath of paths) {
                    const data = await fsPromises.readFile(`${ledPath}/brightness`, 'utf8');
                    if (parseInt(data.trim()) > 0) return true;
                }
                return false;
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
            try {
                // msg properties override config
                const action = msg.action || config.action || 'on';
                const deviceType = msg.deviceType || config.deviceType || 'IOT-GATE-IMX8PLUS';
                const color = msg.color || config.color || 'green';
                const ledPath = getLedPath(deviceType, color);
                
                stopBlink();
                let result;
                
                switch (action) {
                    case 'on':
                        setLed(true, ledPath);
                        result = { state: true, action: 'on', color, deviceType };
                        node.status({ fill: 'green', shape: 'dot', text: 'ON' });
                        break;
                        
                    case 'off':
                        setLed(false, ledPath);
                        result = { state: false, action: 'off', color, deviceType };
                        node.status({ fill: 'grey', shape: 'dot', text: 'OFF' });
                        break;
                        
                    case 'toggle':
                        const currentState = await getLedState(ledPath);
                        setLed(!currentState, ledPath);
                        result = { state: !currentState, action: 'toggle', color, deviceType };
                        node.status({ fill: !currentState ? 'green' : 'grey', shape: 'dot', text: !currentState ? 'ON' : 'OFF' });
                        break;
                        
                    case 'blink':
                        const interval = msg.interval || config.interval || 500;
                        let ledOn = false;
                        
                        // Test if we can write to LED first
                        try {
                            setLed(true, ledPath);
                            setLed(false, ledPath);
                        } catch (testErr) {
                            throw new Error(`Cannot access LED (${testErr.message}). Check permissions or run Node-RED with sudo.`);
                        }
                        
                        // Start blinking
                        blinkInterval = setInterval(() => {
                            ledOn = !ledOn;
                            try {
                                setLed(ledOn, ledPath);
                            } catch (err) {
                                node.warn(`Blink error: ${err.message}`);
                            }
                        }, interval);
                        
                        result = { state: 'blinking', interval: interval, action: 'blink', color, deviceType };
                        node.status({ fill: 'yellow', shape: 'ring', text: `Blinking (${interval}ms)` });
                        break;
                        
                    case 'status':
                        const state = await getLedState(ledPath);
                        result = { state: state, action: 'status', color, deviceType };
                        node.status({ fill: state ? 'green' : 'grey', shape: 'dot', text: state ? 'ON' : 'OFF' });
                        break;
                        
                    default:
                        // Wenn payload boolean ist
                        if (typeof msg.payload === 'boolean') {
                            setLed(msg.payload, ledPath);
                            result = { state: msg.payload, action: 'set', color, deviceType };
                            node.status({ fill: msg.payload ? 'green' : 'grey', shape: 'dot', text: msg.payload ? 'ON' : 'OFF' });
                        } else {
                            throw new Error(`Unknown action: ${action}`);
                        }
                }

                msg.payload = result;
                node.send(msg);
                
            } catch (err) {
                const errorMsg = err.message || String(err);
                node.status({ fill: 'red', shape: 'ring', text: errorMsg.substring(0, 30) });
                node.error(errorMsg, msg);
            }
        });

        node.on('close', function() {
            stopBlink();
            node.status({});
        });
    }
    
    RED.nodes.registerType('clab-led', ClabLedNode);
};
