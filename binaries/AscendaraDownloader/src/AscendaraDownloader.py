# ==============================================================================
# Ascendara Downloader
# ==============================================================================
# High-performance multi-threaded downloader for Ascendara.
# Handles game downloads, and extracting processes with support for
# resume and verification. Read more about the Download Manager Tool here:
# https://ascendara.app/docs/binary-tool/downloader










import os
import sys
import json
import ssl
import shutil
import string
import atexit
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import random
import argparse
import logging
import subprocess
import requests

# Set up logging to print to the console
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager




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

def safe_write_json(filepath, data, max_retries=5):
    import msvcrt
    import random
    import logging
    
    def generate_temp_path(base_path):
        return f"{base_path}.{int(time.time()*1000)}.{random.randint(1000, 9999)}.tmp"
    
    def try_lock_file(f):
        try:
            msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except IOError:
            return False
    
    def release_lock(f):
        try:
            msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
        except IOError:
            pass

    base_dir = os.path.dirname(filepath)
    if not os.path.exists(base_dir):
        os.makedirs(base_dir, exist_ok=True)

    for attempt in range(max_retries):
        if attempt > 0:
            logging.warning(f"safe_write_json: retry {attempt} for {filepath}")
        temp_file_path = generate_temp_path(filepath)
        try:
            # Write to temp file first
            with open(temp_file_path, 'w') as temp_file:
                if try_lock_file(temp_file):
                    json.dump(data, temp_file, indent=4)
                    temp_file.flush()
                    os.fsync(temp_file.fileno())
                    release_lock(temp_file)
                else:
                    continue  # Couldn't get lock, try new temp file

            # Now try to replace the target file
            try:
                if os.path.exists(filepath):
                    # Try to open existing file to ensure we can access it
                    with open(filepath, 'r+') as existing:
                        if try_lock_file(existing):
                            release_lock(existing)
                        else:
                            time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                            continue
                    
                    # Use replace which is atomic on Windows
                    os.replace(temp_file_path, filepath)
                else:
                    # If file doesn't exist, simple rename is fine
                    os.rename(temp_file_path, filepath)
                
                return  # Success!
                
            except PermissionError:
                time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                continue
                
        except Exception as e:
            # If any other error occurs, try to clean up and continue
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except:
                pass
            
            if attempt == max_retries - 1:  # Last attempt
                raise Exception(f"Failed to write JSON after {max_retries} attempts: {str(e)}")
            
            time.sleep(0.1 * (attempt + 1))  # Exponential backoff
            continue
        
        finally:
            # Always try to clean up temp file
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except:
                pass

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
    def __init__(self, url, total_size, num_threads=None, max_chunk_size=64*1024*1024):
        self.url = url
        self.total_size = total_size
        self.max_chunk_size = max_chunk_size
        self.chunks = []
        self.downloaded_size = 0
        self.lock = threading.Lock()
        self.max_retries = 4
        self.per_thread_speeds = {}
        self.range_supported = True  # Assume true, will probe
        self.last_update_time = time.time()
        self.last_downloaded_size = 0
        self.current_speed = 0.0  # Track current speed for smoother updates
        self.download_speed_limit = 0  # KB/s, 0 means unlimited
        self.failed_chunks = []

        # Strictly use thread count, chunk size, and speed limit from settings
        # Load settings from AppData/Electron/ascendarasettings.json on Windows
        settings_path = None
        if sys.platform == 'win32':
            appdata = os.environ.get('APPDATA')
            if appdata:
                candidate = os.path.join(appdata, 'Electron', 'ascendarasettings.json')
                if os.path.exists(candidate):
                    settings_path = candidate
        # Fallback to current directory
        if not settings_path:
            candidate = os.path.join(os.path.dirname(sys.argv[0]), 'ascendarasettings.json')
            if os.path.exists(candidate):
                settings_path = candidate
        if settings_path:
            with open(settings_path, 'r', encoding='utf-8') as f:
                settings = json.load(f)
                self.num_threads = int(settings.get('threadCount', 8))
                self.max_chunk_size = 8 * 1024 * 1024  # 8MB default, since no setting exists
                self.download_speed_limit = int(settings.get('downloadLimit', 0))  # KB/s
        else:
            self.num_threads = 8
            self.max_chunk_size = 8 * 1024 * 1024
            self.download_speed_limit = 0

    def split_chunks(self, temp_dir):
        # Evenly split file into num_threads chunks
        file_size = self.total_size
        num_chunks = self.num_threads
        base_chunk_size = file_size // num_chunks
        remainder = file_size % num_chunks
        self.chunks = []
        offset = 0
        for i in range(num_chunks):
            # Distribute the remainder bytes among the first 'remainder' chunks
            chunk_size = base_chunk_size + (1 if i < remainder else 0)
            start = offset
            end = start + chunk_size - 1
            chunk = DownloadChunk(start, end, self.url, i, temp_dir)
            self.chunks.append(chunk)
            offset = end + 1

    def split_chunk_dynamic(self, chunk, temp_dir, min_chunk_size=2*1024*1024):
        # Aggressively split a chunk in half if it's larger than min_chunk_size
        chunk_len = chunk.end - chunk.start + 1
        if chunk_len <= min_chunk_size:
            return [chunk]  # Too small to split further
        mid = (chunk.start + chunk.end) // 2
        c1 = DownloadChunk(chunk.start, mid, chunk.url, chunk.chunk_id, temp_dir)
        c2 = DownloadChunk(mid + 1, chunk.end, chunk.url, chunk.chunk_id + 10000, temp_dir)
        return [c1, c2]
    
    def download_chunk(self, chunk, session, callback=None):
        headers = {
            'Range': f'bytes={chunk.start}-{chunk.end}',
            'Connection': 'keep-alive',
            'Keep-Alive': '300',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache'
        }
        
        retries = 0
        backoff_factor = 1.2  # More aggressive retry for slow chunks
        
        speed_limit = self.download_speed_limit * 1024  # Convert KB/s to bytes/s
        min_sleep = 0.01
        window_duration = 0.5  # seconds
        slow_chunk_threshold = 0.3  # If a chunk is <30% of average speed, retry sooner
        while retries < self.max_retries:
            try:
                # Use a session with keep-alive and optimized settings
                response = session.get(
                    chunk.url,
                    headers=headers,
                    stream=True,
                    timeout=(30, 300),
                    verify=True
                )
                response.raise_for_status()
                
                expected_size = chunk.end - chunk.start + 1
                content_length = int(response.headers.get('content-length', 0))
                
                if content_length and content_length != expected_size:
                    if retries < self.max_retries - 1:  # Try again if not last retry
                        raise ValueError(f"Size mismatch: got {content_length}, expected {expected_size}")
                
                # Use smaller chunk sizes for more frequent progress updates
                if speed_limit > 0:
                    iter_chunk_size = 128 * 1024  # 128KB
                    buffer_size = 2 * 1024 * 1024
                else:
                    iter_chunk_size = 256 * 1024  # 256KB
                    buffer_size = 8 * 1024 * 1024
                with open(chunk.temp_file_path, "wb", buffering=buffer_size) as f:
                    window_start = time.time()
                    window_bytes = 0
                    for data in response.iter_content(chunk_size=iter_chunk_size):
                        if not data:
                            break
                        f.write(data)
                        chunk.downloaded += len(data)
                        with self.lock:
                            self.downloaded_size += len(data)
                            # Update speed calculation more frequently
                            now = time.time()
                            time_diff = now - self.last_update_time
                            if time_diff >= 0.1:  # Update every 100ms
                                current_speed = (self.downloaded_size - self.last_downloaded_size) / time_diff
                                self.current_speed = self.current_speed * 0.7 + current_speed * 0.3
                                self.last_downloaded_size = self.downloaded_size
                                self.last_update_time = now
                        if callback:
                            callback(len(data))
                        if speed_limit > 0:
                            window_bytes += len(data)
                            now = time.time()
                            elapsed = now - window_start
                            if elapsed > window_duration:
                                actual_speed = window_bytes / elapsed
                                if actual_speed > speed_limit:
                                    sleep_time = (window_bytes / speed_limit) - elapsed
                                    if sleep_time > min_sleep:
                                        time.sleep(sleep_time)
                                window_start = time.time()
                                window_bytes = 0
                
                # Quick size verification
                actual_size = os.path.getsize(chunk.temp_file_path)
                if actual_size == expected_size:
                    return True  # Success
                
                # Partial download - try to resume if supported
                if self.resume_support and actual_size < expected_size:
                    chunk.start += actual_size
                    headers['Range'] = f'bytes={chunk.start}-{chunk.end}'
                    continue
                
                raise ValueError(f"Size verification failed: {actual_size} != {expected_size}")
                
            except (requests.exceptions.RequestException, ValueError) as e:
                retries += 1
                if retries >= self.max_retries:
                    with self.lock:
                        self.failed_chunks.append(chunk)
                    raise Exception(f"Chunk download failed after {self.max_retries} retries: {str(e)}")
                
                # Smart backoff with jitter
                wait_time = (backoff_factor ** retries) + (random.random() * 0.1)
                time.sleep(min(wait_time, 10))  # Cap at 10 seconds
                
