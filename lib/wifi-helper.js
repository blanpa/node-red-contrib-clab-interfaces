/**
 * CompuLab WiFi Helper
 * WiFi Funktionen für CompuLab IoT Gateways
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs');

// Extended PATH for system commands
const SYSTEM_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
const execOptions = { 
    encoding: 'utf8',
    env: { ...process.env, PATH: SYSTEM_PATH }
};

class WiFiHelper {
    constructor(options = {}) {
        this.interface = options.interface || 'wlan0';
        this.hasNmcli = null;  // Cache nmcli availability
        this.hasIw = null;  // Cache iw availability
    }

    /**
     * Check if nmcli is available
     */
    async checkNmcli() {
        if (this.hasNmcli !== null) return this.hasNmcli;
        
        try {
            await execAsync('which nmcli', execOptions);
            this.hasNmcli = true;
        } catch (e) {
            this.hasNmcli = false;
        }
        return this.hasNmcli;
    }

    /**
     * Check if iw is available
     */
    async checkIw() {
        if (this.hasIw !== null) return this.hasIw;
        
        try {
            await execAsync('which iw', execOptions);
            this.hasIw = true;
        } catch (e) {
            this.hasIw = false;
        }
        return this.hasIw;
    }

    /**
     * Check if WiFi is available
     */
    async isAvailable() {
        try {
            // Method 1: Check /sys/class/net
            if (fs.existsSync(`/sys/class/net/${this.interface}`)) {
                return true;
            }
            
            // Method 2: Try nmcli
            if (await this.checkNmcli()) {
                const { stdout } = await execAsync(`nmcli device status | grep ${this.interface}`, execOptions);
                return stdout.trim().length > 0;
            }
            
            // Method 3: Try iw
            if (await this.checkIw()) {
                const { stdout } = await execAsync(`iw dev | grep ${this.interface}`, execOptions);
                return stdout.trim().length > 0;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Get WiFi status
     */
    async getStatus() {
        const status = {
            interface: this.interface,
            type: 'wifi',
            state: 'unknown',
            connection: null,
            connected: false
        };

        try {
            if (await this.checkNmcli()) {
                // Use nmcli
                const { stdout } = await execAsync(
                    `nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status | grep ${this.interface}`,
                    execOptions
                );
                const parts = stdout.trim().split(':');
                
                status.interface = parts[0] || this.interface;
                status.type = parts[1] || 'wifi';
                status.state = parts[2] || 'unknown';
                status.connection = parts[3] || null;
                status.connected = parts[2] === 'connected';

                // Wenn verbunden, hole mehr Details
                if (status.connected && status.connection) {
                    const details = await this.getConnectionDetails(status.connection);
                    Object.assign(status, details);
                }
            } else {
                // Fallback: Use iw and ip commands
                try {
                    // Check if interface is up
                    const { stdout: ipOutput } = await execAsync(`ip link show ${this.interface}`, execOptions);
                    status.state = ipOutput.includes('state UP') ? 'connected' : 'disconnected';
                    status.connected = status.state === 'connected';
                    
                    // Get IP address
                    const { stdout: addrOutput } = await execAsync(`ip addr show ${this.interface}`, execOptions);
                    const ipMatch = addrOutput.match(/inet\s+([\d.]+)\/(\d+)/);
                    if (ipMatch) {
                        status.ipAddress = ipMatch[1];
                        status.cidr = parseInt(ipMatch[2]);
                    }
                    
                    // Get SSID if connected
                    if (await this.checkIw()) {
                        const { stdout: iwOutput } = await execAsync(`iw dev ${this.interface} link`, execOptions);
                        const ssidMatch = iwOutput.match(/SSID:\s*(.+)/);
                        if (ssidMatch) {
                            status.connection = ssidMatch[1].trim();
                            status.ssid = ssidMatch[1].trim();
                        }
                        
                        // Get signal strength
                        const signalMatch = iwOutput.match(/signal:\s*(-?\d+)\s*dBm/);
                        if (signalMatch) {
                            status.signalDbm = parseInt(signalMatch[1]);
                            status.signalPercent = Math.min(100, Math.max(0, 2 * (status.signalDbm + 100)));
                        }
                    }
                } catch (e) {
                    status.state = 'unavailable';
                }
            }

            return status;
        } catch (e) {
            throw new Error(`WiFi status failed: ${e.message}`);
        }
    }

    /**
     * Get connection details
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
     * Enable WiFi
     */
    async enable() {
        try {
            if (await this.checkNmcli()) {
                await execAsync('nmcli radio wifi on', execOptions);
            } else {
                // Fallback: Use ip command
                await execAsync(`ip link set ${this.interface} up`, execOptions);
            }
            return { success: true, message: 'WiFi enabled' };
        } catch (e) {
            throw new Error(`WiFi enable failed: ${e.message}`);
        }
    }

    /**
     * Disable WiFi
     */
    async disable() {
        try {
            if (await this.checkNmcli()) {
                await execAsync('nmcli radio wifi off', execOptions);
            } else {
                // Fallback: Use ip command
                await execAsync(`ip link set ${this.interface} down`, execOptions);
            }
            return { success: true, message: 'WiFi disabled' };
        } catch (e) {
            throw new Error(`WiFi disable failed: ${e.message}`);
        }
    }

    /**
     * Scan for WiFi networks
     */
    async scan() {
        try {
            const networks = [];
            
            if (await this.checkNmcli()) {
                // Use nmcli
                // Rescan erzwingen
                await execAsync(`nmcli device wifi rescan ifname ${this.interface} 2>/dev/null`, execOptions).catch(() => {});
                
                // Kurz warten
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const { stdout } = await execAsync('nmcli -t -f SSID,BSSID,MODE,CHAN,FREQ,RATE,SIGNAL,SECURITY device wifi list', execOptions);
                
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
            } else if (await this.checkIw()) {
                // Fallback: Use iw
                // Trigger scan
                await execAsync(`iw dev ${this.interface} scan`, execOptions);
                
                // Parse scan results
                const { stdout } = await execAsync(`iw dev ${this.interface} scan`, execOptions);
                const bssBlocks = stdout.split('BSS ').slice(1);
                
                for (const block of bssBlocks) {
                    const network = {};
                    
                    // BSSID (MAC address)
                    const bssidMatch = block.match(/^([0-9a-f:]+)/i);
                    if (bssidMatch) network.bssid = bssidMatch[1];
                    
                    // SSID
                    const ssidMatch = block.match(/SSID:\s*(.+)/);
                    if (ssidMatch) network.ssid = ssidMatch[1].trim();
                    
                    // Signal
                    const signalMatch = block.match(/signal:\s*(-?\d+\.\d+)\s*dBm/);
                    if (signalMatch) {
                        const dbm = parseFloat(signalMatch[1]);
                        network.signalDbm = dbm;
                        network.signal = Math.min(100, Math.max(0, 2 * (dbm + 100)));
                    }
                    
                    // Channel/Frequency
                    const freqMatch = block.match(/freq:\s*(\d+)/);
                    if (freqMatch) {
                        network.frequency = parseInt(freqMatch[1]);
                        // Approximate channel from frequency
                        if (network.frequency >= 2412 && network.frequency <= 2484) {
                            network.channel = Math.floor((network.frequency - 2407) / 5);
                        } else if (network.frequency >= 5170 && network.frequency <= 5825) {
                            network.channel = Math.floor((network.frequency - 5000) / 5);
                        }
                    }
                    
                    // Security
                    network.security = block.includes('WPA') || block.includes('RSN') ? 'WPA/WPA2' : 'Open';
                    
                    if (network.ssid) {
                        networks.push(network);
                    }
                }
            } else {
                throw new Error(
                    'No WiFi scan tools available (nmcli or iw). ' +
                    'Install: docker exec -u root <container> apk add wireless-tools iw. ' +
                    'Details: see DOCKER-WIFI.md'
                );
            }

            // Sort by signal strength
            networks.sort((a, b) => b.signal - a.signal);

            return {
                success: true,
                networks: networks,
                count: networks.length
            };
        } catch (e) {
            throw new Error(`WiFi scan failed: ${e.message}`);
        }
    }

    /**
     * Check if wpa_supplicant is available
     */
    async checkWpaSupplicant() {
        try {
            await execAsync('which wpa_supplicant', execOptions);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Connect to a WiFi network
     */
    async connect(ssid, password = null) {
        try {
            if (await this.checkNmcli()) {
                // Use nmcli
                let cmd;
                if (password) {
                    cmd = `nmcli device wifi connect "${ssid}" password "${password}" ifname ${this.interface}`;
                } else {
                    cmd = `nmcli device wifi connect "${ssid}" ifname ${this.interface}`;
                }

                const { stdout } = await execAsync(cmd, { ...execOptions, timeout: 30000 });
                
                const success = stdout.includes('successfully activated');
                
                return {
                    success: success,
                    ssid: ssid,
                    message: success ? 'Connected' : 'Connection failed'
                };
            } else if (await this.checkWpaSupplicant()) {
                // Fallback: Use wpa_supplicant
                return await this.connectWithWpaSupplicant(ssid, password);
            } else {
                // No WiFi tools available
                throw new Error(
                    'No WiFi tools available (nmcli or wpa_supplicant). ' +
                    'Solution 1: Use "network_mode: host" in docker-compose.yml. ' +
                    'Solution 2: Install WiFi tools: docker exec -u root <container> apk add wireless-tools wpa_supplicant iw dhclient. ' +
                    'Details: see DOCKER-WIFI.md'
                );
            }
        } catch (e) {
            throw new Error(`WiFi connection failed: ${e.message}`);
        }
    }

    /**
     * Connect using wpa_supplicant (fallback method)
     */
    async connectWithWpaSupplicant(ssid, password = null) {
        try {
            const confPath = `/tmp/wpa_supplicant_${this.interface}.conf`;
            
            // Create wpa_supplicant config
            let config = `ctrl_interface=/var/run/wpa_supplicant\nupdate_config=1\n\n`;
            config += `network={\n`;
            config += `    ssid="${ssid}"\n`;
            
            if (password) {
                // Try to generate PSK with wpa_passphrase if available
                try {
                    const { stdout: psk } = await execAsync(`wpa_passphrase "${ssid}" "${password}" | grep -v "#psk" | grep "psk="`, execOptions);
                    config += `    ${psk.trim()}\n`;
                } catch (e) {
                    // Fallback: Use plaintext password (less secure but works)
                    // Escape quotes in password
                    const escapedPassword = password.replace(/"/g, '\\"');
                    config += `    psk="${escapedPassword}"\n`;
                }
            } else {
                config += `    key_mgmt=NONE\n`;
            }
            
            config += `}\n`;
            
            // Write config
            fs.writeFileSync(confPath, config);
            
            // Kill existing wpa_supplicant for this interface
            await execAsync(`killall wpa_supplicant 2>/dev/null || true`, execOptions);
            
            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Start wpa_supplicant
            await execAsync(`wpa_supplicant -B -i ${this.interface} -c ${confPath}`, execOptions);
            
            // Wait for connection
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Get IP via DHCP
            try {
                await execAsync(`dhclient ${this.interface} 2>/dev/null || udhcpc -i ${this.interface} 2>/dev/null || true`, execOptions);
            } catch (e) {
                // DHCP might fail, but connection could still work
            }
            
            // Check if connected
            let connected = false;
            try {
                if (await this.checkIw()) {
                    const { stdout: linkStatus } = await execAsync(`iw dev ${this.interface} link`, execOptions);
                    connected = linkStatus.includes('Connected to') || linkStatus.includes(ssid);
                } else {
                    // Fallback: Check if interface has IP
                    const { stdout: ipStatus } = await execAsync(`ip addr show ${this.interface}`, execOptions);
                    connected = ipStatus.includes('inet ') && !ipStatus.includes('inet 169.254');
                }
            } catch (e) {
                // Assume not connected if check fails
                connected = false;
            }
            
            return {
                success: connected,
                ssid: ssid,
                message: connected ? 'Connected (wpa_supplicant)' : 'Connection failed (check SSID/password)',
                method: 'wpa_supplicant',
                note: 'Password stored in plaintext in /tmp'
            };
        } catch (e) {
            throw new Error(`wpa_supplicant connection failed: ${e.message}`);
        }
    }

    /**
     * Disconnect WiFi connection
     */
    async disconnect() {
        try {
            if (await this.checkNmcli()) {
                await execAsync(`nmcli device disconnect ${this.interface}`, execOptions);
            } else {
                // Fallback: Kill wpa_supplicant and bring interface down
                await execAsync(`killall wpa_supplicant 2>/dev/null || true`, execOptions);
                await execAsync(`ip link set ${this.interface} down`, execOptions);
                await execAsync(`ip link set ${this.interface} up`, execOptions);
            }
            return { success: true, message: 'WiFi disconnected' };
        } catch (e) {
            throw new Error(`WiFi disconnect failed: ${e.message}`);
        }
    }

    /**
     * Create an Access Point (Hotspot)
     */
    async createAccessPoint(ssid, password, band = 'bg') {
        try {
            if (await this.checkNmcli()) {
                // Use nmcli
                // Delete existing hotspot if present
                await execAsync(`nmcli connection delete "${ssid}" 2>/dev/null`, execOptions).catch(() => {});

                // Create new hotspot
                let cmd = `nmcli device wifi hotspot ifname ${this.interface} ssid "${ssid}"`;
                if (password) {
                    cmd += ` password "${password}"`;
                }
                if (band === 'a') {
                    cmd += ' band a';
                }

                await execAsync(cmd, { ...execOptions, timeout: 30000 });

                return {
                    success: true,
                    ssid: ssid,
                    message: 'Access Point created'
                };
            } else {
                // Fallback: Use hostapd
                return await this.createAccessPointWithHostapd(ssid, password, band);
            }
        } catch (e) {
            throw new Error(`Access Point creation failed: ${e.message}`);
        }
    }

    /**
     * Create Access Point using hostapd (fallback method)
     */
    async createAccessPointWithHostapd(ssid, password, band = 'bg') {
        try {
            const confPath = `/tmp/hostapd_${this.interface}.conf`;
            
            // Determine channel and hw_mode
            const hwMode = band === 'a' ? 'a' : 'g';
            const channel = band === 'a' ? '36' : '6';
            
            // Create hostapd config
            let config = `interface=${this.interface}\n`;
            config += `driver=nl80211\n`;
            config += `ssid=${ssid}\n`;
            config += `hw_mode=${hwMode}\n`;
            config += `channel=${channel}\n`;
            config += `wmm_enabled=1\n`;
            config += `auth_algs=1\n`;
            
            if (password && password.length >= 8) {
                config += `wpa=2\n`;
                config += `wpa_key_mgmt=WPA-PSK\n`;
                config += `wpa_passphrase=${password}\n`;
                config += `rsn_pairwise=CCMP\n`;
            }
            
            // Write config
            fs.writeFileSync(confPath, config);
            
            // Kill existing hostapd
            await execAsync(`killall hostapd 2>/dev/null || true`, execOptions);
            
            // Configure interface
            await execAsync(`ip link set ${this.interface} up`, execOptions);
            await execAsync(`ip addr flush dev ${this.interface}`, execOptions);
            await execAsync(`ip addr add 192.168.50.1/24 dev ${this.interface}`, execOptions);
            
            // Start hostapd in background
            await execAsync(`hostapd -B ${confPath}`, execOptions);
            
            // Start DHCP server (dnsmasq)
            await execAsync(`killall dnsmasq 2>/dev/null || true`, execOptions);
            await execAsync(`dnsmasq --interface=${this.interface} --dhcp-range=192.168.50.10,192.168.50.100,12h --no-daemon &`, execOptions);
            
            return {
                success: true,
                ssid: ssid,
                message: 'Access Point created (hostapd)',
                method: 'hostapd',
                ip: '192.168.50.1'
            };
        } catch (e) {
            throw new Error(`hostapd Access Point failed: ${e.message}. Note: hostapd and dnsmasq must be installed.`);
        }
    }

    /**
     * Stop the Access Point
     */
    async stopAccessPoint() {
        try {
            if (await this.checkNmcli()) {
                await execAsync(`nmcli device disconnect ${this.interface}`, execOptions);
            } else {
                // Fallback: Kill hostapd and dnsmasq
                await execAsync(`killall hostapd 2>/dev/null || true`, execOptions);
                await execAsync(`killall dnsmasq 2>/dev/null || true`, execOptions);
                await execAsync(`ip addr flush dev ${this.interface}`, execOptions);
            }
            return { success: true, message: 'Access Point stopped' };
        } catch (e) {
            throw new Error(`Access Point stop failed: ${e.message}`);
        }
    }

    /**
     * Get saved connections
     */
    async getSavedConnections() {
        try {
            if (await this.checkNmcli()) {
                const { stdout } = await execAsync('nmcli -t -f NAME,TYPE,DEVICE connection show | grep wifi', execOptions);
                
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
            } else {
                // Fallback: Parse wpa_supplicant config
                const confPath = `/tmp/wpa_supplicant_${this.interface}.conf`;
                if (fs.existsSync(confPath)) {
                    const config = fs.readFileSync(confPath, 'utf8');
                    const ssidMatches = config.match(/ssid="([^"]+)"/g);
                    const connections = [];
                    
                    if (ssidMatches) {
                        for (const match of ssidMatches) {
                            const ssid = match.match(/ssid="([^"]+)"/)[1];
                            connections.push({
                                name: ssid,
                                type: 'wifi',
                                device: null,
                                active: false
                            });
                        }
                    }
                    
                    return {
                        success: true,
                        connections: connections,
                        count: connections.length,
                        method: 'wpa_supplicant'
                    };
                }
                
                return { success: true, connections: [], count: 0 };
            }
        } catch (e) {
            return { success: true, connections: [], count: 0 };
        }
    }

    /**
     * Delete a saved connection
     */
    async deleteConnection(name) {
        try {
            if (await this.checkNmcli()) {
                await execAsync(`nmcli connection delete "${name}"`, execOptions);
                return { success: true, message: `Connection "${name}" deleted` };
            } else {
                // Fallback: Remove from wpa_supplicant config
                const confPath = `/tmp/wpa_supplicant_${this.interface}.conf`;
                if (fs.existsSync(confPath)) {
                    let config = fs.readFileSync(confPath, 'utf8');
                    
                    // Remove network block with matching SSID
                    const networkRegex = new RegExp(`network=\\{[^}]*ssid="${name}"[^}]*\\}`, 'g');
                    config = config.replace(networkRegex, '');
                    
                    fs.writeFileSync(confPath, config);
                    
                    return { success: true, message: `Connection "${name}" deleted (wpa_supplicant)` };
                }
                
                throw new Error(`No saved connection "${name}" found`);
            }
        } catch (e) {
            throw new Error(`Connection delete failed: ${e.message}`);
        }
    }
}

module.exports = WiFiHelper;
