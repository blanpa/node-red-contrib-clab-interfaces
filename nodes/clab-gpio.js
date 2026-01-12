/**
 * CompuLab GPIO Node für Node-RED
 * Digital Input/Output für IOT-GATE-iMX8, SBC-IOT-iMX8, IOT-GATE-RPi
 */

module.exports = function(RED) {
    const GPIOHelper = require('../lib/gpio-helper');

    // ============================================
    // GPIO Input Node - Liest digitale Eingänge
    // ============================================
    function ClabGpioInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.pin = config.pin;
        node.interval = parseInt(config.interval) || 1000;
        node.deviceType = config.deviceType || 'auto';
        node.outputOnChange = config.outputOnChange !== false;
        
        // Gerät erkennen oder verwenden
        const detectedType = node.deviceType === 'auto' 
            ? GPIOHelper.detectDevice() 
            : node.deviceType;
        
        node.gpio = new GPIOHelper(detectedType);
        node.lastValue = null;
        node.timer = null;

        node.status({ fill: 'yellow', shape: 'dot', text: 'Initialisiere...' });

        // Polling Funktion
        const readInput = () => {
            try {
                const value = node.gpio.readInput(node.pin);
                
                // Nur senden wenn sich der Wert geändert hat (oder immer, je nach Config)
                if (!node.outputOnChange || value !== node.lastValue) {
                    node.lastValue = value;
                    
                    const msg = {
                        payload: value,
                        pin: node.pin,
                        device: detectedType,
                        timestamp: Date.now()
                    };
                    
                    node.send(msg);
                    node.status({ 
                        fill: value ? 'green' : 'grey', 
                        shape: 'dot', 
                        text: `${node.pin}: ${value}` 
                    });
                }
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                node.error(err.message);
            }
        };

        // Starte Polling
        if (node.pin) {
            readInput();
            node.timer = setInterval(readInput, node.interval);
            node.status({ fill: 'green', shape: 'dot', text: `${node.pin} aktiv` });
        } else {
            node.status({ fill: 'red', shape: 'ring', text: 'Kein Pin konfiguriert' });
        }

        // Input Handler - ermöglicht manuelles Triggern
        node.on('input', (msg) => {
            readInput();
        });

        // Cleanup
        node.on('close', (done) => {
            if (node.timer) {
                clearInterval(node.timer);
            }
            done();
        });
    }
    RED.nodes.registerType('clab-gpio-in', ClabGpioInNode);

    // ============================================
    // GPIO Output Node - Setzt digitale Ausgänge
    // ============================================
    function ClabGpioOutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.pin = config.pin;
        node.deviceType = config.deviceType || 'auto';
        node.initialValue = config.initialValue === 'high' ? 1 : 0;
        
        const detectedType = node.deviceType === 'auto' 
            ? GPIOHelper.detectDevice() 
            : node.deviceType;
        
        node.gpio = new GPIOHelper(detectedType);

        node.status({ fill: 'yellow', shape: 'dot', text: 'Initialisiere...' });

        // Setze Initialwert
        if (node.pin && config.setInitial) {
            try {
                node.gpio.writeOutput(node.pin, node.initialValue);
                node.status({ 
                    fill: node.initialValue ? 'green' : 'grey', 
                    shape: 'dot', 
                    text: `${node.pin}: ${node.initialValue}` 
                });
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
            }
        }

        // Input Handler
        node.on('input', (msg, send, done) => {
            const pin = msg.pin || node.pin;
            let value;
            
            // Wert interpretieren
            if (typeof msg.payload === 'boolean') {
                value = msg.payload ? 1 : 0;
            } else if (typeof msg.payload === 'number') {
                value = msg.payload ? 1 : 0;
            } else if (typeof msg.payload === 'string') {
                value = ['1', 'true', 'high', 'on'].includes(msg.payload.toLowerCase()) ? 1 : 0;
            } else {
                value = msg.payload ? 1 : 0;
            }

            try {
                node.gpio.writeOutput(pin, value);
                
                node.status({ 
                    fill: value ? 'green' : 'grey', 
                    shape: 'dot', 
                    text: `${pin}: ${value}` 
                });

                // Bestätigung senden
                msg.payload = value;
                msg.pin = pin;
                msg.device = detectedType;
                send(msg);
                
                if (done) done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                if (done) done(err);
                else node.error(err.message, msg);
            }
        });

        // Cleanup
        node.on('close', (done) => {
            done();
        });
    }
    RED.nodes.registerType('clab-gpio-out', ClabGpioOutNode);

    // ============================================
    // GPIO Read All Node - Liest alle Eingänge
    // ============================================
    function ClabGpioReadAllNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.deviceType = config.deviceType || 'auto';
        
        const detectedType = node.deviceType === 'auto' 
            ? GPIOHelper.detectDevice() 
            : node.deviceType;
        
        node.gpio = new GPIOHelper(detectedType);

        node.status({ fill: 'blue', shape: 'dot', text: 'Bereit' });

        node.on('input', (msg, send, done) => {
            try {
                const inputs = node.gpio.readAllInputs();
                
                msg.payload = inputs;
                msg.device = detectedType;
                msg.timestamp = Date.now();
                
                send(msg);
                node.status({ fill: 'green', shape: 'dot', text: 'Gelesen' });
                
                if (done) done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                if (done) done(err);
                else node.error(err.message, msg);
            }
        });
    }
    RED.nodes.registerType('clab-gpio-read-all', ClabGpioReadAllNode);
};
