/**
 * CompuLab Cellular Modem Helper
 * LTE/4G Modem Funktionen für CompuLab IoT Gateways
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');

class CellularHelper {
    constructor(options = {}) {
        // Modem Konfiguration - variiert je nach Modem-Typ
        this.modemDevice = options.modemDevice || '/dev/ttyUSB2';
        this.modemInterface = options.modemInterface || 'wwan0';
        this.apn = options.apn || 'internet';
    }

    /**
     * Prüft ob Modem verfügbar ist
     */
    async isAvailable() {
        try {
            // Prüfe ob ModemManager läuft
            const { stdout } = await execAsync('mmcli -L 2>/dev/null');
            return stdout.includes('/Modem/');
        } catch (e) {
            return false;
        }
    }

    /**
     * Gibt Modem Info zurück
     */
    async getModemInfo() {
        try {
            // Finde Modem Index
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                return { success: false, error: 'Kein Modem gefunden' };
            }

            const modemIndex = modemMatch[1];
            const { stdout } = await execAsync(`mmcli -m ${modemIndex}`);

            const info = {
                success: true,
                modemIndex: modemIndex,
                manufacturer: this.extractValue(stdout, 'manufacturer'),
                model: this.extractValue(stdout, 'model'),
                revision: this.extractValue(stdout, 'revision'),
                imei: this.extractValue(stdout, 'equipment id'),
                state: this.extractValue(stdout, 'state'),
                powerState: this.extractValue(stdout, 'power state'),
                signalQuality: this.extractSignalQuality(stdout),
                accessTech: this.extractValue(stdout, 'access tech'),
                operatorName: this.extractValue(stdout, 'operator name'),
                operatorCode: this.extractValue(stdout, 'operator code')
            };

            return info;
        } catch (e) {
            throw new Error(`Modem Info fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt SIM Karten Info zurück
     */
    async getSimInfo() {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                return { success: false, error: 'Kein Modem gefunden' };
            }

            const modemIndex = modemMatch[1];
            const { stdout: modemOutput } = await execAsync(`mmcli -m ${modemIndex}`);
            
            // Finde SIM Pfad
            const simMatch = modemOutput.match(/primary sim path:\s*(\S+)/i);
            if (!simMatch || simMatch[1] === '--') {
                return { success: false, error: 'Keine SIM Karte gefunden' };
            }

            const simPath = simMatch[1];
            const { stdout } = await execAsync(`mmcli -i ${simPath}`);

            return {
                success: true,
                imsi: this.extractValue(stdout, 'imsi'),
                iccid: this.extractValue(stdout, 'iccid'),
                operatorName: this.extractValue(stdout, 'operator name'),
                operatorCode: this.extractValue(stdout, 'operator code')
            };
        } catch (e) {
            throw new Error(`SIM Info fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt Signalstärke zurück
     */
    async getSignalStrength() {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                return { success: false, error: 'Kein Modem gefunden' };
            }

            const modemIndex = modemMatch[1];
            const { stdout } = await execAsync(`mmcli -m ${modemIndex} --signal-get`);

            const signal = {
                success: true,
                timestamp: new Date().toISOString()
            };

            // LTE Signal
            const rsrpMatch = stdout.match(/rsrp:\s*([-\d.]+)/i);
            const rsrqMatch = stdout.match(/rsrq:\s*([-\d.]+)/i);
            const rssiMatch = stdout.match(/rssi:\s*([-\d.]+)/i);
            const sinrMatch = stdout.match(/snr:\s*([-\d.]+)/i);

            if (rsrpMatch) signal.rsrp = parseFloat(rsrpMatch[1]);
            if (rsrqMatch) signal.rsrq = parseFloat(rsrqMatch[1]);
            if (rssiMatch) signal.rssi = parseFloat(rssiMatch[1]);
            if (sinrMatch) signal.sinr = parseFloat(sinrMatch[1]);

            // Berechne Signalqualität in Prozent
            if (signal.rsrp) {
                // RSRP: -140 dBm (schlecht) bis -44 dBm (gut)
                signal.quality = Math.min(100, Math.max(0, 
                    Math.round((signal.rsrp + 140) / 96 * 100)
                ));
            }

            // Signalstärke Bewertung
            if (signal.rsrp) {
                if (signal.rsrp >= -80) signal.rating = 'excellent';
                else if (signal.rsrp >= -90) signal.rating = 'good';
                else if (signal.rsrp >= -100) signal.rating = 'fair';
                else if (signal.rsrp >= -110) signal.rating = 'poor';
                else signal.rating = 'very poor';
            }

            return signal;
        } catch (e) {
            throw new Error(`Signal Abfrage fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Verbindet mit dem Mobilfunknetz
     */
    async connect(apn = null) {
        try {
            const useApn = apn || this.apn;
            
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                throw new Error('Kein Modem gefunden');
            }

            const modemIndex = modemMatch[1];
            
            // Aktiviere Modem falls nötig
            await execAsync(`mmcli -m ${modemIndex} --enable`).catch(() => {});
            
            // Erstelle Verbindung
            const { stdout } = await execAsync(
                `mmcli -m ${modemIndex} --simple-connect="apn=${useApn}"`,
                { timeout: 60000 }
            );

            return {
                success: true,
                message: 'Verbunden',
                apn: useApn
            };
        } catch (e) {
            throw new Error(`Verbindung fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Trennt die Mobilfunkverbindung
     */
    async disconnect() {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                throw new Error('Kein Modem gefunden');
            }

            const modemIndex = modemMatch[1];
            await execAsync(`mmcli -m ${modemIndex} --simple-disconnect`);

            return {
                success: true,
                message: 'Getrennt'
            };
        } catch (e) {
            throw new Error(`Trennen fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Führt einen Modem Reset durch
     */
    async reset() {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                throw new Error('Kein Modem gefunden');
            }

            const modemIndex = modemMatch[1];
            await execAsync(`mmcli -m ${modemIndex} --reset`);

            return {
                success: true,
                message: 'Modem Reset durchgeführt'
            };
        } catch (e) {
            throw new Error(`Modem Reset fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Aktiviert/Deaktiviert das Modem
     */
    async setPowerState(enabled) {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                throw new Error('Kein Modem gefunden');
            }

            const modemIndex = modemMatch[1];
            const cmd = enabled ? '--enable' : '--disable';
            await execAsync(`mmcli -m ${modemIndex} ${cmd}`);

            return {
                success: true,
                enabled: enabled,
                message: enabled ? 'Modem aktiviert' : 'Modem deaktiviert'
            };
        } catch (e) {
            throw new Error(`Power State Änderung fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt Verbindungsstatus zurück
     */
    async getConnectionStatus() {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                return { success: false, connected: false, error: 'Kein Modem gefunden' };
            }

            const modemIndex = modemMatch[1];
            const { stdout } = await execAsync(`mmcli -m ${modemIndex}`);

            const state = this.extractValue(stdout, 'state');
            const connected = state === 'connected';

            const result = {
                success: true,
                connected: connected,
                state: state,
                accessTech: this.extractValue(stdout, 'access tech'),
                operatorName: this.extractValue(stdout, 'operator name')
            };

            // IP Adresse falls verbunden
            if (connected) {
                try {
                    const { stdout: ipOutput } = await execAsync(`ip addr show ${this.modemInterface} 2>/dev/null`);
                    const ipMatch = ipOutput.match(/inet\s+([\d.]+)/);
                    if (ipMatch) result.ipAddress = ipMatch[1];
                } catch (e) { /* ignorieren */ }
            }

            return result;
        } catch (e) {
            throw new Error(`Status Abfrage fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Sendet AT Befehl an das Modem
     */
    async sendATCommand(command) {
        try {
            const { stdout: listOutput } = await execAsync('mmcli -L');
            const modemMatch = listOutput.match(/\/Modem\/(\d+)/);
            
            if (!modemMatch) {
                throw new Error('Kein Modem gefunden');
            }

            const modemIndex = modemMatch[1];
            const { stdout } = await execAsync(
                `mmcli -m ${modemIndex} --command="${command}"`,
                { timeout: 10000 }
            );

            return {
                success: true,
                command: command,
                response: stdout.trim()
            };
        } catch (e) {
            throw new Error(`AT Befehl fehlgeschlagen: ${e.message}`);
        }
    }

    // Hilfsfunktionen
    extractValue(text, key) {
        const regex = new RegExp(`${key}:\\s*(.+)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    }

    extractSignalQuality(text) {
        const match = text.match(/signal quality:\s*(\d+)/i);
        return match ? parseInt(match[1]) : null;
    }
}

module.exports = CellularHelper;
