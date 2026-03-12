const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "react-build", "index.html"));
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }
}

function startBackend() {
  const backendPath = app.isPackaged
    ? path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "backend",
        "server.js",
      )
    : path.join(__dirname, "backend", "server.js");

  backendProcess = fork(backendPath, [], {
    cwd: path.dirname(backendPath),
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdio: "ignore", // 👈 hides backend logs
  });
}

app.whenReady().then(() => {
  createWindow(); // instant UI
  startBackend(); // backend starts in background
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
