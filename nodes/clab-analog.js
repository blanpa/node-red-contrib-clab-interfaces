/**
 * CompuLab Analog Input Node for Node-RED
 * Supports:
 * - 4-20mA Current Loop
 * - 0-10V / 0-5V Voltage Input
 * - PT100/PT1000 Temperature Sensors
 */

module.exports = function(RED) {
    const AnalogHelper = require('../lib/analog-helper');

    // ============================================
    // Analog Input Node
    // ============================================
    function ClabAnalogInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.deviceIndex = parseInt(config.deviceIndex) || 0;
        node.channelIndex = parseInt(config.channelIndex) || 0;
        node.inputType = config.inputType || 'current';  // current, voltage, temperature
        node.interval = parseInt(config.interval) || 0;  // 0 = nur bei Trigger
        node.outputOnChange = config.outputOnChange === true;
        node.threshold = parseFloat(config.threshold) || 0.1;
        
        // Skalierung
        node.useScaling = config.useScaling === true;
        node.scaleMin = parseFloat(config.scaleMin) || 0;
        node.scaleMax = parseFloat(config.scaleMax) || 100;
        node.scaleUnit = config.scaleUnit || '';
        node.decimals = parseInt(config.decimals) || 2;
        
        // Spannungsbereich
        node.maxVoltage = parseFloat(config.maxVoltage) || 10.0;
        
        // Temperatur
        node.sensorType = config.sensorType || 'PT100';
        
        node.helper = new AnalogHelper();
        node.lastValue = null;
        node.timer = null;

        node.status({ fill: 'yellow', shape: 'dot', text: 'Initializing...' });

        // Check if devices are available
        const devices = node.helper.getDevices();
        if (devices.length === 0) {
            node.status({ fill: 'grey', shape: 'ring', text: 'No ADC found' });
        }

        // Read function
        const readAnalog = () => {
            try {
                let reading;
                let displayValue;
                let displayUnit;
                
                switch (node.inputType) {
                    case 'voltage':
                        if (node.useScaling) {
                            reading = node.helper.readScaled({
                                deviceIndex: node.deviceIndex,
                                channelIndex: node.channelIndex,
                                inputType: 'voltage',
                                minValue: node.scaleMin,
                                maxValue: node.scaleMax,
                                unit: node.scaleUnit,
                                decimals: node.decimals,
                                maxVoltage: node.maxVoltage
                            });
                            displayValue = reading.scaled;
                            displayUnit = node.scaleUnit;
                        } else {
                            reading = node.helper.readVoltage(
                                node.deviceIndex, 
                                node.channelIndex, 
                                node.maxVoltage
                            );
                            displayValue = reading.voltage;
                            displayUnit = 'V';
                        }
                        break;
                        
                    case 'temperature':
                        reading = node.helper.readTemperature(
                            node.deviceIndex,
                            node.channelIndex,
                            node.sensorType
                        );
                        displayValue = reading.celsius;
                        displayUnit = '°C';
                        break;
                        
                    case 'current':
                    default:
                        if (node.useScaling) {
                            reading = node.helper.readScaled({
                                deviceIndex: node.deviceIndex,
                                channelIndex: node.channelIndex,
                                inputType: 'current',
                                minValue: node.scaleMin,
                                maxValue: node.scaleMax,
                                unit: node.scaleUnit,
                                decimals: node.decimals
                            });
                            displayValue = reading.scaled;
                            displayUnit = node.scaleUnit;
                        } else {
                            reading = node.helper.readCurrent(node.deviceIndex, node.channelIndex);
                            displayValue = reading.currentMA;
                            displayUnit = 'mA';
                        }
                        break;
                }
                
                // Check if value changed significantly
                const shouldSend = !node.outputOnChange || 
                    node.lastValue === null ||
                    Math.abs(displayValue - node.lastValue) >= node.threshold;
                
                if (shouldSend) {
                    node.lastValue = displayValue;
                    
                    const msg = {
                        payload: displayValue,
                        raw: reading.raw,
                        percent: reading.percent,
                        valid: reading.valid,
                        unit: displayUnit,
                        inputType: node.inputType,
                        device: reading.device,
                        channel: reading.channel,
                        timestamp: Date.now()
                    };
                    
                    // Additional fields depending on type
                    if (node.inputType === 'current') {
                        msg.currentMA = reading.currentMA;
                    } else if (node.inputType === 'voltage') {
                        msg.voltage = reading.voltage;
                    } else if (node.inputType === 'temperature') {
                        msg.celsius = reading.celsius;
                        msg.fahrenheit = reading.fahrenheit;
                        msg.kelvin = reading.kelvin;
                    }
                    
                    if (node.useScaling) {
                        msg.scaled = reading.scaled;
                        msg.scaleMin = node.scaleMin;
                        msg.scaleMax = node.scaleMax;
                    }
                    
                    node.send(msg);
                    
                    const statusText = `${displayValue.toFixed(node.decimals)} ${displayUnit}`;
                    node.status({ 
                        fill: reading.valid !== false ? 'green' : 'yellow', 
                        shape: 'dot', 
                        text: statusText
                    });
                }
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                node.error(err.message);
            }
        };

        // Start polling if configured
        if (devices.length > 0 && node.interval > 0) {
            readAnalog();
            node.timer = setInterval(readAnalog, node.interval);
        } else if (devices.length > 0) {
            node.status({ fill: 'blue', shape: 'dot', text: 'Ready' });
        }

        // Input handler - allows manual triggering
        node.on('input', (msg) => {
            // Override configuration from msg if present
            if (msg.deviceIndex !== undefined) node.deviceIndex = msg.deviceIndex;
            if (msg.channelIndex !== undefined) node.channelIndex = msg.channelIndex;
            readAnalog();
        });

        // Cleanup
        node.on('close', (done) => {
            if (node.timer) {
                clearInterval(node.timer);
            }
            done();
        });
    }
    RED.nodes.registerType('clab-analog-in', ClabAnalogInNode);

    // ============================================
    // Analog Devices Node - Lists available ADCs
    // ============================================
    function ClabAnalogDevicesNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.helper = new AnalogHelper();

        node.status({ fill: 'blue', shape: 'dot', text: 'Ready' });

        node.on('input', (msg, send, done) => {
            try {
                const devices = node.helper.getDevices();
                
                msg.payload = devices;
                msg.count = devices.length;
                msg.available = devices.length > 0;
                msg.timestamp = Date.now();
                
                send(msg);
                node.status({ fill: 'green', shape: 'dot', text: `${devices.length} device(s)` });
                
                if (done) done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                if (done) done(err);
                else node.error(err.message, msg);
            }
        });
    }
    RED.nodes.registerType('clab-analog-devices', ClabAnalogDevicesNode);
};
