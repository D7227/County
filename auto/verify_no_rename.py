import os
import glob
import shutil
from utils.helpers import create_party_download_folder

# Setup Test Env
BASE = os.getcwd()
TEST_FILE_NUM = "TestNoRename"
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

# In a real run, party_routes.py would have renamed it. 
# We can't easily mock the whole route here without running the server, 
# but we can verify that our helper still reuses it even without renaming.

print("\n--- Test 2: Create AGAIN (Should reuse same folder, no renaming logic to verify here directly but helper is key) ---")
path2 = create_party_download_folder(TEST_FILE_NUM, "https://bclrs.co.bergen.nj.us/browserview/", TEST_FOLDER_NAME)
print(f"Path2: {path2}")

assert path1 == path2
assert os.path.basename(os.path.dirname(path2)) == TEST_FILE_NUM 

print("\n--- PASSED: Logic reuses existing folder and name remains constant (in helper scope) ---")
print("NOTE: The actual disabling of renaming was done in party_routes.py by removing the code.")
