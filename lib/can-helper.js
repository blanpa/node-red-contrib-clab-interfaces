/**
 * CAN Bus Helper für CompuLab IoT Gateways
 */

const { execSync, spawn } = require('child_process');
const EventEmitter = require('events');

class CANHelper extends EventEmitter {
    constructor(interfaceName = 'can0') {
        super();
        this.interface = interfaceName;
        this.listener = null;
    }

    /**
     * Konfiguriert das CAN Interface
     */
    async setup(bitrate = 500000) {
        try {
            // Interface herunterfahren falls aktiv
            try {
                execSync(`ip link set ${this.interface} down`, { stdio: 'pipe' });
            } catch (e) { /* ignorieren */ }

            // Bitrate setzen und aktivieren
            execSync(`ip link set ${this.interface} type can bitrate ${bitrate}`, { stdio: 'pipe' });
            execSync(`ip link set ${this.interface} up`, { stdio: 'pipe' });
            
            return { success: true, interface: this.interface, bitrate };
        } catch (e) {
            throw new Error(`CAN setup failed: ${e.message}`);
        }
    }

    /**
     * Sendet eine CAN Nachricht
     */
    async send(canId, data) {
        const hexData = Array.isArray(data) 
            ? data.map(b => b.toString(16).padStart(2, '0')).join('')
            : data;
        
        const frame = `${canId.toString(16).toUpperCase()}#${hexData}`;
        
        try {
            execSync(`cansend ${this.interface} ${frame}`, { stdio: 'pipe' });
            return { success: true, frame };
        } catch (e) {
            throw new Error(`CAN send failed: ${e.message}`);
        }
    }

    /**
     * Startet das Empfangen von CAN Nachrichten
     */
    startReceive() {
        if (this.listener) {
            return;
        }

        this.listener = spawn('candump', [this.interface], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        this.listener.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            for (const line of lines) {
                const parsed = this._parseCanFrame(line);
                if (parsed) {
                    this.emit('message', parsed);
                }
            }
        });

        this.listener.on('error', (err) => {
            this.emit('error', err);
        });

        this.listener.on('close', () => {
            this.listener = null;
        });
    }

    /**
     * Stoppt das Empfangen
     */
    stopReceive() {
        if (this.listener) {
            this.listener.kill();
            this.listener = null;
        }
    }

    /**
     * Parst eine candump Zeile
     */
    _parseCanFrame(line) {
        // Format: can0  123   [8]  01 02 03 04 05 06 07 08
        const match = line.match(/(\w+)\s+([0-9A-Fa-f]+)\s+\[(\d+)\]\s+(.*)/);
        if (match) {
            const dataBytes = match[4].trim().split(/\s+/).map(h => parseInt(h, 16));
            return {
                interface: match[1],
                id: parseInt(match[2], 16),
                dlc: parseInt(match[3], 10),
                data: dataBytes
            };
        }
        return null;
    }

    /**
     * Deaktiviert das CAN Interface
     */
    async shutdown() {
        this.stopReceive();
        try {
            execSync(`ip link set ${this.interface} down`, { stdio: 'pipe' });
        } catch (e) { /* ignorieren */ }
    }
}

module.exports = CANHelper;
