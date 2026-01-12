# API Reference

Complete API documentation for node-red-contrib-clab-interfaces.

## Table of Contents

- [GPIO Helper](#gpio-helper)
- [Serial Helper](#serial-helper)
- [CAN Helper](#can-helper)
- [Analog Helper](#analog-helper)
- [System Helper](#system-helper)
- [Bluetooth Helper](#bluetooth-helper)
- [GPS Helper](#gps-helper)
- [Cellular Helper](#cellular-helper)
- [WiFi Helper](#wifi-helper)
- [Ethernet Helper](#ethernet-helper)
- [Network Helper](#network-helper)

---

## GPIO Helper

### Constructor

```javascript
const GpioHelper = require('./lib/gpio-helper');
const gpio = new GpioHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `device` | string | `'IOT-GATE-iMX8'` | Target device type |

### Methods

#### `readInput(pin)`
Read digital input state.

**Parameters:**
- `pin` (string): Pin name (e.g., 'DI0', 'DI1')

**Returns:** `Promise<{pin, value, state}>`

#### `writeOutput(pin, value)`
Set digital output state.

**Parameters:**
- `pin` (string): Pin name (e.g., 'DO0', 'DO1')
- `value` (boolean|number): Output state

**Returns:** `Promise<{pin, value, success}>`

#### `readAllInputs()`
Read all digital inputs.

**Returns:** `Promise<{inputs: Array, timestamp}>`

#### `getAvailablePins()`
Get list of available pins for the configured device.

**Returns:** `Array<string>`

---

## Serial Helper

### Constructor

```javascript
const SerialHelper = require('./lib/serial-helper');
const serial = new SerialHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | string | `'/dev/ttymxc2'` | Serial port path |
| `baudRate` | number | `9600` | Baud rate |
| `dataBits` | number | `8` | Data bits (7 or 8) |
| `stopBits` | number | `1` | Stop bits (1 or 2) |
| `parity` | string | `'none'` | Parity (none, even, odd) |
| `device` | string | `'IOT-GATE-iMX8'` | Device type |

### Methods

#### `open()`
Open serial port connection.

**Returns:** `Promise<void>`

#### `close()`
Close serial port connection.

**Returns:** `Promise<void>`

#### `write(data)`
Write data to serial port.

**Parameters:**
- `data` (string|Buffer): Data to send

**Returns:** `Promise<{success, bytes}>`

#### `setMode(mode)`
Set RS232/RS485 mode (device-specific).

**Parameters:**
- `mode` (string): 'rs232' or 'rs485'

**Returns:** `Promise<{success, mode}>`

### Events

- `data` - Emitted when data is received
- `error` - Emitted on error
- `open` - Emitted when port is opened
- `close` - Emitted when port is closed

---

## CAN Helper

### Constructor

```javascript
const CanHelper = require('./lib/can-helper');
const can = new CanHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interface` | string | `'can0'` | CAN interface name |
| `bitrate` | number | `500000` | CAN bitrate |

### Methods

#### `setup()`
Configure and bring up CAN interface.

**Returns:** `Promise<{success, interface, bitrate}>`

#### `send(id, data, extended)`
Send CAN message.

**Parameters:**
- `id` (number): CAN ID
- `data` (Array<number>): Data bytes (max 8)
- `extended` (boolean): Use extended ID (29-bit)

**Returns:** `Promise<{success, id, data}>`

#### `startReceive(callback)`
Start receiving CAN messages.

**Parameters:**
- `callback` (function): Called with received messages

#### `stopReceive()`
Stop receiving CAN messages.

#### `parseCanId(id)`
Parse CAN ID from string or number.

**Returns:** `number`

#### `isValidStandardId(id)`
Check if ID is valid standard (11-bit) CAN ID.

**Returns:** `boolean`

#### `isValidExtendedId(id)`
Check if ID is valid extended (29-bit) CAN ID.

**Returns:** `boolean`

---

## Analog Helper

### Constructor

```javascript
const AnalogHelper = require('./lib/analog-helper');
const analog = new AnalogHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `device` | string | `'IOT-GATE-iMX8'` | Device type |

### Methods

#### `readRaw(deviceIndex, channelIndex)`
Read raw ADC value.

**Parameters:**
- `deviceIndex` (number): IIO device index (default: 0)
- `channelIndex` (number): Channel index (default: 0)

**Returns:** `{raw, device, channel, scale, offset}`

#### `readCurrent(deviceIndex, channelIndex)`
Read 4-20mA current value.

**Parameters:**
- `deviceIndex` (number): IIO device index
- `channelIndex` (number): Channel index

**Returns:**
```javascript
{
  raw: 2048,           // Raw ADC value (e.g. 0-4095)
  currentMA: 12.8,     // Current in milliamps
  percent: 55,         // Percentage (0-100%)
  valid: true,         // True if 4-20mA range
  device: "max11108",  // Device name
  channel: "in_current0",
  unit: "mA"
}
```

#### `readVoltage(deviceIndex, channelIndex, maxVoltage)`
Read voltage value.

**Parameters:**
- `deviceIndex` (number): IIO device index
- `channelIndex` (number): Channel index
- `maxVoltage` (number): Maximum voltage (5 or 10, default: 10)

**Returns:**
```javascript
{
  raw: 2048,
  voltage: 5.0,        // Voltage in volts
  percent: 50,
  valid: true,
  device: "...",
  channel: "in_voltage0",
  unit: "V",
  maxVoltage: 10
}
```

#### `readTemperature(deviceIndex, channelIndex, sensorType)`
Read temperature from PT100/PT1000 sensor.

**Parameters:**
- `deviceIndex` (number): IIO device index
- `channelIndex` (number): Channel index
- `sensorType` (string): 'PT100' or 'PT1000'

**Returns:**
```javascript
{
  raw: 1234,
  celsius: 25.5,
  fahrenheit: 77.9,
  kelvin: 298.65,
  device: "...",
  channel: "...",
  sensorType: "PT100",
  unit: "°C"
}
```

#### `readScaled(options)`
Read and scale to engineering units.

**Parameters:**
```javascript
{
  deviceIndex: 0,
  channelIndex: 0,
  inputType: 'current',  // 'current' or 'voltage'
  minValue: 0,           // Scaled min (at 4mA/0V)
  maxValue: 100,         // Scaled max (at 20mA/10V)
  unit: 'bar',           // Engineering unit
  decimals: 2,           // Decimal places
  maxVoltage: 10         // For voltage type
}
```

**Returns:**
```javascript
{
  raw: 2048,
  currentMA: 12.8,       // or voltage
  percent: 55,
  scaled: 5.5,           // Scaled value
  scaledUnit: "bar",
  minValue: 0,
  maxValue: 10,
  inputType: "current",
  valid: true
}
```

#### `getDevices()`
Get list of available IIO/ADC devices.

**Returns:**
```javascript
[
  {
    id: "iio:device0",
    name: "max11108",
    path: "/sys/bus/iio/devices/iio:device0",
    channels: [
      { name: "in_current0", hasScale: true, scale: 0.00684 }
    ]
  }
]
```

#### `isAvailable()`
Check if any analog input devices are available.

**Returns:** `boolean`

---

## System Helper

### Constructor

```javascript
const SystemHelper = require('./lib/system-helper');
const system = new SystemHelper();
```

### Methods

#### `getSystemInfo()`
Get system information.

**Returns:** `Promise<{hostname, kernel, cpu, memory, ...}>`

#### `getUptime()`
Get system uptime.

**Returns:** `Promise<{seconds, formatted, uptime}>`

#### `getTemperature()`
Get CPU temperature.

**Returns:** `Promise<{celsius, fahrenheit, raw}>`

#### `getRtcTime()`
Read hardware clock (RTC).

**Returns:** `Promise<{time, timestamp}>`

#### `setRtcTime(time)`
Set hardware clock.

**Parameters:**
- `time` (string|Date): Time to set

**Returns:** `Promise<{success, time}>`

#### `syncRtcToSystem()`
Sync RTC to system time.

**Returns:** `Promise<{success}>`

#### `getWatchdogStatus()`
Get watchdog status.

**Returns:** `Promise<{enabled, timeout}>`

#### `enableWatchdog(timeout)`
Enable watchdog.

**Parameters:**
- `timeout` (number): Timeout in seconds

**Returns:** `Promise<{success, timeout}>`

#### `disableWatchdog()`
Disable watchdog.

**Returns:** `Promise<{success}>`

#### `kickWatchdog()`
Reset watchdog timer.

**Returns:** `Promise<{success}>`

#### `getTpmStatus()`
Get TPM status.

**Returns:** `Promise<{available, version}>`

#### `getTpmRandom(bytes)`
Generate random bytes via TPM.

**Parameters:**
- `bytes` (number): Number of bytes

**Returns:** `Promise<{bytes, hex, base64}>`

#### `reboot(delay)`
Reboot system.

**Parameters:**
- `delay` (number): Delay in seconds

**Returns:** `Promise<{success}>`

#### `shutdown(delay)`
Shutdown system.

**Parameters:**
- `delay` (number): Delay in seconds

**Returns:** `Promise<{success}>`

---

## Bluetooth Helper

### Constructor

```javascript
const BluetoothHelper = require('./lib/bluetooth-helper');
const bt = new BluetoothHelper();
```

### Methods

#### `isAvailable()`
Check if Bluetooth is available.

**Returns:** `Promise<boolean>`

#### `getAdapterInfo()`
Get Bluetooth adapter information.

**Returns:** `Promise<{adapter, address, status, name}>`

#### `enable()`
Enable Bluetooth.

**Returns:** `Promise<{success, message}>`

#### `disable()`
Disable Bluetooth.

**Returns:** `Promise<{success, message}>`

#### `scan(duration)`
Scan for Bluetooth devices.

**Parameters:**
- `duration` (number): Scan duration in seconds (default: 10)

**Returns:** `Promise<{success, devices, count}>`

#### `getDevices()`
Get list of known devices.

**Returns:** `Promise<{success, devices, count}>`

#### `connect(address)`
Connect to Bluetooth device.

**Parameters:**
- `address` (string): MAC address

**Returns:** `Promise<{success, address, message}>`

#### `disconnect(address)`
Disconnect from device.

**Parameters:**
- `address` (string): MAC address

**Returns:** `Promise<{success, address, message}>`

#### `remove(address)`
Remove paired device.

**Parameters:**
- `address` (string): MAC address

**Returns:** `Promise<{success, address, message}>`

#### `getConnectionStatus(address)`
Get connection status of device.

**Parameters:**
- `address` (string): MAC address

**Returns:** `Promise<{address, name, connected, paired, trusted}>`

---

## GPS Helper

### Constructor

```javascript
const GPSHelper = require('./lib/gps-helper');
const gps = new GPSHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `device` | string | `'/dev/ttyUSB1'` | GPS device path |
| `gpsdHost` | string | `'localhost'` | gpsd host |
| `gpsdPort` | number | `2947` | gpsd port |

### Methods

#### `isAvailable()`
Check if GPS is available.

**Returns:** `Promise<boolean>`

#### `startGpsd()`
Start gpsd daemon.

**Returns:** `Promise<{success, message}>`

#### `stopGpsd()`
Stop gpsd daemon.

**Returns:** `Promise<{success, message}>`

#### `getPosition()`
Get current GPS position.

**Returns:** `Promise<{success, latitude, longitude, altitude, speed, heading, fix, ...}>`

#### `getSatellites()`
Get satellite information.

**Returns:** `Promise<{success, visible, used, satellites}>`

#### `calculateDistance(lat1, lon1, lat2, lon2)`
Calculate distance between two points (Haversine formula).

**Parameters:**
- `lat1`, `lon1` (number): First point coordinates
- `lat2`, `lon2` (number): Second point coordinates

**Returns:** `number` - Distance in meters

#### `formatCoordinates(lat, lon, format)`
Format coordinates as string.

**Parameters:**
- `lat`, `lon` (number): Coordinates
- `format` (string): 'decimal' or 'dms'

**Returns:** `string`

---

## Cellular Helper

### Constructor

```javascript
const CellularHelper = require('./lib/cellular-helper');
const cellular = new CellularHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `modemDevice` | string | `'/dev/ttyUSB2'` | Modem device path |
| `modemInterface` | string | `'wwan0'` | Network interface |
| `apn` | string | `'internet'` | Default APN |

### Methods

#### `isAvailable()`
Check if modem is available.

**Returns:** `Promise<boolean>`

#### `getModemInfo()`
Get modem information.

**Returns:** `Promise<{success, manufacturer, model, imei, state, ...}>`

#### `getSimInfo()`
Get SIM card information.

**Returns:** `Promise<{success, imsi, iccid, operatorName, operatorCode}>`

#### `getSignalStrength()`
Get signal strength.

**Returns:** `Promise<{success, rsrp, rsrq, rssi, sinr, quality, rating}>`

#### `connect(apn)`
Connect to mobile network.

**Parameters:**
- `apn` (string): APN (optional, uses default)

**Returns:** `Promise<{success, message, apn}>`

#### `disconnect()`
Disconnect from network.

**Returns:** `Promise<{success, message}>`

#### `reset()`
Reset modem.

**Returns:** `Promise<{success, message}>`

#### `setPowerState(enabled)`
Enable or disable modem.

**Parameters:**
- `enabled` (boolean): Power state

**Returns:** `Promise<{success, enabled, message}>`

#### `getConnectionStatus()`
Get connection status.

**Returns:** `Promise<{success, connected, state, ipAddress, ...}>`

#### `sendATCommand(command)`
Send AT command to modem.

**Parameters:**
- `command` (string): AT command

**Returns:** `Promise<{success, command, response}>`

---

## WiFi Helper

### Constructor

```javascript
const WiFiHelper = require('./lib/wifi-helper');
const wifi = new WiFiHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interface` | string | `'wlan0'` | WiFi interface |

### Methods

#### `isAvailable()`
Check if WiFi is available.

**Returns:** `Promise<boolean>`

#### `getStatus()`
Get WiFi status.

**Returns:** `Promise<{interface, state, connection, connected, ipAddress, ...}>`

#### `enable()`
Enable WiFi.

**Returns:** `Promise<{success, message}>`

#### `disable()`
Disable WiFi.

**Returns:** `Promise<{success, message}>`

#### `scan()`
Scan for WiFi networks.

**Returns:** `Promise<{success, networks, count}>`

#### `connect(ssid, password)`
Connect to WiFi network.

**Parameters:**
- `ssid` (string): Network name
- `password` (string): Password (optional for open networks)

**Returns:** `Promise<{success, ssid, message}>`

#### `disconnect()`
Disconnect from WiFi.

**Returns:** `Promise<{success, message}>`

#### `createAccessPoint(ssid, password, band)`
Create WiFi access point.

**Parameters:**
- `ssid` (string): AP name
- `password` (string): AP password
- `band` (string): 'bg' (2.4GHz) or 'a' (5GHz)

**Returns:** `Promise<{success, ssid, message}>`

#### `stopAccessPoint()`
Stop access point.

**Returns:** `Promise<{success, message}>`

#### `getSavedConnections()`
Get saved WiFi connections.

**Returns:** `Promise<{success, connections, count}>`

#### `deleteConnection(name)`
Delete saved connection.

**Parameters:**
- `name` (string): Connection name

**Returns:** `Promise<{success, message}>`

---

## Ethernet Helper

### Constructor

```javascript
const EthernetHelper = require('./lib/ethernet-helper');
const eth = new EthernetHelper(options);
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `interface` | string | `'eth0'` | Ethernet interface |

### Methods

#### `getInterfaces()`
Get all network interfaces.

**Returns:** `Promise<{success, interfaces, count}>`

#### `getStatus(interface)`
Get interface status.

**Parameters:**
- `interface` (string): Interface name (optional)

**Returns:** `Promise<{interface, state, connected, ipAddress, macAddress, ...}>`

#### `enable(interface)`
Enable interface.

**Returns:** `Promise<{success, interface, message}>`

#### `disable(interface)`
Disable interface.

**Returns:** `Promise<{success, interface, message}>`

#### `setStaticIP(config)`
Set static IP configuration.

**Parameters:**
- `config.interface` (string): Interface name
- `config.ipAddress` (string): IP address
- `config.netmask` (string): Netmask
- `config.gateway` (string): Gateway
- `config.dns` (Array<string>): DNS servers

**Returns:** `Promise<{success, ipAddress, ...}>`

#### `setDHCP(interface)`
Enable DHCP.

**Returns:** `Promise<{success, interface, method}>`

#### `getStatistics(interface)`
Get interface statistics.

**Returns:** `Promise<{success, interface, statistics}>`

#### `cidrToNetmask(cidr)`
Convert CIDR to netmask.

**Returns:** `string`

#### `netmaskToCidr(netmask)`
Convert netmask to CIDR.

**Returns:** `number`

---

## Network Helper

### Constructor

```javascript
const NetworkHelper = require('./lib/network-helper');
const network = new NetworkHelper();
```

### Methods

#### `ping(host, options)`
Ping a host.

**Parameters:**
- `host` (string): Target host
- `options.count` (number): Ping count (default: 4)
- `options.timeout` (number): Timeout in seconds (default: 5)

**Returns:** `Promise<{success, host, alive, packets, rtt}>`

#### `traceroute(host, options)`
Trace route to host.

**Parameters:**
- `host` (string): Target host
- `options.maxHops` (number): Maximum hops (default: 30)

**Returns:** `Promise<{success, host, hops, totalHops, reached}>`

#### `dnsLookup(hostname, options)`
DNS lookup.

**Parameters:**
- `hostname` (string): Hostname to resolve
- `options.type` (string): Record type (A, AAAA, MX, TXT, NS, CNAME)

**Returns:** `Promise<{success, hostname, type, records}>`

#### `reverseDns(ip)`
Reverse DNS lookup.

**Parameters:**
- `ip` (string): IP address

**Returns:** `Promise<{success, ip, hostnames}>`

#### `checkPort(host, port, timeout)`
Check if TCP port is open.

**Parameters:**
- `host` (string): Target host
- `port` (number): Port number
- `timeout` (number): Timeout in ms (default: 5000)

**Returns:** `Promise<{success, host, port, open, responseTime}>`

#### `checkHttp(url, options)`
Check HTTP/HTTPS URL.

**Parameters:**
- `url` (string): URL to check
- `options.timeout` (number): Timeout in ms
- `options.method` (string): HTTP method

**Returns:** `Promise<{success, url, statusCode, ok, responseTime}>`

#### `speedTest(options)`
Simple download speed test.

**Parameters:**
- `options.url` (string): Test file URL

**Returns:** `Promise<{success, bytes, duration, speedMbps}>`

#### `getArpTable()`
Get ARP table.

**Returns:** `Promise<{success, entries, count}>`

#### `getRoutes()`
Get routing table.

**Returns:** `Promise<{success, routes, count}>`
