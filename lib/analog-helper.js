/**
 * Analog Input Helper für CompuLab IoT Gateways
 * Unterstützt:
 * - 4-20mA Current Loop (IOT-GATE-iMX8, IOT-DIN)
 * - 0-10V Voltage Input (IOT-DIN Analog Module)
 * - Temperatur Sensoren (PT100, PT1000, Thermocouples)
 */

const { execSync } = require('child_process');
const fs = require('fs');

class AnalogHelper {
    constructor(options = {}) {
        this.device = options.device || 'IOT-GATE-iMX8';
        this.iioDevices = [];
        
        // ADC Konfiguration je nach Gerät/Modul
        this.adcConfig = {
            // Standard 4-20mA (max11108)
            'max11108': {
                resolution: 12,      // 12-bit ADC
                vref: 2.5,           // Referenzspannung
                currentFactor: 0.00684,  // Raw → mA
                type: 'current'
            },
            // 0-10V Spannungseingang
            'voltage_0_10': {
                resolution: 12,
                vref: 10.0,
                voltageFactor: 0.00244,  // Raw → V (10V / 4096)
                type: 'voltage'
            },
            // 0-5V Spannungseingang
            'voltage_0_5': {
                resolution: 12,
                vref: 5.0,
                voltageFactor: 0.00122,  // Raw → V (5V / 4096)
                type: 'voltage'
            },
            // PT100 Temperatur
            'pt100': {
                type: 'temperature',
                sensorType: 'PT100'
            },
            // PT1000 Temperatur
            'pt1000': {
                type: 'temperature',
                sensorType: 'PT1000'
            }
        };

        this._loadModule();
        this._scanDevices();
    }

    /**
     * Lädt das Kernel Modul für den ADC
     */
    _loadModule() {
        try {
            execSync('modprobe max11108 2>/dev/null', { stdio: 'pipe' });
        } catch (e) {
            // Modul evtl. nicht verfügbar oder bereits geladen
        }
        
        // Für IOT-DIN: industrialio Module
        try {
            execSync('modprobe industrialio 2>/dev/null', { stdio: 'pipe' });
        } catch (e) {}
    }

    /**
     * Scannt nach IIO Devices
     */
    _scanDevices() {
        this.iioDevices = [];
        const iioPath = '/sys/bus/iio/devices';
        
        try {
            if (fs.existsSync(iioPath)) {
                const devices = fs.readdirSync(iioPath);
                for (const dev of devices) {
                    if (dev.startsWith('iio:device')) {
                        const devPath = `${iioPath}/${dev}`;
                        const info = this._getDeviceInfo(devPath);
                        if (info) {
                            this.iioDevices.push({
                                id: dev,
                                path: devPath,
                                ...info
                            });
                        }
                    }
                }
            }
        } catch (e) {
            // Ignorieren
        }
    }

    /**
     * Liest Device Info inkl. Scale und Offset
     */
    _getDeviceInfo(devPath) {
        const info = { channels: [] };
        
        try {
            // Name lesen
            const namePath = `${devPath}/name`;
            if (fs.existsSync(namePath)) {
                info.name = fs.readFileSync(namePath, 'utf8').trim();
            }

            // Kanäle finden
            const files = fs.readdirSync(devPath);
            for (const f of files) {
                if (f.match(/^in_voltage\d+_raw$/) || f.match(/^in_current\d*_raw$/)) {
                    const channelName = f.replace('_raw', '');
                    const channel = {
                        name: channelName,
                        rawFile: f
                    };
                    
                    // Scale lesen (falls vorhanden)
                    const scaleFile = `${channelName}_scale`;
                    if (files.includes(scaleFile)) {
                        channel.scale = parseFloat(
                            fs.readFileSync(`${devPath}/${scaleFile}`, 'utf8').trim()
                        );
                    }
                    
                    // Offset lesen (falls vorhanden)
                    const offsetFile = `${channelName}_offset`;
                    if (files.includes(offsetFile)) {
                        channel.offset = parseFloat(
                            fs.readFileSync(`${devPath}/${offsetFile}`, 'utf8').trim()
                        );
                    }
                    
                    info.channels.push(channel);
                }
            }
        } catch (e) {
            return null;
        }

        return info.channels.length > 0 ? info : null;
    }

