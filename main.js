const { app, Tray, Menu, BrowserWindow } = require('electron')
const HID = require('node-hid')
const usbDetection = require('usb-detection')

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
