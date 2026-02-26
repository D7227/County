import os
import glob
import shutil
from utils.helpers import create_party_download_folder

# Setup Test Env
BASE = os.getcwd()
TEST_FILE_NUM = "99999"
TEST_FOLDER_NAME = "party"

# Clean up
existing = glob.glob(os.path.join(BASE, "bergen", f"{TEST_FILE_NUM}*"))
for e in existing:
    if os.path.exists(e):
        shutil.rmtree(e)

print("--- Test 1: Create First Time ---")
path1 = create_party_download_folder(TEST_FILE_NUM, "https://bclrs.co.bergen.nj.us/browserview/", TEST_FOLDER_NAME)
print(f"Path1: {path1}")
assert os.path.exists(path1)
assert f"bergen\\{TEST_FILE_NUM}\\{TEST_FOLDER_NAME}" in path1

print("\n--- Test 2: Rename Folder (Simulate Scraper Logic) ---")
# Manually rename to simulate "99999_5"
parent_dir = os.path.dirname(path1)
renamed_dir = f"{parent_dir}_5"
os.rename(parent_dir, renamed_dir)
print(f"Renamed to: {renamed_dir}")

print("\n--- Test 3: Create AGAIN (Should Find Renamed) ---")
path2 = create_party_download_folder(TEST_FILE_NUM, "https://bclrs.co.bergen.nj.us/browserview/", TEST_FOLDER_NAME)
print(f"Path2: {path2}")

# Path2 should be .../99999_5/party
assert "99999_5" in path2
assert os.path.exists(path2)

# Check we didn't create a new '99999'
files = glob.glob(os.path.join(BASE, "bergen", f"{TEST_FILE_NUM}*"))
print(f"Folders found: {files}")
assert len(files) == 1 # Only the _5 folder should exist

print("\n--- PASSED: Logic reuses existing folder ---")