    /**
     * Liest einen analogen Eingangswert (Rohwert)
     */
    readRaw(deviceIndex = 0, channelIndex = 0) {
        const device = this.iioDevices[deviceIndex];
        if (!device) {
            throw new Error(`Device ${deviceIndex} not found. Available: ${this.iioDevices.length}`);
        }

        const channel = device.channels[channelIndex];
        if (!channel) {
            throw new Error(`Channel ${channelIndex} not found on device ${deviceIndex}`);
        }

        const valuePath = `${device.path}/${channel.rawFile}`;
        
        try {
            const raw = parseInt(fs.readFileSync(valuePath, 'utf8').trim(), 10);
            return {
                raw: raw,
                device: device.name || device.id,
                channel: channel.name,
                scale: channel.scale,
                offset: channel.offset
            };
        } catch (e) {
            throw new Error(`Failed to read ${channel.name}: ${e.message}`);
        }
    }

    /**
     * Liest 4-20mA Stromwert
     * @param {number} deviceIndex - Device Index
     * @param {number} channelIndex - Channel Index
     * @returns {object} - {raw, currentMA, percent, valid}
     */
    readCurrent(deviceIndex = 0, channelIndex = 0) {
        const reading = this.readRaw(deviceIndex, channelIndex);
        
        // Verwende Scale falls vorhanden, sonst Standard-Faktor
        let currentMA;
        if (reading.scale) {
            // IIO Standard: (raw + offset) * scale
            const offset = reading.offset || 0;
            currentMA = (reading.raw + offset) * reading.scale;
        } else {
            // Fallback: max11108 Formel
            currentMA = reading.raw * 0.00684;
        }
        
        return {
            raw: reading.raw,
            currentMA: Math.round(currentMA * 1000) / 1000,
            percent: this._currentToPercent(currentMA),
            valid: currentMA >= 3.8 && currentMA <= 20.5,  // 4mA - 20mA mit Toleranz
            device: reading.device,
            channel: reading.channel,
            unit: 'mA'
        };
    }

    /**
     * Liest 0-10V Spannungswert
     * @param {number} deviceIndex - Device Index
     * @param {number} channelIndex - Channel Index
     * @param {number} maxVoltage - Maximale Spannung (default: 10V)
     * @returns {object} - {raw, voltage, percent, valid}
     */
    readVoltage(deviceIndex = 0, channelIndex = 0, maxVoltage = 10.0) {
        const reading = this.readRaw(deviceIndex, channelIndex);
        
        let voltage;
        if (reading.scale) {
            // IIO Standard: (raw + offset) * scale / 1000 (scale ist oft in mV)
            const offset = reading.offset || 0;
            voltage = (reading.raw + offset) * reading.scale / 1000;
        } else {
            // Fallback: 12-bit ADC mit maxVoltage Referenz
            voltage = (reading.raw / 4095) * maxVoltage;
        }
        
        const percent = (voltage / maxVoltage) * 100;
        
        return {
            raw: reading.raw,
            voltage: Math.round(voltage * 1000) / 1000,
            percent: Math.round(percent * 10) / 10,
            valid: voltage >= -0.1 && voltage <= maxVoltage + 0.5,
            device: reading.device,
            channel: reading.channel,
            unit: 'V',
            maxVoltage: maxVoltage
        };
    }

