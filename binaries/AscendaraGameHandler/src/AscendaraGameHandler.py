import json
import os
import subprocess
import sys
import time
import psutil
import logging

def is_process_running(exe_name):
    for proc in psutil.process_iter(['name']):
        try:
            if proc.info['name'] == exe_name:
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

def execute(game_path, is_custom_game):
    if not is_custom_game:
        game_dir, exe_name = os.path.split(game_path)
        json_file_path = os.path.join(game_dir, f"{os.path.basename(game_dir)}.ascendara.json")
    else:
        exe_name = os.path.basename(game_path)
        user_data_dir = os.path.join(os.environ['APPDATA'], 'ascendara')
        settings_file = os.path.join(user_data_dir, 'ascendarasettings.json')
        with open(settings_file, 'r') as f:
            settings = json.load(f)
        download_dir = settings.get('downloadDirectory')
        if not download_dir:
            logging.error('Download directory not found in ascendarasettings.json')
            return
        games_file = os.path.join(download_dir, 'games.json')
        with open(games_file, 'r') as f:
            games_data = json.load(f)
        game_entry = next((game for game in games_data['games'] if game['executable'] == game_path), None)
        if game_entry is None:
            logging.error(f"Game not found in games.json for executable path: {game_path}")
            return

    logging.info(f"game_dir: {os.path.dirname(game_path)}, exe_path: {game_path}")

    if not os.path.isfile(game_path):
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

    # Start the process detached from the script
    process = subprocess.Popen(game_path, creationflags=subprocess.CREATE_NEW_CONSOLE, close_fds=True)
    running = True
    while running:
        if os.path.isfile(game_path):
            if not is_custom_game:
                with open(json_file_path, "r") as f:
                    data = json.load(f)
                data["isRunning"] = is_process_running(exe_name)
                with open(json_file_path, "w") as f:
                    json.dump(data, f, indent=4)
            else:
                pass

        if process.poll() is not None:
            running = False
            if not is_custom_game:
                data["isRunning"] = False
                with open(json_file_path, "w") as f:
                    json.dump(data, f, indent=4)
        time.sleep(5)

if __name__ == "__main__":
    _, game_path, is_custom_game_str = sys.argv

    log_file = os.path.join(os.path.dirname(__file__), 'gamehandler.log')
    logging.basicConfig(filename=log_file, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    is_custom_game = is_custom_game_str.lower() == 'true'
    execute(game_path, is_custom_game)