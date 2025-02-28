const os = require("os");
const ip = require("ip");

/**
 * Prints a stylish intro in the terminal when starting the Ascendara development server
 * @param {string} appVersion - The current version of the application
 * @param {string} nodeEnv - The current Node environment
 * @param {boolean} isDev - Whether the app is running in development mode
 */
function printDevModeIntro(appVersion, nodeEnv, isDev = true) {
  // Clear the console
  console.clear();

  const hostname = os.hostname();
  const platform = os.platform();
  const release = os.release();
  const arch = os.arch();
  const localIp = ip.address();

  // ANSI color codes for simple coloring
  const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",

    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",

    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",
  };

  // Title with decoration
  console.log("");
  console.log(
    `${colors.cyan}${colors.bright}  ╔═══════════════════════════════════════════╗${colors.reset}`
  );
  console.log(
    `${colors.cyan}${colors.bright}  ║           ASCENDARA DEVELOPER MODE        ║${colors.reset}`
  );
  console.log(
    `${colors.cyan}${colors.bright}  ║           Version: ${appVersion} (${nodeEnv})${" ".repeat(Math.max(0, 15 - appVersion.length - nodeEnv.length))}    ║${colors.reset}`
  );
  console.log(
    `${colors.cyan}${colors.bright}  ╚═══════════════════════════════════════════╝${colors.reset}`
  );
  console.log("");

  // System Information
  console.log(`${colors.green}  💻 SYSTEM INFORMATION${colors.reset}`);
  console.log(`    OS: ${platform} ${release} (${arch})`);
  console.log(`    Hostname: ${hostname}`);
  console.log("");

  // Network Information
  console.log(`${colors.blue}  🌐 NETWORK INFORMATION${colors.reset}`);
  console.log(`    Local IP: ${localIp}`);
  console.log(`    Connect: http://${localIp}`);
  console.log("");

  // Developer Tools
  console.log(`${colors.magenta}  🛠️  DEVELOPER TOOLS${colors.reset}`);
  console.log("    • Press Ctrl+C to exit developer mode");
  console.log("    • View logs in console for debugging");
  console.log("");

  // Documentation
  console.log(`${colors.yellow}  📚 DOCUMENTATION${colors.reset}`);
  console.log("    • Docs: https://ascendara.app/docs");
  console.log("");

  // Warning if not in dev mode (at the bottom)
  if (!isDev) {
    console.log("");
    console.log(
      `${colors.yellow}${colors.bright}  ⚠️  WARNING: NOT RUNNING IN DEVELOPER MODE ⚠️${colors.reset}`
    );
    console.log(
      `${colors.yellow}${colors.bright}  The app will not load correctly unless isDev is set to true.${colors.reset}`
    );
    console.log(
      `${colors.yellow}${colors.bright}  Please restart the application in developer mode.${colors.reset}`
    );
    console.log("");
  }
}

module.exports = {
  printDevModeIntro,
};