    /**
     * Liest und skaliert auf benutzerdefinierten Bereich
     * Nützlich für Sensoren mit 4-20mA oder 0-10V Ausgang
     * 
     * @param {object} options
     * @param {number} options.deviceIndex - Device Index
     * @param {number} options.channelIndex - Channel Index
     * @param {string} options.inputType - 'current' (4-20mA) oder 'voltage' (0-10V)
     * @param {number} options.minValue - Skalierter Minimalwert (bei 4mA/0V)
     * @param {number} options.maxValue - Skalierter Maximalwert (bei 20mA/10V)
     * @param {string} options.unit - Einheit des skalierten Werts
     * @param {number} options.decimals - Dezimalstellen
     */
    readScaled(options = {}) {
        const {
            deviceIndex = 0,
            channelIndex = 0,
            inputType = 'current',
            minValue = 0,
            maxValue = 100,
            unit = '',
            decimals = 2,
            maxVoltage = 10.0
        } = options;

        let reading;
        let percent;

        if (inputType === 'voltage') {
            reading = this.readVoltage(deviceIndex, channelIndex, maxVoltage);
            percent = reading.percent;
        } else {
            reading = this.readCurrent(deviceIndex, channelIndex);
            percent = reading.percent;
        }

        // Skalierung: percent (0-100) → minValue-maxValue
        const scaled = minValue + (percent / 100) * (maxValue - minValue);
        const factor = Math.pow(10, decimals);
        
        return {
            ...reading,
            scaled: Math.round(scaled * factor) / factor,
            scaledUnit: unit,
            minValue,
            maxValue,
            inputType
        };
    }

    /**
     * Liest Temperatur von PT100/PT1000 Sensor
     * @param {number} deviceIndex - Device Index
     * @param {number} channelIndex - Channel Index
     * @param {string} sensorType - 'PT100' oder 'PT1000'
     */
    readTemperature(deviceIndex = 0, channelIndex = 0, sensorType = 'PT100') {
        const reading = this.readRaw(deviceIndex, channelIndex);
        
        // PT100/PT1000: Widerstand → Temperatur (vereinfachte Callendar-Van Dusen)
        // Normalerweise liefert der IIO-Treiber bereits die Temperatur
        let tempC;
        
        if (reading.scale) {
            // IIO gibt Temperatur in milli-Grad Celsius
            tempC = (reading.raw + (reading.offset || 0)) * reading.scale / 1000;
        } else {
            // Fallback: Annahme dass raw = Widerstand in mOhm
            const resistance = reading.raw / 1000; // mOhm → Ohm
            const R0 = sensorType === 'PT1000' ? 1000 : 100;
            const alpha = 0.00385; // Temperaturkoeffizient
            tempC = (resistance / R0 - 1) / alpha;
        }
        
        return {
            raw: reading.raw,
            celsius: Math.round(tempC * 10) / 10,
            fahrenheit: Math.round((tempC * 9/5 + 32) * 10) / 10,
            kelvin: Math.round((tempC + 273.15) * 10) / 10,
            device: reading.device,
            channel: reading.channel,
            sensorType: sensorType,
            unit: '°C'
        };
    }

    /**
     * Konvertiert mA zu Prozent (4-20mA = 0-100%)
     */
    _currentToPercent(currentMA) {
        if (currentMA < 4) return 0;
        if (currentMA > 20) return 100;
        return Math.round(((currentMA - 4) / 16) * 100 * 10) / 10;
    }

    /**
     * Gibt verfügbare Devices zurück
     */
    getDevices() {
        this._scanDevices();
        return this.iioDevices.map(dev => ({
            id: dev.id,
            name: dev.name,
            path: dev.path,
            channels: dev.channels.map(ch => ({
                name: ch.name,
                hasScale: !!ch.scale,
                scale: ch.scale,
                offset: ch.offset
            }))
        }));
    }

    /**
     * Prüft ob Analog-Eingänge verfügbar sind
     */
    isAvailable() {
        this._scanDevices();
        return this.iioDevices.length > 0;
    }
}

module.exports = AnalogHelper;
