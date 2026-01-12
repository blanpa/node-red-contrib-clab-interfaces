/**
 * CompuLab GPS Node
 * Consolidated node for GPS functions
 */

const GPSHelper = require('../lib/gps-helper');

module.exports = function(RED) {
    
    function ClabGpsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const gps = new GPSHelper({ device: config.device });
        
        let intervalId = null;

        async function readAndSend(msg = {}) {
            const action = msg.action || config.action || 'position';
            
            try {
                let result;
                
                switch (action) {
                    case 'position':
                        result = await gps.getPosition();
                        if (result.fix === 'yes') {
                            node.status({ fill: 'green', shape: 'dot', text: `${result.latitude?.toFixed(5)}, ${result.longitude?.toFixed(5)}` });
                        } else {
                            node.status({ fill: 'yellow', shape: 'ring', text: 'No Fix' });
                        }
                        break;
                        
                    case 'satellites':
                        result = await gps.getSatellites();
                        node.status({ fill: result.used > 0 ? 'green' : 'yellow', shape: 'dot', text: `${result.used}/${result.visible} Sat` });
                        break;
                        
                    case 'distance':
                        const lat1 = msg.lat1 || msg.payload?.lat1 || config.lat1;
                        const lon1 = msg.lon1 || msg.payload?.lon1 || config.lon1;
                        const lat2 = msg.lat2 || msg.payload?.lat2 || config.lat2;
                        const lon2 = msg.lon2 || msg.payload?.lon2 || config.lon2;
                        
                        if (!lat1 || !lon1 || !lat2 || !lon2) {
                            throw new Error('Coordinates missing (lat1, lon1, lat2, lon2)');
                        }
                        
                        const distance = gps.calculateDistance(
                            parseFloat(lat1), parseFloat(lon1),
                            parseFloat(lat2), parseFloat(lon2)
                        );
                        
                        result = {
                            distance: distance,
                            distanceKm: distance / 1000,
                            distanceMiles: distance / 1609.344,
                            from: { lat: parseFloat(lat1), lon: parseFloat(lon1) },
                            to: { lat: parseFloat(lat2), lon: parseFloat(lon2) }
                        };
                        node.status({ fill: 'green', shape: 'dot', text: `${(distance / 1000).toFixed(2)} km` });
                        break;
                        
                    case 'start-gpsd':
                        result = await gps.startGpsd();
                        node.status({ fill: 'green', shape: 'dot', text: 'gpsd started' });
                        break;
                        
                    case 'stop-gpsd':
                        result = await gps.stopGpsd();
                        node.status({ fill: 'grey', shape: 'dot', text: 'gpsd stopped' });
                        break;
                        
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                msg.payload = result;
                msg.action = action;
                return msg;
                
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: err.message });
                throw err;
            }
        }

        node.on('input', async function(msg) {
            try {
                const result = await readAndSend(msg);
                node.send(result);
            } catch (err) {
                node.error(err.message, msg);
            }
        });

        // Automatic polling if configured
        if (config.interval && config.interval > 0) {
            intervalId = setInterval(async () => {
                try {
                    const result = await readAndSend({ action: config.action || 'position' });
                    node.send(result);
                } catch (err) {
                    node.error(err.message);
                }
            }, config.interval);
        }

        node.on('close', function() {
            if (intervalId) {
                clearInterval(intervalId);
            }
            node.status({});
        });
    }
    
    RED.nodes.registerType('clab-gps', ClabGpsNode);
};
