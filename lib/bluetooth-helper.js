/**
 * CompuLab Bluetooth Helper
 * Bluetooth Funktionen für CompuLab IoT Gateways
 */

const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class BluetoothHelper {
    constructor() {
        this.scanProcess = null;
    }

    /**
     * Prüft ob Bluetooth verfügbar ist
     */
    async isAvailable() {
        try {
            const { stdout } = await execAsync('hciconfig -a 2>/dev/null | head -1');
            return stdout.trim().length > 0;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gibt Bluetooth Adapter Info zurück
     */
    async getAdapterInfo() {
        try {
            const { stdout } = await execAsync('hciconfig -a');
            const lines = stdout.split('\n');
            
            const info = {
                adapter: null,
                address: null,
                status: 'unknown',
                name: null
            };

            for (const line of lines) {
                if (line.match(/^hci\d+:/)) {
                    info.adapter = line.split(':')[0];
                }
                if (line.includes('BD Address:')) {
                    const match = line.match(/BD Address:\s*([0-9A-F:]+)/i);
                    if (match) info.address = match[1];
                }
                if (line.includes('UP RUNNING')) {
                    info.status = 'up';
                } else if (line.includes('DOWN')) {
                    info.status = 'down';
                }
                if (line.includes('Name:')) {
                    const match = line.match(/Name:\s*'([^']+)'/);
                    if (match) info.name = match[1];
                }
            }

            return info;
        } catch (e) {
            throw new Error(`Bluetooth Adapter Info fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Aktiviert Bluetooth
     */
    async enable() {
        try {
            await execAsync('sudo hciconfig hci0 up');
            await execAsync('sudo systemctl start bluetooth');
            return { success: true, message: 'Bluetooth aktiviert' };
        } catch (e) {
            throw new Error(`Bluetooth aktivieren fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Deaktiviert Bluetooth
     */
    async disable() {
        try {
            await execAsync('sudo hciconfig hci0 down');
            return { success: true, message: 'Bluetooth deaktiviert' };
        } catch (e) {
            throw new Error(`Bluetooth deaktivieren fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Scannt nach Bluetooth Geräten
     * @param {number} duration - Scan-Dauer in Sekunden (default: 10)
     */
    async scan(duration = 10) {
        try {
            // Verwende bluetoothctl für den Scan
            const { stdout } = await execAsync(
                `timeout ${duration} bluetoothctl scan on 2>&1 & sleep ${duration} && bluetoothctl devices`,
                { timeout: (duration + 5) * 1000 }
            );

            const devices = [];
            const lines = stdout.split('\n');

            for (const line of lines) {
                const match = line.match(/Device\s+([0-9A-F:]+)\s+(.+)/i);
                if (match) {
                    devices.push({
                        address: match[1],
                        name: match[2].trim()
                    });
                }
            }

            return {
                success: true,
                devices: devices,
                count: devices.length,
                duration: duration
            };
        } catch (e) {
            // Timeout ist OK, bedeutet Scan ist fertig
            if (e.killed) {
                return await this.getDevices();
            }
            throw new Error(`Bluetooth Scan fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt bekannte Geräte zurück
     */
    async getDevices() {
        try {
            const { stdout } = await execAsync('bluetoothctl devices');
            const devices = [];
            const lines = stdout.split('\n');

            for (const line of lines) {
                const match = line.match(/Device\s+([0-9A-F:]+)\s+(.+)/i);
                if (match) {
                    devices.push({
                        address: match[1],
                        name: match[2].trim()
                    });
                }
            }

            return {
                success: true,
                devices: devices,
                count: devices.length
            };
        } catch (e) {
            throw new Error(`Geräteliste fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Verbindet mit einem Bluetooth Gerät
     * @param {string} address - MAC Adresse des Geräts
     */
    async connect(address) {
        try {
            // Erst pairen falls nötig
            await execAsync(`bluetoothctl pair ${address}`, { timeout: 30000 }).catch(() => {});
            
            // Trust setzen
            await execAsync(`bluetoothctl trust ${address}`);
            
            // Verbinden
            const { stdout } = await execAsync(`bluetoothctl connect ${address}`, { timeout: 30000 });
            
            const success = stdout.includes('Connection successful');
            
            return {
                success: success,
                address: address,
                message: success ? 'Verbunden' : 'Verbindung fehlgeschlagen'
            };
        } catch (e) {
            throw new Error(`Bluetooth Verbindung fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Trennt Verbindung zu einem Bluetooth Gerät
     * @param {string} address - MAC Adresse des Geräts
     */
    async disconnect(address) {
        try {
            await execAsync(`bluetoothctl disconnect ${address}`);
            return {
                success: true,
                address: address,
                message: 'Getrennt'
            };
        } catch (e) {
            throw new Error(`Bluetooth Trennung fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Entfernt ein gepairtes Gerät
     * @param {string} address - MAC Adresse des Geräts
     */
    async remove(address) {
        try {
            await execAsync(`bluetoothctl remove ${address}`);
            return {
                success: true,
                address: address,
                message: 'Gerät entfernt'
            };
        } catch (e) {
            throw new Error(`Gerät entfernen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt Verbindungsstatus eines Geräts zurück
     * @param {string} address - MAC Adresse des Geräts
     */
    async getConnectionStatus(address) {
        try {
            const { stdout } = await execAsync(`bluetoothctl info ${address}`);
            
            const connected = stdout.includes('Connected: yes');
            const paired = stdout.includes('Paired: yes');
            const trusted = stdout.includes('Trusted: yes');
            
            let name = null;
            const nameMatch = stdout.match(/Name:\s*(.+)/);
            if (nameMatch) name = nameMatch[1].trim();

            return {
                address: address,
                name: name,
                connected: connected,
                paired: paired,
                trusted: trusted
            };
        } catch (e) {
            return {
                address: address,
                connected: false,
                paired: false,
                trusted: false,
                error: e.message
            };
        }
    }
}

module.exports = BluetoothHelper;
