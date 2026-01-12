# LED Permissions Setup

## Problem

The LED control requires write access to `/sys/class/leds/*/brightness` files, which are owned by `root:root` by default.

## Solution Options

### Option 1: Run Node-RED with sudo (Quick, but not recommended for production)

```bash
sudo node-red
```

**Pros:** Works immediately  
**Cons:** Security risk, not recommended

### Option 2: Add udev rules (Recommended)

Create a udev rule to change LED permissions:

```bash
sudo nano /etc/udev/rules.d/99-user-leds.rules
```

Add the following content:

```
# CompuLab User LEDs - Allow non-root access
SUBSYSTEM=="leds", KERNEL=="Green_*", MODE="0666"
SUBSYSTEM=="leds", KERNEL=="Red_*", MODE="0666"
SUBSYSTEM=="leds", KERNEL=="PowerLED_*", MODE="0666"
```

Reload udev rules:

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Option 3: Add user to gpio/leds group

Some systems have a `gpio` or `leds` group:

```bash
# Check if group exists
getent group gpio || getent group leds

# Add your user (replace 'username' with actual username)
sudo usermod -a -G gpio username
# or
sudo usermod -a -G leds username

# Logout and login again for changes to take effect
```

### Option 4: Configure sudo without password (For LED commands only)

Create a sudoers file for LED control:

```bash
sudo visudo -f /etc/sudoers.d/node-red-leds
```

Add:

```
# Allow node-red user to control LEDs without password
node-red ALL=(ALL) NOPASSWD: /bin/sh -c echo * > /sys/class/leds/*/brightness
```

## Verify Permissions

After applying any solution, verify:

```bash
# Check current permissions
ls -l /sys/class/leds/Green_1/brightness

# Test write access (as your user, not root)
echo 1 > /sys/class/leds/Green_1/brightness
echo 0 > /sys/class/leds/Green_1/brightness
```

## Docker Considerations

If running Node-RED in Docker, you need:

1. **Privileged mode** or **device access**:

```yaml
# docker-compose.yml
services:
  node-red:
    privileged: true
    # OR
    devices:
      - /sys/class/leds:/sys/class/leds
```

2. **Volume mount** for sysfs:

```yaml
volumes:
  - /sys:/sys
```

## Current Fallback Behavior

The LED node attempts multiple methods:

1. Direct write to `/sys/class/leds/*/brightness`
2. Write with `sudo sh -c "echo ..."`
3. Write with `sh -c "echo ..."`

If all fail, you'll see an error message with permission details.

## Testing

Test LED control from Node-RED:

```javascript
// In a Function node
msg.action = "blink";
msg.interval = 500;
return msg;
```

If you see "Cannot access LED" error, check permissions using the solutions above.