def read_size(size, decimal_places=2):
    if size == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    i = 0
    while size >= 1024 and i < len(units) - 1:
        size /= 1024.0
        i += 1
    return f"{size:.{decimal_places}f} {units[i]}"

def download_file(link, game, online, dlc, isVr, updateFlow, version, size, download_dir, withNotification=None):
    archive_file_path = None
    archive_ext = None

    os.makedirs(download_dir, exist_ok=True)
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
            "downloading": True,
            "extracting": False,
            "updating": updateFlow,
            "progressCompleted": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "calculating..."
        }
    }
    safe_write_json(game_info_path, game_info)
    if withNotification:
        _launch_notification(withNotification, "Download Started", f"Starting download for {game}")

    logging.info(f"Starting download: {link}")

    # Get file info and pre-allocate
    session = requests.Session()
    session.mount('https://', SSLContextAdapter())
    try:
        resp = session.head(link, timeout=(30, 60))
        resp.raise_for_status()
        total_size_header = resp.headers.get('Content-Length')
        if total_size_header is not None and total_size_header.isdigit():
            total_size = int(total_size_header)
        else:
            # Try GET with Range header
            logging.info("HEAD did not return Content-Length. Trying GET with Range header...")
            try:
                resp2 = session.get(link, headers={'Range': 'bytes=0-1'}, stream=True, timeout=(30, 60))
                content_range = resp2.headers.get('Content-Range')
                if content_range and '/' in content_range:
                    total_size_candidate = content_range.split('/')[-1]
                    if total_size_candidate.isdigit():
                        total_size = int(total_size_candidate)
                        logging.info(f"Got file size from Content-Range: {total_size}")
                    else:
                        total_size = None
                else:
                    total_size = None
                resp2.close()
            except Exception:
                total_size = None
            if total_size is None:
                logging.warning("Could not determine file size from headers or Content-Range. Proceeding without pre-allocation or progress tracking.")
        archive_file_path = os.path.join(download_path, os.path.basename(link.split('?')[0]))
        if not os.path.exists(download_path):
            os.makedirs(download_path, exist_ok=True)
        if total_size:
            logging.info(f"File size: {total_size/1024/1024:.2f} MB")
            if total_size > 2 * 1024 * 1024 * 1024:
                logging.warning(f"File is larger than 2GB ({total_size/1024/1024/1024:.2f} GB). Skipping pre-allocation to avoid long delays.")
                with open(archive_file_path, 'wb') as f:
                    pass  # Create empty file, skip truncate
                logging.info("Pre-allocation skipped for large file.")
            else:
                logging.info("Pre-allocating file...")
                with open(archive_file_path, 'wb') as f:
                    f.truncate(total_size)
                logging.info("Pre-allocation complete.")
        else:
            logging.info("Skipping pre-allocation since file size is unknown.")
    except Exception as e:
        handleerror(game_info, game_info_path, e)
        return archive_file_path, archive_ext

    if total_size:
        game_info['size'] = read_size(total_size)
        safe_write_json(game_info_path, game_info)
    # If total_size is None, pass 0 to DownloadManager (or handle accordingly)
    manager = DownloadManager(link, total_size or 0)
    temp_dir = os.path.join(download_path, "_chunks")
    os.makedirs(temp_dir, exist_ok=True)
    # If file size is unknown, only use one chunk
    if total_size is None or total_size == 0:
        manager.num_threads = 1
        manager.max_chunk_size = None
        manager.chunks = []
        # Create a single chunk from 0 to unknown
        from types import SimpleNamespace
        chunk = SimpleNamespace(start=0, end=None, url=link, chunk_id=0, temp_file_path=os.path.join(temp_dir, 'chunk_0.tmp'), downloaded=0)
        manager.chunks.append(chunk)
        num_chunks = 1
        chunk_size_str = "unknown chunk size"
    else:
        manager.split_chunks(temp_dir)
        num_chunks = len(manager.chunks)
        if manager.max_chunk_size is not None:
            chunk_size_str = f"{manager.max_chunk_size//(1024*1024)} MB/chunk"
        else:
            chunk_size_str = "unknown chunk size"
    logging.info(f"DownloadManager: {num_chunks} chunks, {manager.num_threads} threads, {chunk_size_str}, speed limit: {manager.download_speed_limit} KB/s")

    # Progress tracking
    shared_progress = {
        'downloaded_size': 0,
        'current_speed': 0.0,
        'progress': 0.0,
        'progressCompleted': "0.00",
        'progressDownloadSpeeds': "0.00 KB/s",
        'time_until_complete': 'calculating...'
    }
    progress_lock = threading.Lock()
    stop_event = threading.Event()

    def update_progress(bytes_downloaded):
        with progress_lock:
            shared_progress['downloaded_size'] = manager.downloaded_size
            elapsed_time = time.time() - start_time
            download_speed = manager.downloaded_size / elapsed_time if elapsed_time > 0 else 0
            shared_progress['current_speed'] = manager.current_speed
            if total_size:
                shared_progress['progress'] = min(100.0, (manager.downloaded_size / total_size) * 100)
            else:
                shared_progress['progress'] = 0.0
            cs = manager.current_speed
            if cs < 1024:
                speed_str = f"{cs:.2f} B/s"
            elif cs < 1024 * 1024:
                speed_str = f"{cs / 1024:.2f} KB/s"
            else:
                speed_str = f"{cs / (1024 * 1024):.2f} MB/s"
            shared_progress['progressDownloadSpeeds'] = speed_str
            if total_size:
                remaining_size = total_size - manager.downloaded_size
                if cs > 0 and remaining_size > 0:
                    time_until_complete = remaining_size / cs
                    minutes, seconds = divmod(time_until_complete, 60)
                    hours, minutes = divmod(minutes, 60)
                    if hours > 0:
                        time_str = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
                    else:
                        time_str = f"{int(minutes)}m {int(seconds)}s"
                    shared_progress['time_until_complete'] = time_str
                elif remaining_size <= 0:
                    shared_progress['time_until_complete'] = '0'
                else:
                    shared_progress['time_until_complete'] = 'calculating...'
                shared_progress['progressCompleted'] = f"{shared_progress['progress']:.2f}"
            else:
                shared_progress['time_until_complete'] = 'unknown'
                shared_progress['progressCompleted'] = f"{manager.downloaded_size} bytes"
            game_info['downloadingData']['progressCompleted'] = shared_progress['progressCompleted']
            game_info['downloadingData']['progressDownloadSpeeds'] = shared_progress['progressDownloadSpeeds']
            game_info['downloadingData']['timeUntilComplete'] = shared_progress['time_until_complete']
            safe_write_json(game_info_path, game_info)
            logging.info(f"Progress: {shared_progress['progressCompleted']} | Speed: {speed_str} | ETA: {shared_progress['time_until_complete']}")

    def progress_writer():
        last_written = (None, None, None)
        while not stop_event.is_set():
            update_progress(0)
            stop_event.wait(1.0)

    start_time = time.time()
    progress_thread = threading.Thread(target=progress_writer, daemon=True)
    progress_thread.start()

    start_barrier = threading.Barrier(manager.num_threads)

    def download_worker(chunk):
        thread_name = f"Downloader-{chunk.chunk_id+1}"
        threading.current_thread().name = thread_name
        try:
            start_barrier.wait()
        except Exception:
            pass
        retries = 0
        while retries < manager.max_retries:
            try:
                manager.download_chunk(chunk, session, callback=update_progress)
                return True
            except Exception as e:
                logging.error(f"Chunk {chunk.chunk_id} failed (attempt {retries+1}): {e}")
                retries += 1
                time.sleep(0.5 * retries)
        return False

    with ThreadPoolExecutor(max_workers=manager.num_threads) as executor:
        futures = [executor.submit(download_worker, chunk) for chunk in manager.chunks]
        for future in as_completed(futures):
            if not future.result():
                logging.error("A chunk failed after all retries. Download incomplete.")
                stop_event.set()
                progress_thread.join()
                handleerror(game_info, game_info_path, "A chunk failed after all retries.")
                return archive_file_path, archive_ext

    stop_event.set()
    progress_thread.join()
    logging.info("Download completed successfully.")
    game_info['downloadingData']['downloading'] = False
    safe_write_json(game_info_path, game_info)

    # Merge chunks into archive_file_path
    with open(archive_file_path, 'r+b') as out_file:
        for chunk in sorted(manager.chunks, key=lambda c: c.chunk_id):
            with open(chunk.temp_file_path, 'rb') as cf:
                shutil.copyfileobj(cf, out_file)
            os.remove(chunk.temp_file_path)
    shutil.rmtree(temp_dir, ignore_errors=True)

    # Extraction logic
    try:
        # Mark extracting state
        game_info["downloadingData"]["downloading"] = False
        game_info["downloadingData"]["extracting"] = True
        safe_write_json(game_info_path, game_info)

        archive_ext = os.path.splitext(archive_file_path)[1].lower().lstrip('.')
        watching_path = os.path.join(download_path, "filemap.ascendara.json")
        watching_data = {}

        if sys.platform == "win32":
            if archive_ext == "rar":
                from unrar import rarfile
                with rarfile.RarFile(archive_file_path, 'r') as fs:
                    for rar_info in fs.infolist():
                        if not rar_info.filename.endswith('.url') and '_CommonRedist' not in rar_info.filename:
                            extracted_path = os.path.join(download_path, rar_info.filename)
                            key = f"{os.path.relpath(extracted_path, download_path)}"
                            watching_data[key] = {"size": rar_info.file_size}
                    for rar_info in fs.infolist():
                        if not rar_info.filename.endswith('.url'):
                            fs.extract(rar_info, download_path)
            elif archive_ext == "zip":
                import zipfile
                with zipfile.ZipFile(archive_file_path, 'r') as zip_ref:
                    for zip_info in zip_ref.infolist():
                        if not zip_info.filename.endswith('.url') and '_CommonRedist' not in zip_info.filename:
                            extracted_path = os.path.join(download_path, zip_info.filename)
                            key = f"{os.path.relpath(extracted_path, download_path)}"
                            watching_data[key] = {"size": zip_info.file_size}
                    for zip_info in zip_ref.infolist():
                        if not zip_info.filename.endswith('.url'):
                            zip_ref.extract(zip_info, download_path)
        else:
            # For non-Windows, use patoolib and get file info after extraction
            before_files = set()
            for dirpath, _, filenames in os.walk(download_path):
                for fname in filenames:
                    if not fname.endswith('.url'):
                        before_files.add(os.path.join(dirpath, fname))
            import patoolib
            patoolib.extract_archive(archive_file_path, outdir=download_path)
            for dirpath, _, filenames in os.walk(download_path):
                for fname in filenames:
                    if not fname.endswith('.url') and '_CommonRedist' not in os.path.join(dirpath, fname):
                        full_path = os.path.join(dirpath, fname)
                        if full_path not in before_files:
                            key = f"{os.path.relpath(full_path, download_path)}"
                            watching_data[key] = {"size": os.path.getsize(full_path)}

        # Save watching data
        safe_write_json(watching_path, watching_data)

        # Mark verifying state
        game_info["downloadingData"]["extracting"] = False
        game_info["downloadingData"]["verifying"] = True
        safe_write_json(game_info_path, game_info)

        # Call verification
        _verify_extracted_files(watching_path, download_path, game_info, game_info_path, game, archive_file_path)

        # Finalize
        del game_info["downloadingData"]
        safe_write_json(game_info_path, game_info)

        if withNotification:
            _launch_notification(withNotification, "Download Complete", f"Successfully downloaded and extracted {game}")

    except Exception as e:
        handleerror(game_info, game_info_path, e)
        print(f"Failed to extract or verify {game}. Error: {e}")

    return archive_file_path, archive_ext

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
    parser.add_argument("updateFlow", type=parse_boolean, help="Is this an update (true/false)?")
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
        download_file(args.link, args.game, args.online, args.dlc, args.isVr, args.updateFlow, args.version, args.size, args.download_dir, args.withNotification)
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