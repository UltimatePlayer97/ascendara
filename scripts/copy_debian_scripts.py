# This script is used to easily and quickly copy the scripts to the debian folder
# The debian folder is for Linux/Mac users and allows the script to be run with python3


import os
import shutil

def copy_scripts_to_debian():
    # Get the binaries directory path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    binaries_dir = os.path.join(os.path.dirname(script_dir), 'binaries')

    # Loop through each binary subdirectory
    for binary_name in os.listdir(binaries_dir):
        binary_dir = os.path.join(binaries_dir, binary_name)
        if not os.path.isdir(binary_dir):
            continue
        src_dir = os.path.join(binary_dir, 'src')
        if not os.path.isdir(src_dir):
            print(f"Warning: No src directory found in {binary_name}")
            continue

        debian_dir = os.path.join(src_dir, 'debian')
        # Create or clear debian directory
        if os.path.exists(debian_dir):
            for file in os.listdir(debian_dir):
                file_path = os.path.join(debian_dir, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    print(f"Removed existing file: {file} in {debian_dir}")
        else:
            os.makedirs(debian_dir)

        # Copy all .py files from src to src/debian
        for file in os.listdir(src_dir):
            if file.endswith('.py'):
                src_file_path = os.path.join(src_dir, file)
                dest_file_path = os.path.join(debian_dir, file)
                shutil.copy2(src_file_path, dest_file_path)
                print(f"Copied {file} from {src_dir} to {debian_dir}")



if __name__ == '__main__':
    copy_scripts_to_debian()
