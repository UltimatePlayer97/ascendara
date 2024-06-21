import os
import json
import urllib.error
import ssl
import shutil
import string
import sys
from unrar import rarfile
import time
from tempfile import NamedTemporaryFile
import requests
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def sanitize_folder_name(name):
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    sanitized_name = ''.join(c for c in name if c in valid_chars)
    return sanitized_name

def retryfolder(game, online, dlc, version, download_dir, newfolder):
    game_info_path = os.path.join(download_dir, f"{game}.ascendara.json")
    newfolder = sanitize_folder_name(newfolder)

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "executable": os.path.join(download_dir, f"{game}.exe"),
        "isRunning": False,
        "downloadingData": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressCompleted": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }
    game_info["downloadingData"]["extracting"] = True
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)

    extracted_folder = os.path.join(download_dir, newfolder)
    tempdownloading = os.path.join(download_dir, f"temp-{os.urandom(6).hex()}")
    shutil.copytree(extracted_folder, tempdownloading)
    shutil.rmtree(extracted_folder)
    shutil.copytree(tempdownloading, os.path.join(download_dir), dirs_exist_ok=True)
    for file in os.listdir(os.path.join(download_dir)):
        if file.endswith(".url"):
            os.remove(os.path.join(download_dir, file))
    game_info["downloadingData"]["extracting"] = False
    del game_info["downloadingData"]
    shutil.rmtree(tempdownloading, ignore_errors=True)
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)

def safe_write_json(filepath, data):
    temp_dir = os.path.dirname(filepath)
    try:
        with NamedTemporaryFile('w', delete=False, dir=temp_dir) as temp_file:
            json.dump(data, temp_file, indent=4)
        temp_file_path = temp_file.name
        retry_attempts = 3
        for attempt in range(retry_attempts):
            try:
                os.replace(temp_file_path, filepath)
                break
            except PermissionError as e:
                if attempt < retry_attempts - 1:
                    time.sleep(1)
                else:
                    raise e
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

def handleerror(game_info, game_info_path, e):
    game_info['online'] = ""
    game_info['dlc'] = ""
    game_info['isRunning'] = False
    game_info['version'] = ""
    game_info['executable'] = ""
    game_info['downloadingData'] = {
        "error": True,
        "message": str(e)
    }
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)

class SSLContextAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        context.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = context
        return super().init_poolmanager(*args, **kwargs)

def download_file(link, game, online, dlc, version, download_dir):
    game = sanitize_folder_name(game)
    download_path = os.path.join(download_dir, game)
    os.makedirs(download_path, exist_ok=True)
    
    game_info_path = os.path.join(download_path, f"{game}.ascendara.json")

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "executable": os.path.join(download_path, f"{game}.exe"),
        "isRunning": False,
        "downloadingData": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressCompleted": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }

    def download_with_requests():
        session = requests.Session()
        session.mount('https://', SSLContextAdapter())
        try:
            response = session.get(link, stream=True, timeout=(10, 30))
            response.raise_for_status()
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("Content-Type was text/html. Link most likely expired.")

            archive_ext = link.split('.')[-1]
            archive_file_path = os.path.join(download_path, f"{game}.{archive_ext}")
            total_size = int(response.headers.get('content-length', 0) or 0)
            block_size = 1024 * 1024
            downloaded_size = 0
            game_info["downloadingData"]["downloading"] = True
            start_time = time.time()

            safe_write_json(game_info_path, game_info)

            with open(archive_file_path, "wb") as file:
                for data in response.iter_content(block_size):
                    if not data:
                        break
                    file.write(data)
                    downloaded_size += len(data)
                    progress = downloaded_size / total_size if total_size > 0 else 0
                    game_info["downloadingData"]["progressCompleted"] = f"{progress * 100:.2f}"

                    elapsed_time = time.time() - start_time
                    download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                    if download_speed < 1024:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                    elif download_speed < 1024 * 1024:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                    else:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                    remaining_size = total_size - downloaded_size
                    if download_speed > 0:
                        time_until_complete = remaining_size / download_speed
                        minutes, seconds = divmod(time_until_complete, 60)
                        hours, minutes = divmod(minutes, 60)
                        if hours > 0:
                            game_info["downloadingData"]["timeUntilComplete"] = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
                        else:
                            game_info["downloadingData"]["timeUntilComplete"] = f"{int(minutes)}m {int(seconds)}s"
                    else:
                        game_info["downloadingData"]["timeUntilComplete"] = "Calculating..."

                    safe_write_json(game_info_path, game_info)

            game_info["downloadingData"]["downloading"] = False
            game_info["downloadingData"]["extracting"] = True
            safe_write_json(game_info_path, game_info)
            return archive_file_path, archive_ext
        except Exception as e:
            handleerror(game_info, game_info_path, e)
            raise e

    safe_write_json(game_info_path, game_info)

    try:
        archive_file_path, archive_ext = download_with_requests()

        try:
            if archive_ext == "rar":
                with rarfile.RarFile(archive_file_path, 'r') as fs:
                    files = fs.namelist()
                    fs.extractall(download_path, files)
            elif archive_ext == "zip":
                shutil.unpack_archive(archive_file_path, download_path, format="zip")
            os.remove(archive_file_path)
            game_info["downloadingData"]["extracting"] = False
            for file in os.listdir(download_path):
                if file.endswith(".url") or file.endswith(".txt"):
                    os.remove(os.path.join(download_path, file))
            extracted_folder = os.path.join(download_path, game)
            tempdownloading = os.path.join(download_path, f"temp-{os.urandom(6).hex()}")
            shutil.copytree(extracted_folder, tempdownloading)
            shutil.rmtree(extracted_folder)
            shutil.copytree(tempdownloading, os.path.join(download_dir, game), dirs_exist_ok=True)
            for file in os.listdir(os.path.join(download_dir, game)):
                if file.endswith(".url"):
                    os.remove(os.path.join(download_path, file))
            game_info["downloadingData"]["extracting"] = False
            del game_info["downloadingData"]
            shutil.rmtree(tempdownloading, ignore_errors=True)
            safe_write_json(game_info_path, game_info)
        except Exception as e:
            if "[WinError 183]" in str(e):
                handleerror(game_info, game_info_path, "Your antivirus software may be blocking the extraction process. Please whitelist the directories to extract automatically in the future.")
            handleerror(game_info, game_info_path, e)
    except Exception as e:
        handleerror(game_info, game_info_path, e)

if __name__ == "__main__":
    _, function, *args = sys.argv
    if function == "download":
        link, game, online, dlc, version, download_dir = args
        download_file(link, game, online.lower() == 'true', dlc.lower() == 'true', version, download_dir)
    elif function == "retryfolder":
        game, online, dlc, version, download_dir, newfolder = args
        retryfolder(game, online.lower() == 'true', dlc.lower() == 'true', version, download_dir, newfolder)
    else:
        print(f"Invalid function: {function}")
        sys.exit(1)