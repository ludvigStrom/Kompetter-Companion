const { app, Tray, Menu, BrowserWindow } = require('electron')
const HID = require('node-hid')
const usbDetection = require('usb-detection')
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');
const { ipcMain } = require('electron');

let tray = null

function createWindow () {
    let win = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Kompetter Companion',
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

    if (!fs.existsSync('layout.json')) {
        fs.writeFileSync('layout.json', JSON.stringify({}), 'utf8');
    }
    
    fs.readFile('layout.json', (err, data) => {
        if (err) {
            console.error(err);
        } else {
            let layout = JSON.parse(data);
            win.webContents.send('loadLayout', layout);
        }
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
                const appName = await activeWindowInfo();
                win.webContents.send('activeWindow', appName);
            } else {
                // Windows and Linux
                activeWindowInfo((err, appName) => {
                    if (err) {
                        console.error(err);
                    } else {
                        win.webContents.send('activeWindow', appName);
                    }
                });
            }
        } catch (err) {
            console.error(err);
        }
    }, 1000); // check every second
}

const activeWin = require('active-win');
let activeWindowInfo;
if (os.platform() === 'darwin' || os.platform() === 'win32') {
    // macOS and Windows
    activeWindowInfo = async function() {
        const activeWindow = await activeWin();
        return activeWindow.owner.name; // This should return the application name
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

ipcMain.on('saveLayout', (event, layout) => {
    fs.writeFile('layout.json', JSON.stringify(layout), err => {
        if (err) {
            console.error(err);
        }
    });
});