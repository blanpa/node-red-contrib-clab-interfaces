# CompuLab Node-RED Example Flows

This directory contains example flows demonstrating the CompuLab IoT Gateway nodes.

## Available Examples

### compulab-demo-flow.json

A comprehensive demonstration flow showing all CompuLab nodes:

- **GPIO Examples**: Digital input/output operations
- **LED Examples**: LED control (on/off/blink)
- **Network Examples**: Ping, DNS lookup, traceroute
- **System Examples**: System info, RTC operations
- **WiFi Examples**: Status, scan, connect
- **Ethernet Examples**: Interface status and configuration
- **Analog Input**: Reading analog sensors (4-20mA, 0-10V, PT100)
- **Serial Communication**: RS485/RS232 data transmission

## How to Use

### Method 1: Import in Node-RED UI

1. Open Node-RED in your browser
2. Click the menu (☰) → Import
3. Select the example JSON file
4. Click "Import"

### Method 2: Auto-load on Startup (Docker)

Mount the example flow in your `docker-compose.yml`:

```yaml
services:
  node-red:
    image: nodered/node-red:latest
    volumes:
      - ./data:/data
      - ./examples/compulab-demo-flow.json:/data/flows.json:ro
```

**Note:** This will replace your existing flows. To preserve existing flows, use Method 1 or copy the flow to a new tab.

### Method 3: Copy to Node-RED Data Directory

```bash
# Copy example to Node-RED data directory
cp examples/compulab-demo-flow.json ~/.node-red/flows.json

# Or for Docker
docker cp examples/compulab-demo-flow.json node-red:/data/flows.json
docker restart node-red
```

## Customizing the Examples

### GPIO Pins

Adjust the `deviceType` and `pin` properties based on your hardware:

```json
{
    "type": "clab-gpio-in",
    "deviceType": "IOT-GATE-IMX8PLUS",
    "pin": "0"
}
```

Available device types:
- `IOT-GATE-IMX8PLUS`
- `IOT-GATE-iMX8`
- `IOT-DIN-IMX8PLUS`
- `IOT-LINK`
- `IOT-GATE-RPi`

### Serial Ports

Update the serial configuration to match your hardware:

```json
{
    "type": "clab-serial-config",
    "device": "/dev/ttyLP1",
    "baudrate": "9600",
    "mode": "rs485"
}
```

### WiFi Configuration

For WiFi connection examples, create a WiFi Config node:

1. Double-click the WiFi node
2. Select "Connect" action
3. Click the pencil icon next to "WiFi Network"
4. Add your SSID and password
5. Deploy

### Network Targets

Change the ping/DNS targets as needed:

```json
{
    "type": "clab-network",
    "action": "ping",
    "host": "8.8.8.8"
}
```

## Testing the Examples

### Prerequisites

- CompuLab IoT Gateway device
- Node-RED installed (or Docker container running)
- `node-red-contrib-clab-interfaces` package installed

### Quick Test

1. Import the demo flow
2. Deploy the flow
3. Click the inject nodes to trigger actions
4. View results in the Debug sidebar

### Hardware Requirements

Different examples require different hardware:

| Example | Required Hardware |
|---------|-------------------|
| GPIO | Any CompuLab device with GPIO |
| LED | Any CompuLab device |
| Network | Network connectivity |
| System | Any CompuLab device |
| WiFi | Device with WiFi adapter |
| Ethernet | Device with Ethernet port |
| Analog | IOT-DIN-IMX8PLUS with IFM-ADC8 module |
| Serial | Device with RS485/RS232 ports |

## Troubleshooting

### "Node type not found"

Install the CompuLab nodes package:

```bash
cd ~/.node-red
npm install node-red-contrib-clab-interfaces
```

Or in Docker:

```bash
docker exec -it node-red npm install node-red-contrib-clab-interfaces
docker restart node-red
```

### "Permission denied" errors

Ensure Node-RED has access to hardware:

```yaml
# docker-compose.yml
privileged: true
user: "0:0"
volumes:
  - /dev:/dev
  - /sys:/sys
```

### GPIO/LED not working

Check permissions:

```bash
# Add user to gpio group
sudo usermod -a -G gpio $USER

# Or run Node-RED as root (Docker)
user: "0:0"
```

### Serial port not found

List available serial ports:

```bash
ls -la /dev/ttyLP*
ls -la /dev/ttyUSB*
```

Update the serial config with the correct device path.

### WiFi not working in Docker

Use host network mode or install WiFi tools:

```yaml
network_mode: host
```

Or:

```bash
docker exec -u root node-red apk add wireless-tools wpa_supplicant iw dhclient
```

See [WIFI-DOCKER-QUICKSTART.md](../WIFI-DOCKER-QUICKSTART.md) for details.

## Creating Your Own Flows

Use these examples as templates for your own applications:

1. **Industrial Monitoring**: Combine Analog Input + Network nodes to send sensor data to cloud
2. **Remote Control**: Use WiFi + GPIO to control devices remotely
3. **Data Logging**: Serial Input + System nodes to log data with timestamps
4. **Network Diagnostics**: Network + LED nodes for visual network status
5. **Multi-Module Systems**: Analog + Serial nodes for complex industrial systems

## Contributing

Have a useful example flow? Contributions are welcome!

1. Create your example flow
2. Test it on actual hardware
3. Add documentation
4. Submit a pull request

## Further Reading

- [Main README](../README.md) - Package documentation
- [API Reference](../API.md) - Detailed node API
- [Docker Setup](../DOCKER-WIFI.md) - Docker configuration
- [Multi-Module Support](../README.md#multiple-add-on-modules-support) - Using multiple I/O modules
