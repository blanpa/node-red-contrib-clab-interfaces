/**
 * CompuLab UART Mode Switch Node
 * Switches between RS232 and RS485 mode for dual-mode ports
 */

const SerialHelper = require('../lib/serial-helper');

module.exports = function(RED) {
    
    function ClabUartModeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // Detect device type
        const deviceType = detectDeviceType();
        const serialHelper = new SerialHelper(deviceType);
        
        node.on('input', async function(msg) {
            try {
                // Get mode from msg or config
                let mode = msg.mode || config.mode || 'rs232';
                let port = msg.port || config.port || 'backpanel';
                
                // Ensure they are strings and normalize
                mode = String(mode).toLowerCase();
                port = String(port);
                
                // Validate mode
                if (!['rs232', 'rs485'].includes(mode)) {
                    throw new Error(`Invalid mode: ${mode}. Must be 'rs232' or 'rs485'`);
                }
                
                // Check if device supports mode switching
                if (!serialHelper.mapping.modeSwitch) {
                    node.warn(`Device ${deviceType} does not support UART mode switching`);
                    msg.payload = {
                        success: false,
                        error: 'Mode switching not supported on this device',
                        device: deviceType
                    };
                    node.status({ fill: 'yellow', shape: 'ring', text: 'Not supported' });
                    node.send(msg);
                    return;
                }
                
                // Set UART mode
                await serialHelper.setUartMode(mode);
                
                msg.payload = {
                    success: true,
                    mode: mode.toUpperCase(),
                    port: port,
                    device: deviceType,
                    gpio: serialHelper.mapping.modeSwitch.gpio
                };
                
                node.status({ 
                    fill: mode === 'rs485' ? 'blue' : 'green', 
                    shape: 'dot', 
                    text: mode.toUpperCase() 
                });
                
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
    
    function detectDeviceType() {
        const fs = require('fs');
        
        try {
            if (fs.existsSync('/proc/device-tree/baseboard-options')) {
                const options = fs.readFileSync('/proc/device-tree/baseboard-options', 'utf8')
                    .replace(/\0/g, '').trim();
                
                if (options.includes('IOT-GATE-iMX8')) return 'IOT-GATE-iMX8';
                if (options.includes('SBC-IOT-iMX8')) return 'SBC-IOT-iMX8';
                if (options.includes('IOT-GATE-IMX8PLUS')) return 'IOT-GATE-IMX8PLUS';
                if (options.includes('SBC-IOT-IMX8PLUS')) return 'SBC-IOT-IMX8PLUS';
                if (options.includes('IOT-DIN-IMX8PLUS')) return 'IOT-DIN-IMX8PLUS';
            }
            
            if (fs.existsSync('/proc/device-tree/model')) {
                const model = fs.readFileSync('/proc/device-tree/model', 'utf8')
                    .replace(/\0/g, '').trim();
                
                if (model.includes('Raspberry Pi')) return 'IOT-GATE-RPi';
                if (model.includes('i.MX93')) return 'IOT-LINK';
            }
        } catch (e) {
            // Ignore
        }
        
        return 'IOT-GATE-iMX8';
    }
    
    RED.nodes.registerType('clab-uart-mode', ClabUartModeNode);
};
