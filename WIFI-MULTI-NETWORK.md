# WiFi Multi-Network Configuration

The WiFi node now supports multiple network configurations using Node-RED's credential system, similar to how server credentials work.

## Features

- **Multiple WiFi Networks**: Store credentials for multiple networks (Home, Office, Mobile Hotspot, etc.)
- **Easy Switching**: Switch between networks by selecting different WiFi Config nodes
- **Secure Storage**: Passwords are stored securely in Node-RED's credential store
- **Reusable Configs**: Use the same WiFi configuration across multiple flows

## Setup

### 1. Create WiFi Configuration Nodes

1. Open Node-RED editor
2. Add a WiFi node to your flow
3. Double-click to edit
4. Select "Connect" as the action
5. Click the pencil icon next to "WiFi Network" dropdown
6. Create a new WiFi Config:
   - **Name**: e.g., "Home WiFi"
   - **SSID**: Your network name
   - **Password**: Your WiFi password
7. Click "Add"
8. Repeat for each network you want to save (Office WiFi, Mobile Hotspot, etc.)

### 2. Create WiFi Nodes for Each Network

Create separate WiFi nodes for each network you want to connect to:

```
[Inject: Home] --> [WiFi: Connect to Home]
[Inject: Office] --> [WiFi: Connect to Office]
[Inject: Hotspot] --> [WiFi: Connect to Hotspot]
```

Each WiFi node should:
- Have **Action** set to "Connect"
- Have a different **WiFi Network** config selected

### 3. Switch Between Networks

Simply trigger the appropriate WiFi node to connect to that network:

```json
// Trigger Home WiFi node
{ "payload": {} }

// Or override with msg properties
{
    "action": "connect",
    "ssid": "Different-Network",
    "password": "different-password"
}
```

## Example Flow

```json
[
    {
        "id": "home-wifi-config",
        "type": "clab-wifi-config",
        "name": "Home WiFi",
        "ssid": "MyHomeNetwork"
    },
    {
        "id": "office-wifi-config",
        "type": "clab-wifi-config",
        "name": "Office WiFi",
        "ssid": "CompanyNetwork"
    },
    {
        "id": "connect-home",
        "type": "clab-wifi",
        "name": "Connect Home",
        "action": "connect",
        "wifiConfig": "home-wifi-config"
    },
    {
        "id": "connect-office",
        "type": "clab-wifi",
        "name": "Connect Office",
        "action": "connect",
        "wifiConfig": "office-wifi-config"
    }
]
```

## Use Cases

### Automatic Network Switching

Switch networks based on location or time:

```
[GPS Check] --> [Switch] --> [WiFi: Home]
                         --> [WiFi: Office]
```

### Failover

Try multiple networks in sequence:

```
[WiFi: Primary] --> [Check Status] --> [WiFi: Backup]
```

### Scheduled Switching

Connect to different networks at different times:

```
[Cron: 8am] --> [WiFi: Office]
[Cron: 6pm] --> [WiFi: Home]
```

## Message Properties

You can still override WiFi configs with message properties:

```javascript
msg.ssid = "TemporaryNetwork";
msg.password = "temp-password";
msg.action = "connect";
```

Priority: `msg.ssid` > WiFi Config node > error

## Security Notes

- WiFi passwords are stored in Node-RED's credential store
- Credentials are encrypted at rest
- Credentials are not exported in flows (unless explicitly exported)
- Use environment variables for additional security:
  ```javascript
  msg.password = env.get("WIFI_PASSWORD");
  ```

## Troubleshooting

### "SSID required" Error

Make sure you have:
1. Selected a WiFi Config node in the WiFi node configuration
2. OR provided `msg.ssid` in the incoming message

### Config Node Not Appearing

1. Deploy your flow after creating WiFi Config nodes
2. Refresh the Node-RED editor
3. Check that the WiFi Config node has a valid SSID

### Password Not Working

1. Edit the WiFi Config node
2. Re-enter the password
3. Click "Update" and "Deploy"
