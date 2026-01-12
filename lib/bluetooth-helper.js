/**
 * CompuLab Bluetooth Helper
 * Bluetooth Funktionen für CompuLab IoT Gateways
 */

const { exec, spawn } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');

// Extended PATH for system commands
const SYSTEM_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const execOptions = { 
    encoding: 'utf8',
    env: { ...process.env, PATH: SYSTEM_PATH }
};

class BluetoothHelper {
    constructor() {
        this.scanProcess = null;
        this.hasHciconfig = null;  // Cache hciconfig availability
        this.hasBluetoothctl = null;  // Cache bluetoothctl availability
    }

    /**
     * Check if hciconfig is available
     */
    async checkHciconfig() {
        if (this.hasHciconfig !== null) return this.hasHciconfig;
        
        try {
            await execAsync('which hciconfig', execOptions);
            this.hasHciconfig = true;
        } catch (e) {
            this.hasHciconfig = false;
        }
        return this.hasHciconfig;
    }

    /**
     * Check if bluetoothctl is available
     */
    async checkBluetoothctl() {
        if (this.hasBluetoothctl !== null) return this.hasBluetoothctl;
        
        try {
            await execAsync('which bluetoothctl', execOptions);
            this.hasBluetoothctl = true;
        } catch (e) {
            this.hasBluetoothctl = false;
        }
        return this.hasBluetoothctl;
    }

