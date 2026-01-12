/**
 * CompuLab CAN Bus Node für Node-RED
 * CAN Kommunikation für IOT-GATE-iMX8 mit I/O Add-on
 */

module.exports = function(RED) {
    const CANHelper = require('../lib/can-helper');

    // ============================================
    // CAN Config Node - Gemeinsame Konfiguration
    // ============================================
    function ClabCanConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.interface = config.interface || 'can0';
        node.bitrate = parseInt(config.bitrate) || 500000;
        
        node.helper = new CANHelper(node.interface);
        node.configured = false;
        node.users = [];

        // Interface konfigurieren
        node.setup = async function() {
            if (node.configured) {
                return true;
            }

            try {
                await node.helper.setup(node.bitrate);
                node.configured = true;
                return true;
            } catch (err) {
                throw err;
            }
        };

        // Benutzer registrieren
        node.registerUser = function(userNode) {
            node.users.push(userNode);
        };

        node.deregisterUser = function(userNode) {
            node.users = node.users.filter(u => u !== userNode);
            if (node.users.length === 0) {
                node.helper.shutdown();
                node.configured = false;
            }
        };

        // Cleanup
        node.on('close', async (done) => {
            await node.helper.shutdown();
            done();
        });
    }
    RED.nodes.registerType('clab-can-config', ClabCanConfigNode);

    // ============================================
    // CAN In Node - Empfängt CAN Nachrichten
    // ============================================
    function ClabCanInNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.canConfig = RED.nodes.getNode(config.can);
        node.filterIds = config.filterIds ? config.filterIds.split(',').map(id => parseInt(id.trim(), 16)) : [];

        if (!node.canConfig) {
            node.status({ fill: 'red', shape: 'ring', text: 'Nicht konfiguriert' });
            return;
        }

        node.status({ fill: 'yellow', shape: 'dot', text: 'Initialisiere...' });

        // Message Handler
        const messageHandler = (frame) => {
            // Filter anwenden wenn konfiguriert
            if (node.filterIds.length > 0 && !node.filterIds.includes(frame.id)) {
                return;
            }

            const msg = {
                payload: {
                    id: frame.id,
                    idHex: frame.id.toString(16).toUpperCase().padStart(3, '0'),
                    dlc: frame.dlc,
                    data: frame.data,
                    dataHex: frame.data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
                },
                canId: frame.id,
                interface: frame.interface,
                timestamp: Date.now()
            };

            node.send(msg);
            node.status({ fill: 'green', shape: 'dot', text: `ID: 0x${msg.payload.idHex}` });
        };

        const errorHandler = (err) => {
            node.status({ fill: 'red', shape: 'ring', text: err.message });
            node.error(err.message);
        };

        // Setup und Listener starten
        node.canConfig.registerUser(node);
        node.canConfig.setup()
            .then(() => {
                node.canConfig.helper.on('message', messageHandler);
                node.canConfig.helper.on('error', errorHandler);
                node.canConfig.helper.startReceive();
                node.status({ fill: 'green', shape: 'dot', text: 'Empfange...' });
            })
            .catch((err) => {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                node.error(err.message);
            });

        // Cleanup
        node.on('close', (done) => {
            node.canConfig.helper.removeListener('message', messageHandler);
            node.canConfig.helper.removeListener('error', errorHandler);
            node.canConfig.deregisterUser(node);
            done();
        });
    }
    RED.nodes.registerType('clab-can-in', ClabCanInNode);

    // ============================================
    // CAN Out Node - Sendet CAN Nachrichten
    // ============================================
    function ClabCanOutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.canConfig = RED.nodes.getNode(config.can);
        node.canId = config.canId ? parseInt(config.canId, 16) : null;

        if (!node.canConfig) {
            node.status({ fill: 'red', shape: 'ring', text: 'Nicht konfiguriert' });
            return;
        }

        node.status({ fill: 'yellow', shape: 'dot', text: 'Initialisiere...' });

        // Setup
        node.canConfig.registerUser(node);
        node.canConfig.setup()
            .then(() => {
                node.status({ fill: 'green', shape: 'dot', text: 'Bereit' });
            })
            .catch((err) => {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
            });

        // Input Handler
        node.on('input', async (msg, send, done) => {
            try {
                // CAN ID bestimmen
                let canId = msg.canId || node.canId;
                if (typeof canId === 'string') {
                    canId = parseInt(canId, 16);
                }
                
                if (!canId && canId !== 0) {
                    throw new Error('Keine CAN ID angegeben');
                }

                // Daten vorbereiten
                let data;
                if (Array.isArray(msg.payload)) {
                    data = msg.payload;
                } else if (Buffer.isBuffer(msg.payload)) {
                    data = Array.from(msg.payload);
                } else if (typeof msg.payload === 'string') {
                    // Hex-String parsen
                    data = msg.payload.split(/[\s,]+/).map(h => parseInt(h, 16));
                } else if (typeof msg.payload === 'object' && msg.payload.data) {
                    data = msg.payload.data;
                    canId = msg.payload.id || canId;
                } else {
                    throw new Error('Ungültiges Datenformat');
                }

                // Senden
                const result = await node.canConfig.helper.send(canId, data);
                
                node.status({ 
                    fill: 'green', 
                    shape: 'dot', 
                    text: `Gesendet: 0x${canId.toString(16).toUpperCase()}` 
                });

                // Bestätigung senden
                msg.result = result;
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
            node.canConfig.deregisterUser(node);
            done();
        });
    }
    RED.nodes.registerType('clab-can-out', ClabCanOutNode);
};
