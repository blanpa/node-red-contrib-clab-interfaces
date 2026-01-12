/**
 * CompuLab Serial Node for Node-RED
 * RS232/RS485 communication for IOT-GATE-iMX8, SBC-IOT-iMX8
 */

module.exports = function(RED) {
    const SerialHelper = require('../lib/serial-helper');

    // ============================================
    // Serial Config Node - Shared configuration
    // ============================================
    function ClabSerialConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.port = config.port;
        node.baudRate = parseInt(config.baudRate) || 115200;
        node.dataBits = parseInt(config.dataBits) || 8;
        node.stopBits = parseInt(config.stopBits) || 1;
        node.parity = config.parity || 'none';
        node.uartMode = config.uartMode || 'rs232';
        
        node.helper = new SerialHelper();
        node.serialPort = null;
        node.users = [];

        // Port öffnen
        node.openPort = async function() {
            if (node.serialPort) {
                return node.serialPort;
            }

            try {
                // Set UART mode for backpanel port
                if (node.port === 'backpanel' || node.port === '/dev/ttymxc2') {
                    await node.helper.setUartMode(node.uartMode);
                }

                node.serialPort = await node.helper.openPort(node.port, {
                    baudRate: node.baudRate,
                    dataBits: node.dataBits,
                    stopBits: node.stopBits,
                    parity: node.parity
                });

                // Forward data events
                node.helper.on('data', (data) => {
                    node.emit('data', data);
                });

                node.helper.on('error', (err) => {
                    node.emit('error', err);
                });

                return node.serialPort;
            } catch (err) {
                throw err;
            }
        };

        // Close port
        node.closePort = async function() {
            if (node.serialPort) {
                await node.helper.closePort(node.port);
                node.serialPort = null;
            }
        };

        // Register user
        node.registerUser = function(userNode) {
            node.users.push(userNode);
        };

        node.deregisterUser = function(userNode) {
            node.users = node.users.filter(u => u !== userNode);
            if (node.users.length === 0) {
                node.closePort();
            }
        };

        // Cleanup
        node.on('close', async (done) => {
            await node.closePort();
            done();
        });
    }
    RED.nodes.registerType('clab-serial-config', ClabSerialConfigNode);

    // ============================================
    // Serial In Node - Receives serial data
    // ============================================
    function ClabSerialInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.serialConfig = RED.nodes.getNode(config.serial);
        node.outputFormat = config.outputFormat || 'string';
        node.delimiter = config.delimiter || '\n';

        if (!node.serialConfig) {
            node.status({ fill: 'red', shape: 'ring', text: 'Not configured' });
            return;
        }

        node.status({ fill: 'yellow', shape: 'dot', text: 'Connecting...' });
        
        let buffer = '';

        // Data handler
        const dataHandler = (data) => {
            try {
                let output;
                
                if (node.outputFormat === 'buffer') {
                    output = data.data;
                } else if (node.outputFormat === 'string') {
                    const str = data.data.toString('utf8');
                    
                    if (node.delimiter) {
                        buffer += str;
                        const lines = buffer.split(node.delimiter);
                        buffer = lines.pop(); // Keep last incomplete part
                        
                        for (const line of lines) {
                            if (line.length > 0) {
                                node.send({
                                    payload: line,
                                    port: data.port,
                                    timestamp: Date.now()
                                });
                            }
                        }
                        return;
                    } else {
                        output = str;
                    }
                } else {
                    // Try JSON
                    try {
                        output = JSON.parse(data.data.toString('utf8'));
                    } catch (e) {
                        output = data.data.toString('utf8');
                    }
                }

                node.send({
                    payload: output,
                    port: data.port,
                    timestamp: Date.now()
                });
                
                node.status({ fill: 'green', shape: 'dot', text: 'Received' });
            } catch (err) {
                node.error(err.message);
            }
        };

        const errorHandler = (err) => {
            node.status({ fill: 'red', shape: 'ring', text: err.error.message });
            node.error(err.error.message);
        };

        // Open port and register
        node.serialConfig.registerUser(node);
        node.serialConfig.openPort()
            .then(() => {
                node.status({ fill: 'green', shape: 'dot', text: 'Connected' });
                node.serialConfig.on('data', dataHandler);
                node.serialConfig.on('error', errorHandler);
            })
            .catch((err) => {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                node.error(err.message);
            });

        // Cleanup
        node.on('close', (done) => {
            node.serialConfig.removeListener('data', dataHandler);
            node.serialConfig.removeListener('error', errorHandler);
            node.serialConfig.deregisterUser(node);
            done();
        });
    }
    RED.nodes.registerType('clab-serial-in', ClabSerialInNode);

    // ============================================
    // Serial Out Node - Sends serial data
    // ============================================
    function ClabSerialOutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.serialConfig = RED.nodes.getNode(config.serial);
        node.appendNewline = config.appendNewline !== false;

        if (!node.serialConfig) {
            node.status({ fill: 'red', shape: 'ring', text: 'Not configured' });
            return;
        }

        node.status({ fill: 'yellow', shape: 'dot', text: 'Connecting...' });

        // Port öffnen
        node.serialConfig.registerUser(node);
        node.serialConfig.openPort()
            .then(() => {
                node.status({ fill: 'green', shape: 'dot', text: 'Ready' });
            })
            .catch((err) => {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
            });

        // Input handler
        node.on('input', async (msg, send, done) => {
            try {
                let data = msg.payload;
                
                // Convert to buffer if needed
                if (typeof data === 'string') {
                    if (node.appendNewline && !data.endsWith('\n')) {
                        data += '\n';
                    }
                    data = Buffer.from(data, 'utf8');
                } else if (typeof data === 'object' && !Buffer.isBuffer(data)) {
                    data = Buffer.from(JSON.stringify(data), 'utf8');
                }

                await node.serialConfig.helper.write(node.serialConfig.port, data);
                
                node.status({ fill: 'green', shape: 'dot', text: 'Sent' });
                
                if (done) done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                if (done) done(err);
                else node.error(err.message, msg);
            }
        });

        // Cleanup
        node.on('close', (done) => {
            node.serialConfig.deregisterUser(node);
            done();
        });
    }
    RED.nodes.registerType('clab-serial-out', ClabSerialOutNode);

    // ============================================
    // UART Mode Node - Sets RS485/RS232 mode
    // ============================================
    function ClabUartModeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.mode = config.mode || 'rs232';
        node.helper = new SerialHelper();

        node.status({ fill: 'blue', shape: 'dot', text: `Mode: ${node.mode}` });

        node.on('input', async (msg, send, done) => {
            // Get mode from msg or node config
            let mode = msg.payload || msg.mode || node.mode;
            
            // Ensure mode is a string and normalize
            mode = String(mode).toLowerCase();
            
            try {
                const result = await node.helper.setUartMode(mode);
                
                msg.payload = result;
                msg.mode = mode;
                
                send(msg);
                node.status({ fill: 'green', shape: 'dot', text: `Mode: ${mode.toUpperCase()}` });
                
                if (done) done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                if (done) done(err);
                else node.error(err.message, msg);
            }
        });
    }
    RED.nodes.registerType('clab-uart-mode', ClabUartModeNode);
};
