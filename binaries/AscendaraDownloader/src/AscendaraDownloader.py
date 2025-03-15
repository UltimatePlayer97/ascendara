# ==============================================================================
# Ascendara Downloader
# ==============================================================================
# High-performance multi-threaded downloader for Ascendara.
# Handles game downloads, and extracting processes with support for
# resume and verification. Read more about the Download Manager Tool here:
# https://ascendara.app/docs/binary-tool/downloader










import os
import json
import ssl
import shutil
import string
import sys
import atexit
import time
import threading
from queue import Queue
from concurrent.futures import ThreadPoolExecutor
from tempfile import NamedTemporaryFile, TemporaryDirectory
import requests
import patoolib
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
import argparse
import logging
import subprocess

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [crash_reporter_path, "maindownloader", str(error_code), error_message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    # Only register once
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

def _launch_notification(theme, title, message):
    try:
        # Get the directory where the current executable is located
        exe_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        notification_helper_path = os.path.join(exe_dir, 'AscendaraNotificationHelper.exe')
        logging.debug(f"Looking for notification helper at: {notification_helper_path}")
        
        if os.path.exists(notification_helper_path):
            logging.debug(f"Launching notification helper with theme={theme}, title='{title}', message='{message}'")
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [notification_helper_path, "--theme", theme, "--title", title, "--message", message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            logging.debug("Notification helper process started successfully")
        else:
            logging.error(f"Notification helper not found at: {notification_helper_path}")
    except Exception as e:
        logging.error(f"Failed to launch notification helper: {e}")

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

def retryfolder(game, online, dlc, version, size, download_dir, newfolder):
    game_info_path = os.path.join(download_dir, f"{game}.ascendara.json")
    newfolder = sanitize_folder_name(newfolder)

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "size": size,
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
    safe_write_json(game_info_path, game_info)

    extracted_folder = os.path.join(download_dir, newfolder)
    tempdownloading = os.path.join(download_dir, f"temp-{os.urandom(6).hex()}")

    if os.path.exists(extracted_folder):
        shutil.copytree(extracted_folder, tempdownloading)
        shutil.rmtree(extracted_folder)
        shutil.copytree(tempdownloading, os.path.join(download_dir), dirs_exist_ok=True)

    for file in os.listdir(os.path.join(download_dir)):
        if file.endswith(".url"):
            os.remove(os.path.join(download_dir, file))

    game_info["downloadingData"]["extracting"] = False
    del game_info["downloadingData"]
    shutil.rmtree(tempdownloading, ignore_errors=True)
    safe_write_json(game_info_path, game_info)

def safe_write_json(filepath, data):
    temp_dir = os.path.dirname(filepath)
    temp_file_path = None
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
        if temp_file_path and os.path.exists(temp_file_path):
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
    safe_write_json(game_info_path, game_info)

class SSLContextAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        context.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = context 
        return super().init_poolmanager(*args, **kwargs)

class DownloadChunk:
    def __init__(self, start, end, url, chunk_id, temp_dir):
        self.start = start
        self.end = end
        self.url = url
        self.chunk_id = chunk_id
        self.temp_file_path = os.path.join(temp_dir, f"chunk_{chunk_id}.tmp")
        self.downloaded = 0

class DownloadManager:
    def __init__(self, url, total_size, num_threads=None, max_chunk_size=100*1024*1024):  
        self.url = url
        self.total_size = total_size
        self.max_chunk_size = max_chunk_size
        
        # Read thread count from settings
        try:
            settings_path = os.path.join(os.getenv('APPDATA'), 'ascendara', 'ascendarasettings.json')
            if os.path.exists(settings_path):
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
                    self.num_threads = settings.get('threadCount', 4)
            else:
                self.num_threads = 4
        except Exception:
            self.num_threads = 4
            
        self.chunks = []
        self.downloaded_size = 0
        self.lock = threading.Lock()
        self.max_retries = 3  # Maximum number of retries per chunk
        
    def split_chunks(self, temp_dir):
        # Calculate optimal chunk size based on total size and thread count
        # but don't exceed max_chunk_size to prevent excessive memory usage
        optimal_chunk_size = min(self.total_size // self.num_threads, self.max_chunk_size)
        num_chunks = (self.total_size + optimal_chunk_size - 1) // optimal_chunk_size
        
        for i in range(int(num_chunks)):
            start = i * optimal_chunk_size
            end = min(start + optimal_chunk_size - 1, self.total_size - 1)
            self.chunks.append(DownloadChunk(start, end, self.url, i, temp_dir))
            
    def download_chunk(self, chunk, session, callback=None):
        headers = {
            'Range': f'bytes={chunk.start}-{chunk.end}',
            'Connection': 'keep-alive',
            'Keep-Alive': '300'
        }
        
        retries = 0
        while retries < self.max_retries:
            try:
                response = session.get(chunk.url, headers=headers, stream=True, timeout=(30, 300))
                response.raise_for_status()
                
                # Verify we got the expected content length
                expected_size = chunk.end - chunk.start + 1
                content_length = int(response.headers.get('content-length', 0))
                if content_length and content_length != expected_size:
                    raise ValueError(f"Received content length {content_length} does not match expected size {expected_size}")
                
                with open(chunk.temp_file_path, "wb") as f:
                    for data in response.iter_content(chunk_size=1024*1024):
                        if not data:
                            break
                        f.write(data)
                        chunk.downloaded += len(data)
                        with self.lock:
                            self.downloaded_size += len(data)
                            if callback:
                                callback(len(data))
                
                # Verify the downloaded size matches expected size
                if os.path.getsize(chunk.temp_file_path) != expected_size:
                    raise ValueError(f"Downloaded size {os.path.getsize(chunk.temp_file_path)} does not match expected size {expected_size}")
                
                return  # Success, exit the retry loop
                
            except (requests.exceptions.RequestException, ValueError) as e:
                retries += 1
                if retries >= self.max_retries:
                    raise Exception(f"Failed to download chunk after {self.max_retries} retries: {str(e)}")
                
                # Reset chunk data and downloaded count before retry
                chunk.downloaded = 0
                with self.lock:
                    self.downloaded_size -= chunk.downloaded
                chunk.downloaded = 0
                
                # Wait before retrying with exponential backoff
                time.sleep(2 ** retries)

def download_file(link, game, online, dlc, isVr, version, size, download_dir, withNotification=None):
    # First ensure the base download directory exists
    os.makedirs(download_dir, exist_ok=True)
    
    # Sanitize the game name for folder creation
    sanitized_game = sanitize_folder_name(game)
    
    download_path = os.path.join(download_dir, sanitized_game)
    os.makedirs(download_path, exist_ok=True)
    
    game_info_path = os.path.join(download_path, f"{sanitized_game}.ascendara.json")

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "isVr": isVr,
        "version": version if version else "",
        "size": size,
        "executable": os.path.join(download_path, f"{sanitized_game}.exe"),
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
    if withNotification:
        _launch_notification(withNotification, "Download Started", f"Starting download for {game}")

    def download_with_requests():
        session = requests.Session()
        session.mount('https://', SSLContextAdapter())
        
        # Configure the session for better reliability
        adapter = requests.adapters.HTTPAdapter(
            max_retries=3,
            pool_connections=10,
            pool_maxsize=10
        )
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        
        try:
            # Get file info first
            response = session.head(link, timeout=(30, 60))
            response.raise_for_status()
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("content_type_error")

            total_size = int(response.headers.get('content-length', 0) or 0)
            
            # If HEAD request didn't give us the size, try a GET request
            if total_size == 0:
                response = session.get(link, stream=True, timeout=(30, 60))
                response.raise_for_status()
                total_size = int(response.headers.get('content-length', 0) or 0)

            # Determine file extension
            archive_ext = "rar"
            content_disposition = response.headers.get('Content-Disposition')
            if content_disposition and 'filename=' in content_disposition:
                filename = content_disposition.split('filename=')[-1].strip('"\'')
                if '.' in filename:
                    archive_ext = filename.split('.')[-1].lower()
            elif '.' in link:
                possible_ext = link.split('?')[0].split('.')[-1].lower()
                if possible_ext in ['rar', 'zip']:
                    archive_ext = possible_ext

            archive_file_path = os.path.join(download_path, f"{sanitized_game}.{archive_ext}")
            
            # Initialize download manager and start time
            game_info["downloadingData"]["downloading"] = True
            start_time = time.time()
            safe_write_json(game_info_path, game_info)
            
            if total_size > 0:
                # Use the optimized chunk-based download approach for known file sizes
                with TemporaryDirectory() as temp_dir:
                    manager = DownloadManager(link, total_size)
                    manager.split_chunks(temp_dir)

                    def update_progress(bytes_downloaded):
                        nonlocal start_time
                        progress = manager.downloaded_size / total_size
                        game_info["downloadingData"]["progressCompleted"] = f"{progress * 100:.2f}"

                        elapsed_time = time.time() - start_time
                        download_speed = manager.downloaded_size / elapsed_time if elapsed_time > 0 else 0

                        if download_speed < 1024:
                            game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                        elif download_speed < 1024 * 1024:
                            game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                        else:
                            game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                        remaining_size = total_size - manager.downloaded_size
                        if download_speed > 0 and remaining_size > 0:
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

                    with ThreadPoolExecutor(max_workers=manager.num_threads) as executor:
                        futures = []
                        for chunk in manager.chunks:
                            future = executor.submit(manager.download_chunk, chunk, session, update_progress)
                            futures.append(future)
                        
                        # Wait for all downloads to complete
                        for future in futures:
                            future.result()

                    # Write the complete file
                    with open(archive_file_path, "wb") as f:
                        for chunk in manager.chunks:
                            with open(chunk.temp_file_path, "rb") as chunk_file:
                                shutil.copyfileobj(chunk_file, f, 1024 * 1024)  # Use 1MB buffer
            else:
                # For unknown size, use streaming approach with direct write to file
                downloaded_size = 0
                with open(archive_file_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
                        if chunk:
                            f.write(chunk)
                            downloaded_size += len(chunk)
                            
                            # Update progress
                            game_info["downloadingData"]["progressCompleted"] = f"{downloaded_size / (1024*1024):.1f}MB"
                            
                            elapsed_time = time.time() - start_time
                            download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0
                            
                            if download_speed < 1024:
                                game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                            elif download_speed < 1024 * 1024:
                                game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                            else:
                                game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"
                            
                            game_info["downloadingData"]["timeUntilComplete"] = "Unknown (size not available)"
                            safe_write_json(game_info_path, game_info)
                
            return archive_file_path, archive_ext

        except Exception as e:
            handleerror(game_info, game_info_path, e)
            raise e
        finally:
            session.close()

    safe_write_json(game_info_path, game_info)

    try:
        archive_file_path, archive_ext = download_with_requests()

        try:
            # Create watching file for tracking extracted files
            watching_path = os.path.join(download_path, "filemap.ascendara.json")
            watching_data = {}
            game_info["downloadingData"]["downloading"] = False
            game_info["downloadingData"]["extracting"] = True
            safe_write_json(game_info_path, game_info)

            if sys.platform == "win32":
                from unrar import rarfile
                if archive_ext == "rar":
                    with rarfile.RarFile(archive_file_path, 'r') as fs:
                        # Get file list before extraction but don't load content into memory
                        for rar_info in fs.infolist():
                            if not rar_info.filename.endswith('.url') and '_CommonRedist' not in rar_info.filename:  # Skip .url files and _CommonRedist
                                extracted_path = os.path.join(download_path, rar_info.filename)
                                key = f"{os.path.relpath(extracted_path, download_path)}"
                                watching_data[key] = {"size": rar_info.file_size}
                        
                        # Extract files one by one to avoid loading all into memory
                        for rar_info in fs.infolist():
                            if not rar_info.filename.endswith('.url'):  # Skip .url files
                                fs.extract(rar_info, download_path)
                elif archive_ext == "zip":
                    import zipfile
                    with zipfile.ZipFile(archive_file_path, 'r') as zip_ref:
                        # Get file list before extraction but don't load content into memory
                        for zip_info in zip_ref.infolist():
                            if not zip_info.filename.endswith('.url') and '_CommonRedist' not in zip_info.filename:  # Skip .url files and _CommonRedist
                                extracted_path = os.path.join(download_path, zip_info.filename)
                                key = f"{os.path.relpath(extracted_path, download_path)}"
                                watching_data[key] = {"size": zip_info.file_size}
                        
                        # Extract files one by one to avoid loading all into memory
                        for zip_info in zip_ref.infolist():
                            if not zip_info.filename.endswith('.url'):  # Skip .url files
                                zip_ref.extract(zip_info, download_path)
            elif sys.platform == "darwin":
                # For non-Windows, use patoolib and get file info after extraction
                before_files = set()
                for dirpath, _, filenames in os.walk(download_path):
                    for fname in filenames:
                        if not fname.endswith('.url'):  # Skip .url files
                            before_files.add(os.path.join(dirpath, fname))
                
                # Use patoolib with outdir parameter to control extraction location
                patoolib.extract_archive(archive_file_path, outdir=download_path)
                
                # Find new files by comparing directory contents
                for dirpath, _, filenames in os.walk(download_path):
                    for fname in filenames:
                        if not fname.endswith('.url') and '_CommonRedist' not in os.path.join(dirpath, fname):  # Skip .url files and _CommonRedist
                            full_path = os.path.join(dirpath, fname)
                            if full_path not in before_files:
                                key = f"{os.path.relpath(full_path, download_path)}"
                                watching_data[key] = {"size": os.path.getsize(full_path)}

            # Save watching data
            safe_write_json(watching_path, watching_data)

            # Set extracting to false and start verification
            game_info["downloadingData"]["extracting"] = False
            game_info["downloadingData"]["verifying"] = True
            safe_write_json(game_info_path, game_info)

            # Verify the extracted files
            _verify_extracted_files(watching_path, download_path, game_info, game_info_path, game, archive_file_path)

            del game_info["downloadingData"]
            safe_write_json(game_info_path, game_info)

            if withNotification:
                _launch_notification(withNotification, "Download Complete", f"Successfully downloaded and extracted {game}")

        except Exception as e:
            handleerror(game_info, game_info_path, e)
            raise e

    except Exception as e:
        print(f"Failed to download or extract {game}. Error: {e}")

def _verify_extracted_files(watching_path, download_path, game_info, game_info_path, game, archive_file_path):
    try:
        with open(watching_path, 'r') as f:
            watching_data = json.load(f)

        # Find and delete _CommonRedist directories
        for root, dirs, files in os.walk(download_path):
            if "_CommonRedist" in dirs:
                common_redist_path = os.path.join(root, "_CommonRedist")
                print(f"Found _CommonRedist directory at {common_redist_path}, deleting...")
                try:
                    shutil.rmtree(common_redist_path)
                    print(f"Successfully deleted {common_redist_path}")
                except Exception as e:
                    print(f"Error deleting _CommonRedist directory: {str(e)}")

        # Filter out _CommonRedist entries from watching_data
        filtered_watching_data = {
            file_path: file_info 
            for file_path, file_info in watching_data.items() 
            if "_CommonRedist" not in file_path
        }
        
        # Process verification in batches to avoid excessive memory usage
        verify_errors = []
        batch_size = 100  # Process 100 files at a time
        file_paths = list(filtered_watching_data.keys())
        
        for i in range(0, len(file_paths), batch_size):
            batch = file_paths[i:i+batch_size]
            for file_path in batch:
                file_info = filtered_watching_data[file_path]
                full_path = os.path.join(download_path, file_path)
                
                # Skip verification for directories
                if os.path.isdir(full_path):
                    continue
                    
                if not os.path.exists(full_path):
                    verify_errors.append({
                        "file": file_path,
                        "error": "File not found",
                        "expected_size": file_info["size"]
                    })
                    continue

        if verify_errors:
            print(f"Found {len(verify_errors)} verification errors")
            game_info["downloadingData"]["verifyError"] = verify_errors
            error_count = len(verify_errors)
            _launch_notification(
                "dark",  # Use dark theme by default
                "Verification Failed",
                f"{error_count} {'file' if error_count == 1 else 'files'} failed to verify"
            )
        else:
            print("All extracted files verified successfully")
            try:
                os.remove(archive_file_path)
            except Exception as e:
                print(f"Error removing original archive: {str(e)}")
            if "verifyError" in game_info["downloadingData"]:
                del game_info["downloadingData"]["verifyError"]

    except Exception as e:
        print(f"Error during verification: {str(e)}")
        game_info["downloadingData"]["verifyError"] = [{
            "file": "verification_process",
            "error": str(e)
        }]
        _launch_notification(
            "dark",  # Use dark theme by default
            "Verification Error",
            f"Error during verification: {str(e)}"
        )

    # Set verifying to false when done
    game_info["downloadingData"]["verifying"] = False
    safe_write_json(game_info_path, game_info)

def parse_boolean(value):
    """Helper function to parse boolean values from command-line arguments."""
    if value.lower() in ['true', '1', 'yes']:
        return True
    elif value.lower() in ['false', '0', 'no']:
        return False
    else:
        raise argparse.ArgumentTypeError(f"Invalid boolean value: {value}")

def main():
    parser = argparse.ArgumentParser(description="Download and manage game files.")
    parser.add_argument("link", help="URL of the file to download")
    parser.add_argument("game", help="Name of the game")
    parser.add_argument("online", type=parse_boolean, help="Is the game online (true/false)?")
    parser.add_argument("dlc", type=parse_boolean, help="Is DLC included (true/false)?")
    parser.add_argument("isVr", type=parse_boolean, help="Is the game a VR game (true/false)?")
    parser.add_argument("version", help="Version of the game")
    parser.add_argument("size", help="Size of the file (ex: 12 GB, 439 MB)")
    parser.add_argument("download_dir", help="Directory to save the downloaded files")
    parser.add_argument("--withNotification", help="Theme name for notifications (e.g. light, dark, blue)", default=None)

    try:
        if len(sys.argv) == 1:  # No arguments provided
            launch_crash_reporter(1, "No arguments provided. Please provide all required arguments.")
            parser.print_help()
            sys.exit(1)
            
        args = parser.parse_args()
        download_file(args.link, args.game, args.online, args.dlc, args.isVr, args.version, args.size, args.download_dir, args.withNotification)
    except (argparse.ArgumentError, SystemExit) as e:
        error_msg = "Invalid or missing arguments. Please provide all required arguments."
        launch_crash_reporter(1, error_msg)
        parser.print_help()
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        launch_crash_reporter(1, str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()