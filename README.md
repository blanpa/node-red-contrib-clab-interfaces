# node-red-contrib-clab-interfaces

Node-RED nodes for CompuLab IoT Gateway hardware interfaces.

![Node-RED](https://img.shields.io/badge/Node--RED-8F0000?logo=nodered&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

> **Note:** This is an independent open-source project and is not affiliated with, endorsed by, or sponsored by CompuLab Ltd.

## Overview

This package provides Node-RED nodes to interact with the hardware interfaces of CompuLab IoT Gateways, including:

- **IOT-GATE-iMX8** / **SBC-IOT-iMX8**
- **IOT-GATE-IMX8PLUS** / **IOT-DIN-IMX8PLUS**
- **IOT-LINK**
- **IOT-GATE-RPi**

## Features

| Category | Node | Description |
|----------|------|-------------|
| **GPIO** | `clab-gpio-in` | Digital input (read GPIO pins) |
| | `clab-gpio-out` | Digital output (set GPIO pins) |
| **Serial** | `clab-serial-in` | Serial/RS485 receive |
| | `clab-serial-out` | Serial/RS485 transmit |
| **CAN Bus** | `clab-can-in` | CAN bus receive |
| | `clab-can-out` | CAN bus transmit |
| **Analog** | `clab-analog-in` | Analog input (4-20mA, 0-10V, PT100/PT1000) |
| **LED** | `clab-led` | User LED control (on/off/blink) |
| **System** | `clab-system` | System info, RTC, Watchdog, TPM, Power |
| **Bluetooth** | `clab-bluetooth` | BT adapter control, scan, connect |
| **GPS** | `clab-gps` | Position, satellites, distance calculation |
| **Cellular** | `clab-cellular` | LTE modem info, connect, signal strength |
| **WiFi** | `clab-wifi` | WiFi status, scan, connect, access point |
| **Ethernet** | `clab-ethernet` | Interface status, DHCP/static IP config |
| **Network** | `clab-network` | Ping, DNS, traceroute, port check, HTTP check |

## Multiple Add-on Modules Support

CompuLab IoT Gateways support **multiple stackable I/O add-on modules**, allowing massive expansion of your gateway capabilities.

### IOT-DIN-IMX8PLUS - Up to 8 Stackable Modules

The [IOT-DIN-IMX8PLUS](https://www.compulab.com/products/iot-gateways/iot-din-imx8plus-industrial-iot-gateway/#io_modules) supports stacking **up to 8 I/O expansion modules** in positions A through H:

| Module Type | Max Stack | Description | Device Index Range |
|------------|-----------|-------------|-------------------|
| **IFM-RS485** | 3 modules | 4x RS485 ports each | **Up to 12 RS485 ports** (3×4) |
| **IFM-RS232** | 3 modules | 4x RS232 ports each | **Up to 12 RS232 ports** (3×4) |
| **IFM-DI8O8** | 8 modules | 8 DI + 8 DO each | **Up to 64 DI + 64 DO** (8×8+8) |
| **IFM-ADC8** | 8 modules | 8x analog inputs each | **Up to 64 analog channels** (8×8) |
| **IFM-WB** | 1 module | WiFi 6E + BT 5.3 | Single module only |
| **IFM-MESH** | 3 modules | BT Mesh/Thread/Zigbee | Up to 3 mesh modules |
| **IFM-NVME** | 1 module | NVMe SSD storage | Position A only |

**Stacking Rules:**
- Maximum 8 modules total (positions A-H)
- RS485/RS232/MESH: maximum 3 combined
- IFM-NVME: must be in position A
- Automatic detection and configuration

### Other CompuLab Devices

| Device | Base I/O | Add-on Support |
|--------|----------|----------------|
| **IOT-GATE-iMX8/IMX8PLUS** | 4 DI + Backpanel RS485/RS232 | 2 Add-on modules |
| **IOT-LINK** | 2x RS485 (FARS4/FBRS4) | 3 DIO base |
| **IOT-GATE-RPi** | 4x RS485 ports | 8 IN/OUT |

### How to Use Multiple Modules

#### **Serial Ports** - Up to 12 RS485 or RS232 Interfaces
Each serial port requires its own **configuration node**. With 3× IFM-RS485 modules:

```javascript
// Module A (Position A) - 4 ports
Serial Config 1: /dev/ttyLP6  (or device-specific path)
Serial Config 2: /dev/ttyLP7
Serial Config 3: /dev/ttyLP8
Serial Config 4: /dev/ttyLP9

// Module B (Position B) - 4 ports
Serial Config 5: /dev/ttyLP10
Serial Config 6: /dev/ttyLP11
// ... up to 12 RS485 ports total
```

#### **Analog Inputs** - Up to 64 Channels (8 Modules × 8 Channels)
Use `msg.deviceIndex` and `msg.channelIndex` to access different modules:

```javascript
// Module A, Channel 0-7
msg.deviceIndex = 0;
msg.channelIndex = 0; // to 7

// Module B, Channel 0-7
msg.deviceIndex = 1;
msg.channelIndex = 0; // to 7

// Module C, Channel 0-7
msg.deviceIndex = 2;
msg.channelIndex = 0; // to 7

// ... up to deviceIndex 7 (Module H)
```

**Example: Scanning all 64 analog channels**
```javascript
// Flow context to track current position
var deviceIndex = context.get('deviceIndex') || 0;
var channelIndex = context.get('channelIndex') || 0;

// Set current channel
msg.deviceIndex = deviceIndex;
msg.channelIndex = channelIndex;

// Move to next channel
channelIndex++;
if (channelIndex >= 8) {
    channelIndex = 0;
    deviceIndex++;
    if (deviceIndex >= 8) {
        deviceIndex = 0; // Start over
    }
}

context.set('deviceIndex', deviceIndex);
context.set('channelIndex', channelIndex);

return msg;
```

#### **Digital I/O** - Up to 64 Inputs + 64 Outputs
With 8× IFM-DI8O8 modules, you can have massive I/O capacity:

```javascript
// Module A: DI0-DI7, DO0-DO7
msg.pin = "DI0"; // First module, first input

// Module B: DI8-DI15, DO8-DO15
msg.pin = "DI8"; // Second module, first input

// ... up to DI63, DO63
```

#### **CAN Bus** - Multiple CAN Interfaces
Create separate configuration nodes for each CAN interface:

```javascript
// CAN Config 1: can0 @ 500 kbit/s
// CAN Config 2: can1 @ 250 kbit/s
```

### Real-World Use Case: Industrial Monitoring System

Example configuration with **IOT-DIN-IMX8PLUS** + **8× IFM-ADC8** + **3× IFM-RS485**:

```javascript
// ============================================
// Monitor 64 temperature sensors (PT100)
// via 8 ADC modules + Log data via 12 RS485 
// PLCs distributed across factory floor
// ============================================

// Flow 1: Read all 64 temperature sensors
var device = flow.get('currentDevice') || 0;
var channel = flow.get('currentChannel') || 0;

msg.deviceIndex = device;    // Module A-H (0-7)
msg.channelIndex = channel;  // Channel 0-7

// Round-robin through all channels
channel++;
if (channel >= 8) {
    channel = 0;
    device = (device + 1) % 8;
}
flow.set('currentDevice', device);
flow.set('currentChannel', channel);

// Flow 2: Send aggregated data to PLCs
// Each RS485 port connected to different PLC
// Port mapping handled by 12 separate serial-out nodes
msg.topic = `sensor_${device}_${channel}`;
msg.payload = {
    temperature: msg.payload,
    location: `Module-${device}-CH${channel}`
};

return msg;
```

### Dynamic Module Selection via msg Properties

All nodes support dynamic configuration through message properties:

```javascript
// Example: Switch between different analog channels
var channels = [0, 1, 2, 3, 4, 5, 6, 7];
var currentChannel = context.get('currentChannel') || 0;

msg.deviceIndex = 0;
msg.channelIndex = channels[currentChannel];

currentChannel = (currentChannel + 1) % channels.length;
context.set('currentChannel', currentChannel);

return msg;
```

## Installation

### Via Node-RED Palette Manager

1. Open Node-RED
2. Go to **Menu → Manage Palette → Install**
3. Search for `node-red-contrib-clab-interfaces`
4. Click **Install**

### Via npm

```bash
cd ~/.node-red
npm install node-red-contrib-clab-interfaces
```

### Via Docker

Use the provided Docker Compose setup:

```bash
git clone https://github.com/YOUR_USERNAME/node-red-contrib-clab-interfaces.git
cd node-red-contrib-clab-interfaces
docker-compose up -d
```

## Quick Start

### GPIO Example

```json
[
    {
        "id": "gpio-in-example",
        "type": "clab-gpio-in",
        "name": "Button Input",
        "device": "IOT-GATE-iMX8",
        "pin": "DI0",
        "interval": 1000
    }
]
```

### Serial RS485 Example

```json
[
    {
        "id": "serial-out-example",
        "type": "clab-serial-out",
        "name": "Modbus TX",
        "port": "/dev/ttymxc2",
        "baudRate": 9600
    }
]
```

## Node Documentation

### clab-gpio-in / clab-gpio-out

Digital I/O for CompuLab devices.

**Supported Devices:**
- IOT-GATE-iMX8: DI0-DI3, DO0-DO3
- IOT-GATE-RPi: GPIO pins via gpiochip0
- IOT-LINK: DI0-DI7, DO0-DO7

**Input Properties:**
- `device` - Target device type
- `pin` - GPIO pin name
- `interval` - Polling interval (ms)

### clab-serial-in / clab-serial-out

RS232/RS485 serial communication.

**Configuration:**
- `port` - Serial device path
- `baudRate` - Baud rate (9600, 19200, 38400, 57600, 115200)
- `dataBits` - Data bits (7, 8)
- `stopBits` - Stop bits (1, 2)
- `parity` - Parity (none, even, odd)

### clab-analog-in

Analog input for industrial sensors.

**Input Types:**
- `current` - 4-20mA current loop
- `voltage` - 0-10V or 0-5V voltage input
- `temperature` - PT100/PT1000 RTD sensors

**Output:**
| Field | Type | Description |
|-------|------|-------------|
| `payload` | number | Measured value (scaled if enabled) |
| `raw` | number | Raw ADC value (e.g. 0-4095 for 12-bit) |
| `percent` | number | Value as percentage (0-100%) |
| `valid` | boolean | True if within expected range |
| `unit` | string | Unit of the value |
| `currentMA` | number | Current in mA (current type only) |
| `voltage` | number | Voltage in V (voltage type only) |
| `celsius` | number | Temperature in °C (temperature type only) |

**Scaling Example:**

A pressure sensor with 4-20mA output representing 0-10 bar:
- Input Type: `4-20mA Current`
- Enable Scaling: ✓
- Min: `0`, Max: `10`, Unit: `bar`

Output:
```json
{
  "payload": 5.5,
  "raw": 2048,
  "currentMA": 12.8,
  "percent": 55,
  "scaled": 5.5,
  "unit": "bar",
  "valid": true
}
```

### clab-can-in / clab-can-out

CAN bus communication.

**Configuration:**
- `interface` - CAN interface (can0, can1)
- `bitrate` - CAN bitrate (125000, 250000, 500000, 1000000)

### clab-system

System functions with action selector:

| Action | Description |
|--------|-------------|
| `info` | System information (hostname, kernel, CPU, memory) |
| `uptime` | System uptime |
| `temperature` | CPU temperature |
| `rtc-read` | Read hardware clock |
| `rtc-set` | Set hardware clock |
| `rtc-sync` | Sync RTC to system time |
| `watchdog-status` | Watchdog status |
| `watchdog-enable` | Enable watchdog |
| `watchdog-disable` | Disable watchdog |
| `watchdog-kick` | Reset watchdog timer |
| `tpm-status` | TPM availability |
| `tpm-random` | Generate random bytes via TPM |
| `reboot` | System reboot |
| `shutdown` | System shutdown |

### clab-bluetooth

Bluetooth control with action selector:

| Action | Description |
|--------|-------------|
| `status` | Adapter info |
| `enable` | Enable Bluetooth |
| `disable` | Disable Bluetooth |
| `scan` | Scan for devices |
| `devices` | List known devices |
| `connect` | Connect to device |
| `disconnect` | Disconnect from device |
| `remove` | Remove paired device |

### clab-gps

GPS functions:

| Action | Description |
|--------|-------------|
| `position` | Current position (lat, lon, alt, speed) |
| `satellites` | Satellite information |
| `distance` | Calculate distance between two points |
| `start-gpsd` | Start gpsd daemon |
| `stop-gpsd` | Stop gpsd daemon |

### clab-cellular

LTE/4G modem control:

| Action | Description |
|--------|-------------|
| `status` | Connection status |
| `info` | Modem information (manufacturer, model, IMEI) |
| `sim` | SIM card info (IMSI, ICCID) |
| `signal` | Signal strength (RSRP, RSRQ, quality %) |
| `connect` | Connect to network |
| `disconnect` | Disconnect |
| `enable` | Enable modem |
| `disable` | Disable modem |
| `reset` | Reset modem |
| `at-command` | Send AT command |

### clab-wifi

WiFi control:

| Action | Description |
|--------|-------------|
| `status` | WiFi status |
| `enable` | Enable WiFi |
| `disable` | Disable WiFi |
| `scan` | Scan for networks |
| `connect` | Connect to network |
| `disconnect` | Disconnect |
| `saved` | List saved connections |
| `delete` | Delete saved connection |
| `ap-start` | Start access point |
| `ap-stop` | Stop access point |

### clab-ethernet

Ethernet configuration:

| Action | Description |
|--------|-------------|
| `status` | Interface status (IP, MAC, speed) |
| `interfaces` | List all interfaces |
| `statistics` | RX/TX statistics |
| `enable` | Enable interface |
| `disable` | Disable interface |
| `dhcp` | Enable DHCP |
| `static` | Set static IP |

### clab-network

Network diagnostics:

| Action | Description |
|--------|-------------|
| `ping` | Ping host |
| `dns` | DNS lookup |
| `reverse-dns` | Reverse DNS lookup |
| `traceroute` | Trace route to host |
| `port-check` | Check TCP port |
| `http-check` | Check HTTP/HTTPS URL |
| `routes` | Show routing table |
| `arp` | Show ARP table |
| `speed-test` | Simple download speed test |

## Device Compatibility

| Feature | IOT-GATE-iMX8 | IOT-GATE-RPi | IOT-LINK | IOT-DIN-IMX8PLUS |
|---------|:-------------:|:------------:|:--------:|:----------------:|
| GPIO | ✅ | ✅ | ✅ | ✅ |
| Serial RS232/485 | ✅ | ✅ | ✅ | ✅ |
| CAN Bus | ✅ | ❌ | ✅ | ✅ |
| Analog 4-20mA | ✅ | ❌ | ✅ | ✅ |
| User LED | ✅ | ✅ | ✅ | ✅ |
| RTC | ✅ | ✅ | ✅ | ✅ |
| Watchdog | ✅ | ✅ | ✅ | ✅ |
| TPM | ✅ | ❌ | ❌ | ✅ |
| Bluetooth | ✅ | ✅ | ✅ | ✅ |
| GPS | ✅ | ✅ | ✅ | ✅ |
| LTE Modem | ✅ | ✅ | ✅ | ✅ |
| WiFi | ✅ | ✅ | ✅ | ✅ |

## Docker Setup

Uses the official Node-RED container with hardware mounts:

```yaml
version: '3.8'

services:
  node-red:
    image: nodered/node-red:latest
    container_name: node-red-clab
    ports:
      - "1880:1880"
    volumes:
      - node-red-data:/data
      - ./:/data/node_modules/node-red-contrib-clab-interfaces:ro
      - /dev:/dev
      - /sys:/sys:ro
    privileged: true
    group_add:
      - dialout
      - gpio
```

**Start:**
```bash
docker-compose up -d
```

**Install package in container:**
```bash
docker exec -it node-red-clab npm install node-red-contrib-clab-interfaces
docker restart node-red-clab
```

**Access:** http://localhost:1880

### Example Flows

Mount the demo flow to get started quickly:

```yaml
volumes:
  - ./examples/compulab-demo-flow.json:/data/flows.json:ro
```

Or import manually in Node-RED: Menu → Import → Select `examples/compulab-demo-flow.json`

See [examples/README.md](examples/README.md) for details.

### Docker Networking Considerations

For full hardware access (especially network interfaces like Ethernet, WiFi, Bluetooth), consider using **host network mode**:

```yaml
network_mode: host
```

**Quick Start for WiFi:**
- Getting `wpa_supplicant: not found` or `nmcli: not found`? → [WIFI-DOCKER-QUICKSTART.md](WIFI-DOCKER-QUICKSTART.md)

**Detailed documentation:**
- [DOCKER-NETWORK.md](DOCKER-NETWORK.md) - Ethernet and network interface access
- [DOCKER-WIFI.md](DOCKER-WIFI.md) - WiFi configuration and fallback methods
- [DOCKER-BLUETOOTH.md](DOCKER-BLUETOOTH.md) - Bluetooth setup and requirements
- [WIFI-MULTI-NETWORK.md](WIFI-MULTI-NETWORK.md) - Managing multiple WiFi networks

## Development

### Prerequisites

- Node.js >= 14.0.0
- Node-RED >= 2.0.0

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/node-red-contrib-clab-interfaces.git
cd node-red-contrib-clab-interfaces
npm install
```

### Testing

```bash
npm test
```

### Project Structure

```
node-red-contrib-clab-interfaces/
├── nodes/              # Node-RED node definitions
│   ├── clab-gpio.js
│   ├── clab-gpio.html
│   ├── clab-serial.js
│   ├── ...
│   └── icons/
│       └── clab.svg
├── lib/                # Helper libraries
│   ├── gpio-helper.js
│   ├── serial-helper.js
│   ├── can-helper.js
│   ├── system-helper.js
│   ├── bluetooth-helper.js
│   ├── gps-helper.js
│   ├── cellular-helper.js
│   ├── wifi-helper.js
│   ├── ethernet-helper.js
│   ├── network-helper.js
│   └── analog-helper.js
├── test/               # Unit tests
├── examples/           # Example flows
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## API Reference

See [API.md](./API.md) for detailed API documentation.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Resources

- [CompuLab IoT Gateways](https://www.compulab.com/products/iot-gateways/)
- [CompuLab Wiki - IOT-GATE-iMX8](https://mediawiki.compulab.com/w/index.php?title=IOT-GATE-iMX8_and_SBC-IOT-iMX8:_Debian_Linux:_How-To_Guide)
- [Node-RED Documentation](https://nodered.org/docs/)

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by CompuLab Ltd. 
CompuLab and related product names are trademarks of CompuLab Ltd.

## Support

For issues and feature requests, please use the GitHub Issues page.
