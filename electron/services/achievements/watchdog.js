"use strict";
console.log("watchdog.js script loaded and running.");

const instance = new (require("single-instance"))("Achievement Watchdog");
const path = require("path");
const watch = require("node-watch");
const moment = require("moment");
const fs = require("fs").promises;
const monitor = require("./monitor.js");
const steam = require("./steam.js");
const track = require("./track.js");
const { spawn } = require("child_process");
let config;
try {
  config = require("./config.prod.js");
} catch (e) {
  config = {};
}

// Get config from ENV or IPC
const STEAM_WEB_API_KEY =
  process.env.REACT_APP_ASCENDARA_STEAM_WEB_API_KEY || config.ASCENDARA_STEAM_WEB_API_KEY;
const steamLangDefs = require("./steam.json");

async function getSteamApiLang() {
  // Get settings from preload/renderer
  let settings;
  try {
    settings = await window.electron.getSettings();
  } catch {
    // fallback: default to English
    return "english";
  }
  const userLang = settings?.language || "en";
  // Map to steam.json api code
  const match = steamLangDefs.find(
    lang =>
      lang.iso?.toLowerCase().startsWith(userLang.toLowerCase()) ||
      lang.webapi?.toLowerCase().startsWith(userLang.toLowerCase()) ||
      lang.api?.toLowerCase() === userLang.toLowerCase()
  );
  return match ? match.api : "english";
}
// sendNotification now accepts an object with notification details
let sendNotification = opts => {
  try {
    // Use process.resourcesPath if available, otherwise fallback to __dirname
    const exePath = path.join(
      process.resourcesPath || __dirname,
      "AscendaraNotificationHelper.exe"
    );
    // Build argument list
    let args = [];
    args.push("--is-achievement");
    // Use theme from opts, otherwise fallback to settings.theme
    let theme = opts.theme;
    if (!theme && typeof settings === "object" && settings.theme) {
      theme = settings.theme;
    }
    if (theme) args.push("--theme", String(theme));
    if (opts.title) args.push("--title", String(opts.title));
    if (opts.message) args.push("--message", String(opts.message));
    if (opts.icon) args.push("--icon", String(opts.icon));
    if (opts.appid) args.push("--appid", String(opts.appid));
    if (opts.game) args.push("--game", String(opts.game));
    if (opts.achievement) args.push("--achievement", String(opts.achievement));
    const child = spawn(exePath, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    child.on("error", err => {
      if (err.code === "ENOENT") {
        console.error("Notification helper executable not found:", exePath);
      } else {
        console.error("Failed to spawn notification helper:", err);
      }
      // Do not exit or throw, just log
    });
  } catch (e) {
    console.error("Failed to spawn notification:", e);
    // Do not exit or throw, just log
  }
};

var app = {
  isRecording: false,
  cache: [],
  options: {
    notification_advanced: {
      tick: 2000, // ms between notifications
    },
  },
  watcher: [],
  tick: 0,
  toastID: "Microsoft.XboxApp_8wekyb3d8bbwe!Microsoft.XboxApp",
  start: async function () {
    try {
      let self = this;
      self.cache = [];
      console.log("Achievement Watchdog starting ...");
      const folders = await monitor.getFolders();
      console.log(`monitor.getFolders() returned:`, folders);
      let i = 1;
      for (let folder of folders) {
        try {
          try {
            await fs.access(folder.dir);
            // If no error, folder exists
            self.watch(i, folder.dir, folder.options);
            i = i + 1;
          } catch (err) {
            // Folder does not exist, skip
          }
          i = i + 1;
        } catch (err) {
          console.log(err);
        }
      }
    } catch (err) {
      console.log(err);
      instance.unlock();
      process.exit();
    }
  },
  watch: function (i, dir, options) {
    let self = this;
    console.log(
      `Monitoring achievement changes in directory: "${dir}" with options:`,
      options
    );
    if (options.file && options.file.length > 0) {
      console.log(
        `Watching files in ${dir}: ${JSON.stringify(options.file)} with filter: ${options.filter}`
      );
    } else {
      console.warn(
        `WARNING: No files specified to watch in ${dir}. options.file is:`,
        options.file
      );
    }

    self.watcher[i] = watch(
      dir,
      { recursive: options.recursive, filter: options.filter },
      async function (evt, name) {
        console.log(`File event: ${evt} on file: ${name}`);
        try {
          if (evt !== "update") {
            console.log(`Ignoring event: ${evt} (only processing 'update' events)`);
            return;
          }

          const currentTime = Date.now();
          const fileLastModified = (await fs.stat(name)).mtimeMs || 0;
          console.log(
            `File last modified: ${fileLastModified}, current time: ${currentTime}, difference: ${currentTime - fileLastModified}ms`
          );
          if (currentTime - fileLastModified > 1000) {
            console.log(`Skipping event: file modified more than 1s ago.`);
            return;
          }

          let filePath = path.parse(name);
          console.log(`Checking if file is in watch list: ${filePath.base}`);
          if (!options.file.some(file => file == filePath.base)) {
            console.log(`File ${filePath.base} not in options.file, skipping.`);
            return;
          }

          console.log(`Achievement file change detected: ${name}`);

          if (
            moment().diff(moment(self.tick)) <= self.options.notification_advanced.tick
          ) {
            console.log(`Spamming protection active, skipping notification.`);
            throw "Spamming protection is enabled > SKIPPING";
          }
          self.tick = moment().valueOf();

          let appID;
          try {
            appID = options.appid
              ? options.appid
              : filePath.dir
                  .replace(/(\\stats$)|(\\SteamEmu$)|(\\SteamEmu\\UserStats$)/g, "")
                  .match(/([0-9]+$)/g)[0];
            console.log(`Detected appID: ${appID}`);
          } catch (err) {
            console.log(`Failed to extract appID from path: ${filePath.dir}`);
            throw "Unable to find game's appID";
          }

          let game = await self.load(appID);

          let isRunning = false;

          if (options.disableCheckIfProcessIsRunning === true) {
            isRunning = true;
          } else if (self.options.notification_advanced.checkIfProcessIsRunning) {
            if (await isFullscreenAppRunning()) {
              isRunning = true;
              console.log(
                "Fullscreen application detected on primary display. Assuming process is running"
              );
            } else if (game.binary) {
              isRunning = await tasklist.isProcessRunning(game.binary).catch(err => {
                console.error(err);
                console.warn("Assuming process is NOT running");
                return false;
              });

              if (!isRunning) {
                console.log("Trying with '-Win64-Shipping' (Unreal Engine Game) ...");
                isRunning = await tasklist
                  .isProcessRunning(game.binary.replace(".exe", "-Win64-Shipping.exe"))
                  .catch(err => {
                    console.error(err);
                    console.warn("Assuming process is NOT running");
                    return false;
                  });
              }
            } else {
              console.warn(
                `Warning! Missing "${game.name}" (${game.appid}) binary name > Overriding user choice to check if process is running`
              );
              isRunning = true;
            }
          } else {
            isRunning = true;
          }

          if (isRunning) {
            let achievements = await monitor.parse(name);

            if (achievements.length > 0) {
              let cache = await track.load(appID);

              let j = 0;
              for (let i in achievements) {
                if (Object.prototype.hasOwnProperty.call(achievements, i)) {
                  try {
                    let ach = game.achievement.list.find(achievement => {
                      if (achievements[i].crc) {
                        return achievements[i].crc.includes(
                          crc32(achievement.name).toString(16)
                        ); //(SSE) crc module removes leading 0 when dealing with anything below 0x1000 -.-'
                      } else {
                        return (
                          achievement.name == achievements[i].name ||
                          achievement.name.toUpperCase() ==
                            achievements[i].name.toUpperCase()
                        ); //uppercase == uppercase : cdx xcom chimera (apiname doesn't match case with steam schema)
                      }
                    });
                    if (!ach) throw "ACH_NOT_FOUND_IN_SCHEMA";

                    if (achievements[i].crc) {
                      achievements[i].name = ach.name;
                      delete achievements[i].crc;
                    }

                    let previous = cache.find(
                      achievement => achievement.name === ach.name
                    ) || {
                      Achieved: false,
                      CurProgress: 0,
                      MaxProgress: 0,
                      UnlockTime: 0,
                    };

                    if (
                      !previous.Achieved &&
                      achievements[i].Achieved &&
                      !previous.Notified
                    ) {
                      if (!achievements[i].UnlockTime || achievements[i].UnlockTime == 0)
                        achievements[i].UnlockTime = moment().unix();
                      console.log("Unlocked:" + ach.displayName);
                      console.log("Sending notification with payload:", {
                        title: "Achievement Unlocked!",
                        message: ach.displayName,
                        icon: ach.icon || "",
                        appid: game.appid,
                        game: game.name,
                        achievement: ach.name,
                        description: ach.description || "",
                        unlockTime: achievements[i].UnlockTime,
                      });
                      try {
                        await sendNotification({
                          title: "Achievement Unlocked!",
                          message: ach.displayName,
                          icon: ach.icon || "",
                          appid: game.appid,
                          game: game.name,
                          achievement: ach.name,
                          description: ach.description || "",
                          unlockTime: achievements[i].UnlockTime,
                        });
                        console.log("Notification sent successfully.");
                        achievements[i].Notified = true;
                        // Also update 'Notified' in cache for this achievement
                        const cacheIdx = cache.findIndex(a => a.name === ach.name);
                        if (cacheIdx !== -1) {
                          cache[cacheIdx].Notified = true;
                          cache[cacheIdx].Achieved = true;
                          cache[cacheIdx].UnlockTime = achievements[i].UnlockTime;
                        } else {
                          cache.push({
                            name: ach.name,
                            Notified: true,
                            Achieved: true,
                            UnlockTime: achievements[i].UnlockTime,
                          });
                        }
                        await track.save(appID, cache);
                      } catch (err) {
                        console.error("Failed to send notification:", err);
                      }
                    } else if (previous.Achieved && achievements[i].Achieved) {
                      console.log("Already unlocked:" + ach.displayName);
                      if (
                        previous.UnlockTime > 0 &&
                        previous.UnlockTime != achievements[i].UnlockTime
                      )
                        achievements[i].UnlockTime = previous.UnlockTime;
                    }
                  } catch (err) {
                    if (err === "ACH_NOT_FOUND_IN_SCHEMA") {
                      console.warn(
                        `${achievements[i].crc ? `${achievements[i].crc} (CRC32)` : `${achievements[i].name}`} not found in game schema data ?! ... Achievement was probably deleted or renamed over time > SKIPPING`
                      );
                    } else {
                      console.error(
                        `Unexpected Error for achievement "${achievements[i].name}": ${err}`
                      );
                    }
                  }
                }
              }
              // Save both the updated achievements and cache for persistence
              await track.save(appID, cache);
            }
          } else {
            console.warn(`game's process "${game.binary}" not running`);
          }
        } catch (err) {
          console.warn(err);
        }
      }
    );
  },
  load: async function (appID) {
    try {
      let self = this;

      console.log(`loading steam schema for ${appID}`);

      let search = self.cache.find(game => game.appid == appID);
      let game;
      if (search) {
        game = search;
        console.log("from memory cache");
      } else {
        const lang = await getSteamApiLang();
        game = await steam.loadSteamData(appID, lang, STEAM_WEB_API_KEY);
        self.cache.push(game);
        console.log("from file cache or remote");
      }
      return game;
    } catch (err) {
      throw err;
    }
  },
};

console.log("About to acquire single-instance lock (block 1)...");
instance.lock().then(() => {
  console.log("Single-instance lock acquired (block 1). Starting app...");
  app.start().catch(err => {
    console.error("app.start() failed (block 1):", err);
  });
});

console.log("About to acquire single-instance lock (block 2)...");
instance
  .lock()
  .then(() => {
    console.log("Single-instance lock acquired (block 2). Starting app...");
  })
  .catch(err => {
    console.error(err);
    process.exit();
  });
