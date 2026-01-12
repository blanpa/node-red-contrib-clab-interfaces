/**
 * Serial/RS485/RS232 Helper für CompuLab IoT Gateways
 * Unterstützt IOT-GATE-iMX8, SBC-IOT-iMX8
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// Serielle Port Mappings für CompuLab Geräte
const SERIAL_MAPPINGS = {
    'IOT-GATE-iMX8': {
        console: '/dev/ttyUSB0',
        backpanel: '/dev/ttymxc2',  // RS485/RS232 auf der Rückseite
        addon_rs232: '/dev/ttymxc1',
        addon_rs485: '/dev/ttymxc3',
        modeSwitch: { gpio: 507, type: 'gpio' }  // RS485/RS232 Umschaltung
    },
    'SBC-IOT-iMX8': {
        console: '/dev/ttyUSB0',
        backpanel: '/dev/ttymxc2',
        addon_rs232: '/dev/ttymxc1',
        addon_rs485: '/dev/ttymxc3',
        modeSwitch: { gpio: 507, type: 'gpio' }
    },
    'IOT-GATE-IMX8PLUS': {
        console: '/dev/ttyUSB0',
        backpanel: '/dev/ttymxc2',
        addon_rs232: '/dev/ttymxc1',
        addon_rs485: '/dev/ttymxc3',
        modeSwitch: { gpio: 507, type: 'gpio' }
    },
    'SBC-IOT-IMX8PLUS': {
        console: '/dev/ttyUSB0',
        backpanel: '/dev/ttymxc2',
        addon_rs232: '/dev/ttymxc1',
        addon_rs485: '/dev/ttymxc3',
        modeSwitch: { gpio: 507, type: 'gpio' }
    },
    'IOT-DIN-IMX8PLUS': {
        // DIN-Rail Gerät mit eingebautem RS485
        console: '/dev/ttyUSB0',
        rs485: '/dev/ttymxc2',  // Eingebauter RS485
        modeSwitch: null  // Kein Mode-Switch, nur RS485
    },
    'IOT-LINK': {
        // i.MX93 basiert, verwendet ttyLP* statt ttymxc*
        console: '/dev/ttyUSB0',
        rs485_a: '/dev/ttyLP6',  // FARS4 Config Option
        rs485_b: '/dev/ttyLP4',  // FBRS4 Config Option
        modeSwitch: null,  // Kein Mode-Switch
        // Hinweis: RS485 und CAN sind exklusiv (FARS4/FBRS4 vs FACAN/FBCAN)
        exclusiveWithCAN: true
    },
    'IOT-GATE-RPi': {
        console: '/dev/ttyAMA0',
        usb0: '/dev/ttyUSB0',
        usb1: '/dev/ttyUSB1',
        rs485_0: '/dev/ttyAMA1',
        rs485_1: '/dev/ttyAMA2',
        rs485_2: '/dev/ttyAMA3',
        rs485_3: '/dev/ttyAMA4',
        modeSwitch: null
    }
};

// RS485/RS232 Mode GPIO Pfad
const RS485_MODE_GPIO = '/sys/class/gpio/gpio507/value';
const RS485_MODE_EXPORT = '/sys/class/gpio/export';

class SerialHelper extends EventEmitter {
    constructor(deviceType = 'IOT-GATE-iMX8') {
        super();
        this.deviceType = deviceType;
        this.mapping = SERIAL_MAPPINGS[deviceType] || SERIAL_MAPPINGS['IOT-GATE-iMX8'];
        this.SerialPort = null;
        this.ports = {};
        
        // Versuche serialport zu laden
        try {
            this.SerialPort = require('serialport').SerialPort;
        } catch (e) {
            console.warn('serialport module not available, using mock mode');
        }
    }

    /**
     * Setzt den RS485/RS232 Modus für den Backpanel Port
     * @param {string} mode - 'rs485' oder 'rs232'
     */
    async setUartMode(mode) {
        // Ensure mode is a string
        const modeStr = String(mode || 'rs232').toLowerCase();
        const value = modeStr === 'rs485' ? '1' : '0';
        
        try {
            // GPIO exportieren wenn nötig
            if (!fs.existsSync(RS485_MODE_GPIO)) {
                try {
                    fs.writeFileSync(RS485_MODE_EXPORT, '507');
                } catch (e) {
                    // Bereits exportiert
                }
                // Direction setzen
                try {
                    fs.writeFileSync('/sys/class/gpio/gpio507/direction', 'out');
                } catch (e) {
                    // Ignorieren
                }
            }
            
            fs.writeFileSync(RS485_MODE_GPIO, value);
            return { success: true, mode: mode };
        } catch (e) {
            throw new Error(`Failed to set UART mode: ${e.message}`);
        }
    }

    /**
     * Liest den aktuellen UART Modus
     */
    getUartMode() {
        try {
            if (fs.existsSync(RS485_MODE_GPIO)) {
                const value = fs.readFileSync(RS485_MODE_GPIO, 'utf8').trim();
                return value === '1' ? 'rs485' : 'rs232';
            }
        } catch (e) {
            // Ignorieren
        }
        return 'unknown';
    }

    /**
     * Öffnet einen seriellen Port
     */
    async openPort(portName, options = {}) {
        const portPath = this.mapping[portName] || portName;
        
        const defaultOptions = {
            baudRate: 115200,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: false
        };
        
        const portOptions = { ...defaultOptions, ...options, path: portPath };
        
        if (!this.SerialPort) {
            // Mock-Modus für Entwicklung
            return {
                path: portPath,
                mock: true,
                write: (data) => console.log(`Mock write to ${portPath}:`, data),
                close: () => console.log(`Mock close ${portPath}`)
            };
        }
        
        return new Promise((resolve, reject) => {
            const port = new this.SerialPort(portOptions, (err) => {
                if (err) {
                    reject(new Error(`Failed to open port ${portPath}: ${err.message}`));
                } else {
                    this.ports[portName] = port;
                    
                    port.on('data', (data) => {
                        this.emit('data', { port: portName, data: data });
                    });
                    
                    port.on('error', (err) => {
                        this.emit('error', { port: portName, error: err });
                    });
                    
                    resolve(port);
                }
            });
        });
    }

    /**
     * Schreibt Daten auf einen Port
     */
    async write(portName, data) {
        const port = this.ports[portName];
        if (!port) {
            throw new Error(`Port ${portName} not open`);
        }
        
        return new Promise((resolve, reject) => {
            port.write(data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    port.drain((err) => {
                        if (err) reject(err);
                        else resolve(true);
                    });
                }
            });
        });
    }

    /**
     * Schließt einen Port
     */
    async closePort(portName) {
        const port = this.ports[portName];
        if (port) {
            return new Promise((resolve, reject) => {
                port.close((err) => {
                    if (err) reject(err);
                    else {
                        delete this.ports[portName];
                        resolve(true);
                    }
                });
            });
        }
        return true;
    }

    /**
     * Schließt alle Ports
     */
    async closeAll() {
        for (const portName of Object.keys(this.ports)) {
            await this.closePort(portName);
        }
    }

    /**
     * Listet verfügbare serielle Ports
     */
    async listPorts() {
        if (this.SerialPort) {
            try {
                const { SerialPort } = require('serialport');
                const ports = await SerialPort.list();
                return ports;
            } catch (e) {
                return [];
            }
        }
        
        // Fallback: Prüfe bekannte Pfade
        const available = [];
        for (const [name, path] of Object.entries(this.mapping)) {
            if (fs.existsSync(path)) {
                available.push({ name, path });
            }
        }
        return available;
    }

    /**
     * Gibt die Port-Mappings zurück
     */
    getPortMappings() {
        return this.mapping;
    }
}

module.exports = SerialHelper;
