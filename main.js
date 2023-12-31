const { app, Tray, Menu, BrowserWindow } = require('electron')
const HID = require('node-hid')
const usbDetection = require('usb-detection')
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');
const { ipcMain } = require('electron');


let win;
let tray = null;
let lastAppName = null;
let layouts = {}; 

app.isQuitting = false;

function createWindow () {
    usbDetection.startMonitoring();

    // Check if a window is already open
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length === 0) {
        // No window is open, so create a new one
        win = new BrowserWindow({
            width: 800,
            height: 600,
            //DEBUG
            //resizable: false,
            maximizable: false,
            title: 'Kompetter Companion',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false, // This is required when using ipcRenderer without a preload script
            }
        });

        win.loadFile('index.html');
        //DEBUG
/*
        // Create a default menu
        const menu = Menu.buildFromTemplate([
            {
                label: 'File',
                submenu: [
                    { role: 'quit' }
                ]
            },

        ])

        // Set the application menu
        Menu.setApplicationMenu(menu);*/

        checkDevice(win);
        monitorActiveWindow(win);

        usbDetection.on('add', () => {
            setTimeout(() => {
                checkDevice(win);
            }, 500);
        });
        usbDetection.on('remove', () => {
            checkDevice(win);
        });

        if (!fs.existsSync('layout.json')) {
            fs.writeFileSync('layout.json', JSON.stringify({}), 'utf8');
        }

        fs.readFile('layout.json', (err, data) => {
            if (err) {
                console.error(err);
            } else {
                layouts = JSON.parse(data); // Update the layouts variable here
                let layout = layouts[lastAppName];
                if (layout) {
                    win.webContents.send('loadLayout', layout);
                }
            }
        });

        win.on('close', (event) => {
            if (!app.isQuitting) {
                event.preventDefault();
                win.hide();
            } else {
                win = null; // dereference the window object
            }
        });
    } else {
        // A window is already open, so focus on it
        win = allWindows[0];
        win.focus();
    }
}

app.on('before-quit', () => {
    app.isQuitting = true;
});

app.whenReady().then(() => {
    createWindow()

    tray = new Tray('images/icon/mac/kompetter_tray_icon.png')

    tray.setToolTip('Kompetter-X Macro Keyboard Companion')

        // Add a click event listener to the tray icon
        tray.on('click', () => {
        if (win) {
            win.show();
        } else {
            createWindow();
        }
    })

    if (app.dock) { // Check if the dock API is available (macOS only)
        //DEBUG
        //app.dock.hide(); // Hide the app from the dock
    }
})

function checkDevice(win) {
    let devices = HID.devices()
    let deviceFound = false

    for (let device of devices) {
        if (device.vendorId === 1155 && device.productId === 22315) {
            deviceFound = true
            break
        }
    }

    win.webContents.send('deviceStatus', deviceFound ? 'Kompetter-X Connected' : 'Kompetter-X not connected')
}

function monitorActiveWindow(win) {
    setInterval(() => {
        // attempt to use the same Promise-based approach on all platforms
        activeWindowInfo()
            .then(appName => {
                handleAppNameChange(appName, win);
            })
            .catch(err => {
                console.log("Error getting active window");
                console.error(err);
            });
    }, 1000); // check every second
}

function handleAppNameChange(appName, win) {
    if (appName !== lastAppName && appName !== "Electron" && appName !== "Kompetter Companion") {
        lastAppName = appName;
        win.webContents.send('activeWindow', appName); // Send the active window name to the renderer process
        let layout = layouts[appName];
        if (layout) {
            win.webContents.send('loadLayout', layout);
        } else {
            // Send an empty layout if a layout for the application doesn't exist
            win.webContents.send('loadLayout', {});
        }
    }
}

const activeWin = require('active-win');
let activeWindowInfo;
if (os.platform() === 'darwin' || os.platform() === 'win32') {
    // macOS and Windows
    activeWindowInfo = async function() {
        const activeWindow = await activeWin();
        // Check if activeWindow is not null before trying to access its owner property
        return activeWindow ? activeWindow.owner.name : null; // This should return the application name
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

ipcMain.on('saveLayout', (event, layout) => {
    // Read the existing contents of the file
    fs.readFile('layout.json', (err, data) => {
        if (err) {
            console.error(err);
        } else {
            // Parse the existing layouts
            layouts = JSON.parse(data);

            // Update the specific layout that's being saved
            layouts[layout.appName] = layout.layout;

            // Write the updated layouts back to the file
            fs.writeFile('layout.json', JSON.stringify(layouts), err => {
                if (err) {
                    console.error(err);
                }
            });
        }
    });
});
