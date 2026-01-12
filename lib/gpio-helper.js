/**
 * GPIO Helper für CompuLab IoT Gateways
 * Unterstützt IOT-GATE-iMX8, SBC-IOT-iMX8, IOT-GATE-RPi
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// GPIO Chip Mappings für verschiedene CompuLab Geräte
const GPIO_MAPPINGS = {
    'IOT-GATE-iMX8': {
        // Digital Inputs (I/O add-on)
        inputs: {
            IN0: { chip: 2, line: 0, pin: 15 },
            IN1: { chip: 2, line: 1, pin: 17 },
            IN2: { chip: 2, line: 6, pin: 16 },
            IN3: { chip: 2, line: 7, pin: 18 }
        },
        // Digital Outputs (I/O add-on)
        outputs: {
            OUT0: { chip: 2, line: 8, pin: 11 },
            OUT1: { chip: 2, line: 9, pin: 13 },
            OUT2: { chip: 5, line: 9, pin: 12 },
            OUT3: { chip: 5, line: 10, pin: 14 }
        },
        // User LED (DS4)
        led: {
            green: { chip: 2, line: 25 },
            yellow: { chip: 2, line: 19 }
        },
        hasAnalog: true,
        hasCAN: true
    },
    'SBC-IOT-iMX8': {
        inputs: {
            IN0: { chip: 2, line: 0, pin: 15 },
            IN1: { chip: 2, line: 1, pin: 17 },
            IN2: { chip: 2, line: 6, pin: 16 },
            IN3: { chip: 2, line: 7, pin: 18 }
        },
        outputs: {
            OUT0: { chip: 2, line: 8, pin: 11 },
            OUT1: { chip: 2, line: 9, pin: 13 },
            OUT2: { chip: 5, line: 9, pin: 12 },
            OUT3: { chip: 5, line: 10, pin: 14 }
        },
        led: {
            green: { chip: 2, line: 25 },
            yellow: { chip: 2, line: 19 }
        },
        hasAnalog: true,
        hasCAN: true
    },
    'IOT-GATE-IMX8PLUS': {
        // Ähnlich wie IOT-GATE-iMX8 (I/O add-on)
        inputs: {
            IN0: { chip: 2, line: 0, pin: 15 },
            IN1: { chip: 2, line: 1, pin: 17 },
            IN2: { chip: 2, line: 6, pin: 16 },
            IN3: { chip: 2, line: 7, pin: 18 }
        },
        outputs: {
            OUT0: { chip: 2, line: 8, pin: 11 },
            OUT1: { chip: 2, line: 9, pin: 13 },
            OUT2: { chip: 5, line: 9, pin: 12 },
            OUT3: { chip: 5, line: 10, pin: 14 }
        },
        led: {
            green: { chip: 2, line: 25 },
            yellow: { chip: 2, line: 19 }
        },
        hasAnalog: true,
        hasCAN: true
    },
    'SBC-IOT-IMX8PLUS': {
        inputs: {
            IN0: { chip: 2, line: 0, pin: 15 },
            IN1: { chip: 2, line: 1, pin: 17 },
            IN2: { chip: 2, line: 6, pin: 16 },
            IN3: { chip: 2, line: 7, pin: 18 }
        },
        outputs: {
            OUT0: { chip: 2, line: 8, pin: 11 },
            OUT1: { chip: 2, line: 9, pin: 13 },
            OUT2: { chip: 5, line: 9, pin: 12 },
            OUT3: { chip: 5, line: 10, pin: 14 }
        },
        led: {
            green: { chip: 2, line: 25 },
            yellow: { chip: 2, line: 19 }
        },
        hasAnalog: true,
        hasCAN: true
    },
    'IOT-DIN-IMX8PLUS': {
        // Nur 2 Eingänge + 2 Ausgänge (eingebaut, CLT03-2Q3 / TPS272C)
        inputs: {
            DI0: { chip: 1, line: 0, pin: 2, description: 'Digital Input 0' },
            DI1: { chip: 1, line: 4, pin: 4, description: 'Digital Input 1' }
        },
        outputs: {
            DO0: { chip: 1, line: 8, pin: 3, description: 'Digital Output 0' },
            DO1: { chip: 1, line: 9, pin: 5, description: 'Digital Output 1' }
        },
        led: null,  // Keine User LED
        hasAnalog: false,
        hasCAN: false
    },
    'IOT-LINK': {
        // i.MX93 basiert, 3 Digital I/Os
        inputs: {
            DIO0: { chip: 0, line: 0, pin: 1, description: 'Digital I/O 0' },
            DIO1: { chip: 0, line: 1, pin: 2, description: 'Digital I/O 1' },
            DIO2: { chip: 0, line: 2, pin: 3, description: 'Digital I/O 2' }
        },
        outputs: {
            DIO0: { chip: 0, line: 0, pin: 1, description: 'Digital I/O 0' },
            DIO1: { chip: 0, line: 1, pin: 2, description: 'Digital I/O 1' },
            DIO2: { chip: 0, line: 2, pin: 3, description: 'Digital I/O 2' }
        },
        led: null,  // Keine User LED
        hasAnalog: false,
        hasCAN: true,  // Optional, exklusiv mit RS485
        canExclusiveWithRS485: true
    },
    'IOT-GATE-RPi': {
        // Raspberry Pi GPIO Mapping
        inputs: {
            IN0: { chip: 0, line: 17, pin: 11 },
            IN1: { chip: 0, line: 27, pin: 13 },
            IN2: { chip: 0, line: 22, pin: 15 },
            IN3: { chip: 0, line: 23, pin: 16 },
            IN4: { chip: 0, line: 5, pin: 29 },
            IN5: { chip: 0, line: 6, pin: 31 },
            IN6: { chip: 0, line: 13, pin: 33 },
            IN7: { chip: 0, line: 19, pin: 35 }
        },
        outputs: {
            OUT0: { chip: 0, line: 24, pin: 18 },
            OUT1: { chip: 0, line: 25, pin: 22 },
            OUT2: { chip: 0, line: 8, pin: 24 },
            OUT3: { chip: 0, line: 7, pin: 26 },
            OUT4: { chip: 0, line: 12, pin: 32 },
            OUT5: { chip: 0, line: 16, pin: 36 },
            OUT6: { chip: 0, line: 20, pin: 38 },
            OUT7: { chip: 0, line: 21, pin: 40 }
        },
        led: {
            green: { chip: 0, line: 18 },
            yellow: { chip: 0, line: 12 }
        },
        hasAnalog: false,
        hasCAN: true
    }
};

class GPIOHelper {
    constructor(deviceType = 'IOT-GATE-iMX8') {
        this.deviceType = deviceType;
        this.mapping = GPIO_MAPPINGS[deviceType] || GPIO_MAPPINGS['IOT-GATE-iMX8'];
        this.useGpiotools = this._checkGpiotools();
        this.useSysfs = !this.useGpiotools;
    }

    /**
     * Prüft ob gpioget/gpioset verfügbar sind
     */
    _checkGpiotools() {
        try {
            execSync('which gpioget', { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Erkennt den Gerätetyp automatisch
     */
    static detectDevice() {
        try {
            // Prüfe auf CompuLab Baseboard
            if (fs.existsSync('/proc/device-tree/baseboard-sn')) {
                let options = '';
                try {
                    options = fs.readFileSync('/proc/device-tree/baseboard-options', 'utf8').replace(/\0/g, '');
                } catch (e) { /* ignorieren */ }
                
                // IOT-DIN-IMX8PLUS
                if (options.includes('IOT-DIN-IMX8PLUS') || options.includes('IOTD-IMX8P')) {
                    return 'IOT-DIN-IMX8PLUS';
                }
                // IOT-GATE-IMX8PLUS / SBC-IOT-IMX8PLUS
                if (options.includes('IOT-GATE-IMX8PLUS')) {
                    return 'IOT-GATE-IMX8PLUS';
                }
                if (options.includes('SBC-IOT-IMX8PLUS')) {
                    return 'SBC-IOT-IMX8PLUS';
                }
                // IOT-GATE-iMX8 / SBC-IOT-iMX8 (ältere Versionen)
                if (options.includes('IOT-GATE-iMX8')) {
                    return 'IOT-GATE-iMX8';
                }
                if (options.includes('SBC-IOT-iMX8')) {
                    return 'SBC-IOT-iMX8';
                }
            }
            
            // Prüfe auf IOT-LINK (i.MX93)
            if (fs.existsSync('/proc/device-tree/model')) {
                const model = fs.readFileSync('/proc/device-tree/model', 'utf8').replace(/\0/g, '');
                
                if (model.includes('IOT-LINK') || model.includes('imx93')) {
                    return 'IOT-LINK';
                }
                if (model.includes('Raspberry Pi')) {
                    return 'IOT-GATE-RPi';
                }
            }
            
            // Prüfe auf CPU Typ
            if (fs.existsSync('/proc/cpuinfo')) {
                const cpuinfo = fs.readFileSync('/proc/cpuinfo', 'utf8');
                if (cpuinfo.includes('i.MX93')) {
                    return 'IOT-LINK';
                }
            }
        } catch (e) {
            // Fallback
        }
        return 'IOT-GATE-iMX8';
    }
    
    /**
     * Gibt Geräte-Capabilities zurück
     */
    getCapabilities() {
        return {
            inputs: Object.keys(this.mapping.inputs || {}),
            outputs: Object.keys(this.mapping.outputs || {}),
            hasLED: !!this.mapping.led,
            hasAnalog: !!this.mapping.hasAnalog,
            hasCAN: !!this.mapping.hasCAN,
            canExclusiveWithRS485: !!this.mapping.canExclusiveWithRS485,
            deviceType: this.deviceType
        };
    }

    /**
     * Liest einen digitalen Eingang
     */
    readInput(inputName) {
        const input = this.mapping.inputs[inputName];
        if (!input) {
            throw new Error(`Unknown input: ${inputName}`);
        }

        if (this.useGpiotools) {
            try {
                const result = execSync(`gpioget ${input.chip} ${input.line}`, { 
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                return parseInt(result.trim(), 10);
            } catch (e) {
                throw new Error(`Failed to read GPIO: ${e.message}`);
            }
        } else {
            return this._readSysfs(input.chip, input.line);
        }
    }

    /**
     * Setzt einen digitalen Ausgang
     */
    writeOutput(outputName, value) {
        const output = this.mapping.outputs[outputName];
        if (!output) {
            throw new Error(`Unknown output: ${outputName}`);
        }

        const val = value ? 1 : 0;

        if (this.useGpiotools) {
            try {
                execSync(`gpioset ${output.chip} ${output.line}=${val}`, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                return true;
            } catch (e) {
                throw new Error(`Failed to write GPIO: ${e.message}`);
            }
        } else {
            return this._writeSysfs(output.chip, output.line, val);
        }
    }

    /**
     * Liest alle Eingänge
     */
    readAllInputs() {
        const results = {};
        for (const name of Object.keys(this.mapping.inputs)) {
            try {
                results[name] = this.readInput(name);
            } catch (e) {
                results[name] = { error: e.message };
            }
        }
        return results;
    }

    /**
     * Setzt die User LED
     */
    setLED(color) {
        const led = this.mapping.led;
        if (!led) {
            throw new Error('LED not supported on this device');
        }

        let greenVal = 0;
        let yellowVal = 0;

        switch (color.toLowerCase()) {
            case 'off':
                greenVal = 0;
                yellowVal = 0;
                break;
            case 'green':
                greenVal = 1;
                yellowVal = 0;
                break;
            case 'yellow':
                greenVal = 0;
                yellowVal = 1;
                break;
            case 'orange':
                greenVal = 1;
                yellowVal = 1;
                break;
            default:
                throw new Error(`Unknown LED color: ${color}`);
        }

        if (this.useGpiotools) {
            try {
                execSync(`gpioset ${led.green.chip} ${led.green.line}=${greenVal}`, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                execSync(`gpioset ${led.yellow.chip} ${led.yellow.line}=${yellowVal}`, {
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                return true;
            } catch (e) {
                throw new Error(`Failed to set LED: ${e.message}`);
            }
        }
        return false;
    }

    /**
     * Sysfs GPIO Lesen (Fallback)
     */
    _readSysfs(chip, line) {
        const gpioNum = this._chipLineToGpio(chip, line);
        const valuePath = `/sys/class/gpio/gpio${gpioNum}/value`;
        
        // Export wenn nötig
        if (!fs.existsSync(valuePath)) {
            fs.writeFileSync('/sys/class/gpio/export', String(gpioNum));
            fs.writeFileSync(`/sys/class/gpio/gpio${gpioNum}/direction`, 'in');
        }
        
        return parseInt(fs.readFileSync(valuePath, 'utf8').trim(), 10);
    }

    /**
     * Sysfs GPIO Schreiben (Fallback)
     */
    _writeSysfs(chip, line, value) {
        const gpioNum = this._chipLineToGpio(chip, line);
        const valuePath = `/sys/class/gpio/gpio${gpioNum}/value`;
        
        // Export wenn nötig
        if (!fs.existsSync(valuePath)) {
            fs.writeFileSync('/sys/class/gpio/export', String(gpioNum));
            fs.writeFileSync(`/sys/class/gpio/gpio${gpioNum}/direction`, 'out');
        }
        
        fs.writeFileSync(valuePath, String(value));
        return true;
    }

    /**
     * Konvertiert Chip/Line zu GPIO Nummer
     */
    _chipLineToGpio(chip, line) {
        // Vereinfachte Berechnung - kann je nach Plattform variieren
        return chip * 32 + line;
    }

    /**
     * Gibt verfügbare Pins zurück
     */
    getAvailablePins() {
        return {
            inputs: Object.keys(this.mapping.inputs),
            outputs: Object.keys(this.mapping.outputs),
            led: this.mapping.led ? ['off', 'green', 'yellow', 'orange'] : []
        };
    }
}

module.exports = GPIOHelper;
