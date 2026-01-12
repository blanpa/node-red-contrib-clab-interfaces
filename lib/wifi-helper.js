/**
 * CompuLab WiFi Helper
 * WiFi Funktionen für CompuLab IoT Gateways
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class WiFiHelper {
    constructor(options = {}) {
        this.interface = options.interface || 'wlan0';
    }

    /**
     * Prüft ob WiFi verfügbar ist
     */
    async isAvailable() {
        try {
            const { stdout } = await execAsync(`nmcli device status | grep ${this.interface}`);
            return stdout.trim().length > 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gibt WiFi Status zurück
     */
    async getStatus() {
        try {
            const { stdout } = await execAsync(`nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status | grep ${this.interface}`);
            const parts = stdout.trim().split(':');
            
            const status = {
                interface: parts[0] || this.interface,
                type: parts[1] || 'wifi',
                state: parts[2] || 'unknown',
                connection: parts[3] || null,
                connected: parts[2] === 'connected'
            };

            // Wenn verbunden, hole mehr Details
            if (status.connected && status.connection) {
                const details = await this.getConnectionDetails(status.connection);
                Object.assign(status, details);
            }

            return status;
        } catch (e) {
            throw new Error(`WiFi Status fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt Verbindungsdetails zurück
     */
    async getConnectionDetails(connectionName) {
        try {
            const { stdout } = await execAsync(`nmcli -t -f IP4.ADDRESS,IP4.GATEWAY,IP4.DNS,GENERAL.STATE connection show "${connectionName}" 2>/dev/null`);
            
            const details = {};
            const lines = stdout.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('IP4.ADDRESS')) {
                    details.ipAddress = line.split(':')[1]?.split('/')[0];
                }
                if (line.startsWith('IP4.GATEWAY')) {
                    details.gateway = line.split(':')[1];
                }
                if (line.startsWith('IP4.DNS')) {
                    details.dns = line.split(':')[1];
                }
            }

            // Signal Stärke
            try {
                const { stdout: iwOutput } = await execAsync(`iwconfig ${this.interface} 2>/dev/null | grep "Signal level"`);
                const signalMatch = iwOutput.match(/Signal level[=:](-?\d+)/);
                if (signalMatch) {
                    details.signalDbm = parseInt(signalMatch[1]);
                    // Umrechnung in Prozent (ungefähr)
                    details.signalPercent = Math.min(100, Math.max(0, 2 * (details.signalDbm + 100)));
                }
            } catch (e) { /* ignorieren */ }

            return details;
        } catch (e) {
            return {};
        }
    }

    /**
     * Aktiviert WiFi
     */
    async enable() {
        try {
            await execAsync('nmcli radio wifi on');
            return { success: true, message: 'WiFi aktiviert' };
        } catch (e) {
            throw new Error(`WiFi aktivieren fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Deaktiviert WiFi
     */
    async disable() {
        try {
            await execAsync('nmcli radio wifi off');
            return { success: true, message: 'WiFi deaktiviert' };
        } catch (e) {
            throw new Error(`WiFi deaktivieren fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Scannt nach WiFi Netzwerken
     */
    async scan() {
        try {
            // Rescan erzwingen
            await execAsync(`nmcli device wifi rescan ifname ${this.interface} 2>/dev/null`).catch(() => {});
            
            // Kurz warten
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const { stdout } = await execAsync('nmcli -t -f SSID,BSSID,MODE,CHAN,FREQ,RATE,SIGNAL,SECURITY device wifi list');
            
            const networks = [];
            const lines = stdout.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                const parts = line.split(':');
                if (parts[0]) {  // SSID vorhanden
                    networks.push({
                        ssid: parts[0],
                        bssid: parts[1],
                        mode: parts[2],
                        channel: parseInt(parts[3]) || null,
                        frequency: parts[4],
                        rate: parts[5],
                        signal: parseInt(parts[6]) || 0,
                        security: parts[7] || 'Open'
                    });
                }
            }

            // Nach Signalstärke sortieren
            networks.sort((a, b) => b.signal - a.signal);

            return {
                success: true,
                networks: networks,
                count: networks.length
            };
        } catch (e) {
            throw new Error(`WiFi Scan fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Verbindet mit einem WiFi Netzwerk
     */
    async connect(ssid, password = null) {
        try {
            let cmd;
            if (password) {
                cmd = `nmcli device wifi connect "${ssid}" password "${password}" ifname ${this.interface}`;
            } else {
                cmd = `nmcli device wifi connect "${ssid}" ifname ${this.interface}`;
            }

            const { stdout } = await execAsync(cmd, { timeout: 30000 });
            
            const success = stdout.includes('successfully activated');
            
            return {
                success: success,
                ssid: ssid,
                message: success ? 'Verbunden' : 'Verbindung fehlgeschlagen'
            };
        } catch (e) {
            throw new Error(`WiFi Verbindung fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Trennt die WiFi Verbindung
     */
    async disconnect() {
        try {
            await execAsync(`nmcli device disconnect ${this.interface}`);
            return { success: true, message: 'WiFi getrennt' };
        } catch (e) {
            throw new Error(`WiFi trennen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Erstellt einen Access Point (Hotspot)
     */
    async createAccessPoint(ssid, password, band = 'bg') {
        try {
            // Lösche existierenden Hotspot falls vorhanden
            await execAsync(`nmcli connection delete "${ssid}" 2>/dev/null`).catch(() => {});

            // Erstelle neuen Hotspot
            let cmd = `nmcli device wifi hotspot ifname ${this.interface} ssid "${ssid}"`;
            if (password) {
                cmd += ` password "${password}"`;
            }
            if (band === 'a') {
                cmd += ' band a';
            }

            await execAsync(cmd, { timeout: 30000 });

            return {
                success: true,
                ssid: ssid,
                message: 'Access Point erstellt'
            };
        } catch (e) {
            throw new Error(`Access Point erstellen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Stoppt den Access Point
     */
    async stopAccessPoint() {
        try {
            await execAsync(`nmcli device disconnect ${this.interface}`);
            return { success: true, message: 'Access Point gestoppt' };
        } catch (e) {
            throw new Error(`Access Point stoppen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt gespeicherte Verbindungen zurück
     */
    async getSavedConnections() {
        try {
            const { stdout } = await execAsync('nmcli -t -f NAME,TYPE,DEVICE connection show | grep wifi');
            
            const connections = [];
            const lines = stdout.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                const parts = line.split(':');
                connections.push({
                    name: parts[0],
                    type: parts[1],
                    device: parts[2] || null,
                    active: !!parts[2]
                });
            }

            return {
                success: true,
                connections: connections,
                count: connections.length
            };
        } catch (e) {
            return { success: true, connections: [], count: 0 };
        }
    }

    /**
     * Löscht eine gespeicherte Verbindung
     */
    async deleteConnection(name) {
        try {
            await execAsync(`nmcli connection delete "${name}"`);
            return { success: true, message: `Verbindung "${name}" gelöscht` };
        } catch (e) {
            throw new Error(`Verbindung löschen fehlgeschlagen: ${e.message}`);
        }
    }
}

module.exports = WiFiHelper;