    /**
     * Prüft ob Bluetooth verfügbar ist
     */
    async isAvailable() {
        try {
            // Method 1: Check /sys/class/bluetooth
            if (fs.existsSync('/sys/class/bluetooth')) {
                const devices = fs.readdirSync('/sys/class/bluetooth');
                if (devices.length > 0) return true;
            }
            
            // Method 2: Try hciconfig
            if (await this.checkHciconfig()) {
                const { stdout } = await execAsync('hciconfig -a 2>/dev/null | head -1', execOptions);
                return stdout.trim().length > 0;
            }
            
            // Method 3: Try bluetoothctl
            if (await this.checkBluetoothctl()) {
                const { stdout } = await execAsync('bluetoothctl list 2>/dev/null', execOptions);
                return stdout.trim().length > 0;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gibt Bluetooth Adapter Info zurück
     */
    async getAdapterInfo() {
        const info = {
            adapter: null,
            address: null,
            status: 'unknown',
            name: null,
            powered: false
        };

        try {
            // Try hciconfig first
            if (await this.checkHciconfig()) {
                const { stdout } = await execAsync('hciconfig -a', execOptions);
                const lines = stdout.split('\n');

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
                        info.powered = true;
                    } else if (line.includes('DOWN')) {
                        info.status = 'down';
                    }
                    if (line.includes('Name:')) {
                        const match = line.match(/Name:\s*'([^']+)'/);
                        if (match) info.name = match[1];
                    }
                }
            } else if (await this.checkBluetoothctl()) {
                // Fallback: Use bluetoothctl
                const { stdout } = await execAsync('bluetoothctl show', execOptions);
                const lines = stdout.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    
                    if (trimmed.startsWith('Controller')) {
                        const match = trimmed.match(/Controller\s+([0-9A-F:]+)/i);
                        if (match) {
                            info.address = match[1];
                            info.adapter = 'hci0';  // Default
                        }
                    }
                    if (trimmed.startsWith('Name:')) {
                        info.name = trimmed.split('Name:')[1].trim();
                    }
                    if (trimmed.startsWith('Powered:')) {
                        info.powered = trimmed.includes('yes');
                        info.status = info.powered ? 'up' : 'down';
                    }
                }
            } else {
                // Last resort: Check /sys/class/bluetooth
                if (fs.existsSync('/sys/class/bluetooth')) {
                    const devices = fs.readdirSync('/sys/class/bluetooth');
                    if (devices.length > 0) {
                        info.adapter = devices[0];
                        
                        try {
                            const addressPath = `/sys/class/bluetooth/${devices[0]}/address`;
                            if (fs.existsSync(addressPath)) {
                                info.address = fs.readFileSync(addressPath, 'utf8').trim();
                            }
                        } catch (e) { /* ignore */ }
                        
                        info.status = 'available';
                    }
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
            if (await this.checkBluetoothctl()) {
                // Use bluetoothctl
                await execAsync('bluetoothctl power on', execOptions);
            } else if (await this.checkHciconfig()) {
                // Fallback to hciconfig
                try {
                    await execAsync('hciconfig hci0 up', execOptions);
                } catch (e) {
                    await execAsync('sudo hciconfig hci0 up', execOptions);
                }
            } else {
                throw new Error('No Bluetooth tools available (bluetoothctl or hciconfig)');
            }
            
            // Try to start bluetooth service
            try {
                await execAsync('systemctl start bluetooth', execOptions).catch(() => {});
            } catch (e) { /* ignore */ }
            
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
            if (await this.checkBluetoothctl()) {
                // Use bluetoothctl
                await execAsync('bluetoothctl power off', execOptions);
            } else if (await this.checkHciconfig()) {
                // Fallback to hciconfig
                try {
                    await execAsync('hciconfig hci0 down', execOptions);
                } catch (e) {
                    await execAsync('sudo hciconfig hci0 down', execOptions);
                }
            } else {
                throw new Error('No Bluetooth tools available (bluetoothctl or hciconfig)');
            }
            
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
            const devices = [];
            
            if (await this.checkBluetoothctl()) {
                // Use bluetoothctl
                const { stdout } = await execAsync(
                    `timeout ${duration} bluetoothctl scan on 2>&1 & sleep ${duration} && bluetoothctl devices`,
                    { ...execOptions, timeout: (duration + 5) * 1000 }
                );

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
            } else if (await this.checkHciconfig()) {
                // Fallback: Use hcitool (old method)
                try {
                    // Start scan
                    await execAsync(`hciconfig hci0 up`, execOptions).catch(() => {});
                    const { stdout } = await execAsync(
                        `timeout ${duration} hcitool scan`,
                        { ...execOptions, timeout: (duration + 5) * 1000 }
                    );

                    const lines = stdout.split('\n');
                    for (const line of lines) {
                        // Format: "  00:11:22:33:44:55  Device Name"
                        const match = line.match(/\s+([0-9A-F:]+)\s+(.+)/i);
                        if (match) {
                            devices.push({
                                address: match[1],
                                name: match[2].trim()
                            });
                        }
                    }
                } catch (e) {
                    // hcitool might timeout, that's ok
                    if (!e.killed) {
                        throw e;
                    }
                }
            } else {
                throw new Error('No Bluetooth scan tools available (bluetoothctl or hcitool). Install bluez package.');
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
                return await this.getDevices().catch(() => ({
                    success: true,
                    devices: [],
                    count: 0,
                    duration: duration
                }));
            }
            throw new Error(`Bluetooth Scan fehlgeschlagen: ${e.message}`);
        }
    }

    /**
     * Gibt bekannte Geräte zurück
     */
    async getDevices() {
        try {
            if (!(await this.checkBluetoothctl())) {
                throw new Error('bluetoothctl not available');
            }
            
            const { stdout } = await execAsync('bluetoothctl devices', execOptions);
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
            if (!(await this.checkBluetoothctl())) {
                throw new Error('bluetoothctl not available. Install bluez package.');
            }
            
            // Erst pairen falls nötig
            await execAsync(`bluetoothctl pair ${address}`, { ...execOptions, timeout: 30000 }).catch(() => {});
            
            // Trust setzen
            await execAsync(`bluetoothctl trust ${address}`, execOptions);
            
            // Verbinden
            const { stdout } = await execAsync(`bluetoothctl connect ${address}`, { ...execOptions, timeout: 30000 });
            
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
