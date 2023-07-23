const { app, Tray, Menu, BrowserWindow } = require('electron')
const HID = require('node-hid')
const usbDetection = require('usb-detection')
const os = require('os');
const { exec } = require('child_process');

let tray = null

function createWindow () {
    let win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // This is required when using ipcRenderer without a preload script
        }
    })

    win.loadFile('index.html')

    checkDevice(win);
    monitorActiveWindow(win);

    usbDetection.on('add', () => {
        checkDevice(win);
    });
}

function checkDevice(win) {
    let devices = HID.devices()
    let deviceFound = false

    for (let device of devices) {
        if (device.vendorId === 1452 && device.productId === 592) {
            deviceFound = true
            break
        }
    }

    win.webContents.send('deviceStatus', deviceFound ? 'Kompetter-X Connected' : 'Kompetter-X not connected')
}

function monitorActiveWindow(win) {
    setInterval(async () => {
        try {
            if (os.platform() === 'darwin') {
                // macOS
                const window = await activeWindowInfo();
                win.webContents.send('activeWindow', window.title);
            } else {
                // Windows and Linux
                activeWindowInfo((err, window) => {
                    if (err) {
                        console.error(err);
                    } else {
                        win.webContents.send('activeWindow', window);
                    }
                });
            }
        } catch (err) {
            console.error(err);
        }
    }, 1000); // check every second
}

let activeWindowInfo;
if (os.platform() === 'darwin') {
    // macOS
    const activeWin = require('active-win');
    activeWindowInfo = async function() {
        return await activeWin();
    };
} else if (os.platform() === 'win32') {
    // Windows
    const { getActiveWindow } = require('node-process-windows');
    activeWindowInfo = function(callback) {
        getActiveWindow((err, window) => {
            if (err) {
                callback(err, null);
            } else {
                callback(null, window.process);
            }
        });
    };
} else if (os.platform() === 'linux') {
    // Linux
    activeWindowInfo = function(callback) {
        exec('xdotool getactivewindow getwindowname', (err, stdout, stderr) => {
            if (err) {
                callback(err, null);
            } else {
                callback(null, stdout);
            }
        });
    };
}

app.whenReady().then(() => {
    createWindow()

    tray = new Tray('images/kompetter_companion_logo.png')

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Item1', type: 'radio' },
        { label: 'Item2', type: 'radio' },
        { type: 'separator' },
        { label: 'Exit', click: () => { app.quit() } }
    ])

    tray.setToolTip('Kompetter-X Macro Keyboard Companion')
    tray.setContextMenu(contextMenu)
})