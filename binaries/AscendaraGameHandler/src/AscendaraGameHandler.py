# ==============================================================================
# Ascendara Game Handler
# ==============================================================================
# Game process manager for the Ascendara Game Launcher. Handles game execution,
# process monitoring, and Discord Rich Presence integration.
# Read more about the Game Handler here:
# https://ascendara.app/docs/developer/game-handler










import os
import sys
import time
import json
import logging
import atexit
import subprocess
from pypresence import Presence
import argparse
import psutil
import asyncio
from datetime import datetime

CLIENT_ID = '1277379302945718356'

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [crash_reporter_path, "gamehandler", str(error_code), error_message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    """Register the crash reporter to launch on exit with the given error details"""
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

def setup_discord_rpc():
    try:
        rpc = Presence(CLIENT_ID)
        rpc.connect()
        return rpc
    except Exception as e:
        logging.error(f"Failed to connect to Discord RPC: {e}")
        return None

def update_discord_presence(rpc, game_name):
    if rpc:
        try:
            rpc.update(
                details="Playing a Game",
                state=game_name,
                start=int(time.time()),
                large_image="ascendara",
                large_text="Ascendara",
                buttons=[{"label": "Play on Ascendara", "url": "https://ascendara.app/"}]
            )
        except Exception as e:
            logging.error(f"Failed to update Discord presence: {e}")

def clear_discord_presence(rpc):
    if rpc:
        try:
            rpc.clear()
            rpc.close()
        except Exception as e:
            logging.error(f"Failed to clear Discord presence: {e}")

def is_process_running(exe_path):
    for proc in psutil.process_iter(['name']):
        try:
            if proc.info['name'] == os.path.basename(exe_path):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

def update_play_time(file_path, is_custom_game, game_entry=None):
    """Update the playTime field in either the game's JSON file or games.json for custom games"""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
        
        if is_custom_game:
            # For custom games, update the specific game entry in games.json
            for game in data["games"]:
                if game["executable"] == game_entry["executable"]:
                    if "playTime" not in game:
                        game["playTime"] = 0
                    game["playTime"] += 1
                    break
        else:
            # For regular games, update the game-specific json
            if "playTime" not in data:
                data["playTime"] = 0
            data["playTime"] += 1
        
        with open(file_path, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        logging.error(f"Failed to update play time: {e}")

def get_ludusavi_settings():
    try:
        settings_path = os.path.join(os.getenv('APPDATA'), 'ascendara', 'ascendarasettings.json')
        if os.path.exists(settings_path):
            with open(settings_path, 'r') as f:
                settings = json.load(f)
                ludusavi_settings = settings.get('ludusavi')
                # Explicitly check if enabled is True, return None otherwise
                if ludusavi_settings and ludusavi_settings.get('enabled') is True:
                    return ludusavi_settings
        return None
    except Exception as e:
        logging.error(f"Failed to load Ludusavi settings: {e}")
        return None

def run_ludusavi_backup(game_name):
    """
    Run Ludusavi backup for a specific game
    """
    ludusavi_settings = get_ludusavi_settings()
    if not ludusavi_settings:
        logging.info("Ludusavi backup skipped: not enabled in settings")
        return False
    
    try:
        # Check if Ludusavi is installed and available
        ludusavi_path = os.path.join("./ludusavi.exe")
        if not os.path.exists(ludusavi_path):
            logging.error(f"Ludusavi executable not found at: {ludusavi_path}")
            return False
            
        # Prepare backup command with settings from configuration
        backup_location = ludusavi_settings.get('backupLocation')
        backup_format = ludusavi_settings.get('backupFormat', 'zip')
        backups_to_keep = ludusavi_settings.get('backupOptions', {}).get('backupsToKeep', 5)
        
        # Map 'default' compression to 'deflate' which is a good balance
        compression_level = ludusavi_settings.get('backupOptions', {}).get('compressionLevel', 'default')
        if compression_level == 'default':
            compression_level = 'deflate'  # Valid values: none, deflate, bzip2, zstd
        
        # Build the command with correct syntax
        cmd = [
            ludusavi_path,
            "backup",
            "--path", backup_location,
            "--format", backup_format,
            "--full-limit", str(backups_to_keep),
            "--compression", compression_level,
            "--force",  # Always skip confirmations
            game_name  # Game name as positional argument
        ]

        # Run the backup process
        logging.info(f"Running Ludusavi backup for {game_name} with command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            logging.info(f"Ludusavi backup completed successfully for {game_name}")
            return True
        else:
            logging.error(f"Ludusavi backup failed: {result.stderr}")
            return False
            
    except Exception as e:
        logging.error(f"Error running Ludusavi backup: {e}")
        return False

def execute(game_path, is_custom_game, is_shortcut=False, use_ludusavi=False):
    rpc = None
    if is_shortcut:
        rpc = setup_discord_rpc()

    json_file_path = None
    games_json_path = None
    game_entry = None
    game_name = None
    settings_file = os.path.join(os.environ['APPDATA'], 'ascendara', 'ascendarasettings.json')

    if not is_custom_game:
        game_dir, exe_name = os.path.split(game_path)
        exe_path = os.path.join(game_dir, exe_name)
        
        # First, try to find the game's root directory by looking for the .ascendara.json file
        # Start from the executable's directory and move up until we find it
        current_dir = game_dir
        found_json = False
        
        while current_dir and os.path.dirname(current_dir) != current_dir:
            dir_name = os.path.basename(current_dir)
            potential_json = os.path.join(current_dir, f"{dir_name}.ascendara.json")
            
            if os.path.exists(potential_json):
                json_file_path = potential_json
                game_name = dir_name
                found_json = True
                break
                
            # Also check for a JSON file with the same name as the parent directory
            parent_dir = os.path.dirname(current_dir)
            parent_name = os.path.basename(parent_dir)
            potential_parent_json = os.path.join(parent_dir, f"{parent_name}.ascendara.json")
            
            if os.path.exists(potential_parent_json):
                json_file_path = potential_parent_json
                game_name = parent_name
                found_json = True
                break
                
            # Move up one directory
            current_dir = parent_dir
            
        # If we couldn't find the JSON file, fall back to the original behavior
        if not found_json:
            game_name = os.path.basename(game_dir)
            json_file_path = os.path.join(game_dir, f"{game_name}.ascendara.json")
            
            if not os.path.exists(json_file_path):
                parent_dir = os.path.dirname(game_dir)
                parent_name = os.path.basename(parent_dir)
                json_file_path = os.path.join(parent_dir, f"{parent_name}.ascendara.json")
    else:
        exe_path = game_path
        user_data_dir = os.path.join(os.environ['APPDATA'], 'ascendara')
        settings_file = os.path.join(user_data_dir, 'ascendarasettings.json')
        with open(settings_file, 'r') as f:
            settings = json.load(f)
        download_dir = settings.get('downloadDirectory')
        if not download_dir:
            logging.error('Download directory not found in ascendarasettings.json')
            return
        games_json_path = os.path.join(download_dir, 'games.json')
        with open(games_json_path, 'r') as f:
            games_data = json.load(f)
        game_entry = next((game for game in games_data['games'] if game['executable'] == exe_path), None)
        if game_entry is None:
            logging.error(f"Game not found in games.json for executable path: {exe_path}")
            return
        game_name = game_entry.get("name", os.path.basename(os.path.dirname(exe_path)))
    
    logging.info(f"game_dir: {os.path.dirname(exe_path)}, exe_path: {exe_path}")

    if not os.path.isfile(exe_path):
        error = "The exe file does not exist"
        if not is_custom_game:
            with open(json_file_path, "r") as f:
                data = json.load(f)
            data["runError"] = error
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)
        else:
            logging.error(error)
        return

    def update_launch_count(file_path, increment=True):
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
            if "launchCount" not in data:
                data["launchCount"] = 0
            data["launchCount"] += 1 if increment else -1
            data["launchCount"] = max(0, data["launchCount"])
            with open(file_path, "w") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            logging.error(f"Error updating launch count: {e}")

    if not is_custom_game:
        update_launch_count(json_file_path)
        with open(json_file_path, "r") as f:
            game_data = json.load(f)
        game_data["isRunning"] = True
        with open(json_file_path, "w") as f:
            json.dump(game_data, f, indent=4)
    else:
        with open(games_json_path, "r") as f:
            games_data = json.load(f)
        for game in games_data["games"]:
            if game["executable"] == exe_path:
                if "launchCount" not in game:
                    game["launchCount"] = 0
                game["launchCount"] += 1
                game["isRunning"] = True
                break
        with open(games_json_path, "w") as f:
            json.dump(games_data, f, indent=4)

    try:
        with open(settings_file, "r") as f:
            settings_data = json.load(f)
        if "runningGames" not in settings_data:
            settings_data["runningGames"] = {}
        settings_data["runningGames"][game_name] = exe_path
        with open(settings_file, "w") as f:
            json.dump(settings_data, f, indent=4)
    except Exception as e:
        logging.error(f"Error updating settings.json: {e}")

    try:
        # Regular game execution (no wrapping)
        if os.path.dirname(exe_path):
            os.chdir(os.path.dirname(exe_path))
        
        process = subprocess.Popen(exe_path)
        start_time = time.time()
        last_update = start_time
        last_play_time = 0

        while process.poll() is None:
            current_time = time.time()
            elapsed = int(current_time - last_update)
            if elapsed >= 1:
                last_play_time = elapsed
                if is_custom_game and games_json_path:
                    update_play_time(games_json_path, True, game_entry)
                elif json_file_path:
                    update_play_time(json_file_path, False)
                last_update = current_time
            time.sleep(0.1)

        process.wait()
        return_code = process.returncode

        try:
            with open(settings_file, 'r') as f:
                settings_data = json.load(f)
            if 'runningGames' in settings_data:
                if game_name in settings_data['runningGames']:
                    del settings_data['runningGames'][game_name]
            with open(settings_file, 'w') as f:
                json.dump(settings_data, f, indent=4)
        except Exception as e:
            logging.error(f"Error updating settings.json on exit: {e}")

        # Run Ludusavi backup after game closes if enabled
        if use_ludusavi and game_name:
            logging.info(f"Game closed, running Ludusavi backup for {game_name}")
            run_ludusavi_backup(game_name)

        if is_custom_game and games_json_path:
            with open(games_json_path, "r") as f:
                data = json.load(f)
            for game in data["games"]:
                if game["executable"] == exe_path:
                    if last_play_time < 1 and "playTime" in game:
                        game["playTime"] = max(0, game["playTime"] - 1)
                    game["isRunning"] = False
                    break
            with open(games_json_path, "w") as f:
                json.dump(data, f, indent=4)
        elif json_file_path:
            with open(json_file_path, "r") as f:
                data = json.load(f)
            if last_play_time < 1:
                data["playTime"] = max(0, data["playTime"] - 1)
            data["isRunning"] = False
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)

        if is_shortcut and rpc:
            clear_discord_presence(rpc)

    except Exception as e:
        if is_custom_game and games_json_path:
            update_launch_count(games_json_path, False)
            with open(games_json_path, "r") as f:
                data = json.load(f)
            for game in data["games"]:
                if game["executable"] == exe_path:
                    game["isRunning"] = False
                    break
            with open(games_json_path, "w") as f:
                json.dump(data, f, indent=4)
        elif json_file_path:
            update_launch_count(json_file_path, False)
            with open(json_file_path, "r") as f:
                data = json.load(f)
            data["isRunning"] = False
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)
        
        logging.error(f"Failed to execute game: {e}")
        atexit.register(launch_crash_reporter, 1, str(e))

if __name__ == "__main__":
    # The script is called with: [script] [game_path] [is_custom_game] [--shortcut] [--ludusavi]
    # Skip the first argument (script name)
    args = sys.argv[1:]
    
    if len(args) < 2:
        print("Error: Not enough arguments")
        print("Usage: AscendaraGameHandler.exe [game_path] [is_custom_game] [--shortcut] [--ludusavi]")
        sys.exit(1)
        
    game_path = args[0]
    is_custom_game = args[1] == '1' or args[1].lower() == 'true'
    is_shortcut = "--shortcut" in args
    use_ludusavi = "--ludusavi" in args

    # Configure logging
    log_file = os.path.join(os.path.dirname(__file__), 'gamehandler.log')
    logging.basicConfig(filename=log_file, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    try:
        execute(game_path, is_custom_game, is_shortcut, use_ludusavi)
    except Exception as e:
        logging.error(f"Failed to execute game: {e}")
        atexit.register(launch_crash_reporter, 1, str(e))
