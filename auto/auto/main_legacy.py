import time
import os
import glob
import shutil
from flask import Flask, request, jsonify
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import json
import re
from selenium.webdriver.common.alert import Alert
from selenium.common.exceptions import TimeoutException

# ======================================================
# FLASK APP
# ======================================================
app = Flask(__name__)


# ======================================================
# CONFIG
# ======================================================
BASE_DIR = os.getcwd()
SITE_URL = "https://atlantic.newvisionsystems.com/or_web1/"
# SITE_URL = "https://bclrs.co.bergen.nj.us/browserview/"
# SITE_URL = "https://mcrecords.co.middlesex.nj.us/publicsearch1/"

# Default fallback
DEFAULT_SITE_URL = "https://atlantic.newvisionsystems.com/or_web1/"

def get_site_folder(site_url):
    if not site_url:
        site_url = DEFAULT_SITE_URL
    if "atlantic" in site_url:
        return "atlantic"
    elif "bergen" in site_url:
        return "bergen"
    elif "middlesex" in site_url:
        return "middlesex"
    else:
        return "other"

def get_base_download_dir(site_url):
    folder = get_site_folder(site_url)
    path = os.path.join(BASE_DIR, folder)
    os.makedirs(path, exist_ok=True)
    return path


# ======================================================
# UTILITIES
# ======================================================
def get_formatted_date(date_input):
    """
    Convert a string or datetime object to 'MM/DD/YYYY' format.
    Accepts 'MM/DD/YYYY' or datetime object as input.
    """
    if isinstance(date_input, datetime):
        date_obj = date_input
    else:
        # Adjust format to match your input string
        # Your input is like '7/2/2025'
        date_obj = datetime.strptime(date_input, "%m/%d/%Y")

    return date_obj.strftime("%m/%d/%Y")

def normalize_date(date_str: str) -> str:
    formats = ("%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d")
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%m/%d/%Y")
        except ValueError:
            pass
    raise ValueError("Invalid date format")


def format_owner_name(name: str) -> str:
    if not isinstance(name, str):
        return ""

    name = name.strip()
    entity_keywords = [
        "LLC", "INC", "CORP", "COMPANY", "CO",
        "TRUST", "CHURCH", "FBO", "/"
    ]

    for k in entity_keywords:
        if k in name.upper():
            return name

    parts = name.split()
    if len(parts) == 2:
        return f"{parts[1]} {parts[0]}"
    if len(parts) >= 3:
        return f"{parts[-1]} {parts[0]}"

    return name

def get_download_dir(file_number, site_url=None):
    base_dir = get_base_download_dir(site_url)
    static_folder = "Town_Lot_Block"
    path = os.path.join(base_dir, str(file_number), static_folder)
    os.makedirs(path, exist_ok=True)
    return path


def wait_for_new_pdf(download_dir, existing_files, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        current_files = set(glob.glob(os.path.join(download_dir, "*.pdf")))
        print("current_files", current_files)
        new_files = current_files - existing_files
        if new_files:
            pdf = new_files.pop()
            if not os.path.exists(pdf + ".crdownload"):
                return pdf
        time.sleep(1)
    raise TimeoutError("PDF download timeout")





# ======================================================
# BROWSER
# ======================================================
def start_browser(download_dir):
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")

    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "plugins.always_open_pdf_externally": True
    }
    options.add_experimental_option("prefs", prefs)

    return webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )




# ======================================================
# NAVIGATION
# ======================================================
def open_site(driver, site_url=None):
    if not site_url:
        site_url = DEFAULT_SITE_URL
    driver.get(site_url)
    WebDriverWait(driver, 20).until(
        EC.element_to_be_clickable(
            (By.XPATH, "//a[contains(text(),'Town/Lot/Block')]")
        )
    ).click()
    time.sleep(3)


# ======================================================
# SEARCH FORM
# ======================================================
def fill_search_form(driver, township, lot, block, party_name, from_date, to_date):
    wait = WebDriverWait(driver, 25)

    town_select = wait.until(
    EC.presence_of_element_located(
        (By.XPATH, "//select[@ng-model='documentService.SearchCriteria.searchCommonTown']")
    )
    )

    select = Select(town_select)

    matched = False
    for option in select.options:
        option_text = option.text.replace("\u00a0", " ").strip().upper()
        if option_text == township.strip().upper():
            driver.execute_script("arguments[0].selected = true;", option)
            matched = True
            break

    if not matched:
        raise Exception(f"Township not found in dropdown: {township}")


    lot_input = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//input[@placeholder='Lot']")
    ))
    lot_input.clear()
    lot_input.send_keys(str(lot))

    block_input = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//input[@placeholder='Block']")
    ))
    block_input.clear()
    block_input.send_keys(str(block))

    checkbox = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//input[contains(@class,'tree-checkbox')]")
    ))
    if not checkbox.is_selected():
        driver.execute_script("arguments[0].click();", checkbox)

    party = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//input[@name='partyName']")
    ))
    party.clear()
    party.send_keys(party_name)
    from_el = driver.find_element(By.NAME, "fromdate")
    to_el = driver.find_element(By.NAME, "todate")

    for el, val in [(from_el, from_date), (to_el, to_date)]:
        driver.execute_script("""
            arguments[0].value = arguments[1];
            arguments[0].dispatchEvent(new Event('input',{bubbles:true}));
            arguments[0].dispatchEvent(new Event('change',{bubbles:true}));
        """, el, val)

    search_btn = wait.until(EC.presence_of_element_located(
        (By.XPATH, "//button[@ng-click='runSearch(true)']")
    ))
    driver.execute_script("arguments[0].click();", search_btn)

    time.sleep(6)



def extract_type_and_instrument(driver):
    wait = WebDriverWait(driver, 25)

    doc_type = wait.until(
        EC.presence_of_element_located(
            (By.XPATH, "//td[text()='Type:']/following-sibling::td")
        )
    ).text.strip()

    instrument = wait.until(
        EC.presence_of_element_located(
            (By.XPATH, "//td[contains(text(),'Instrument')]/following-sibling::td")
        )
    ).text.strip()

    return f"{doc_type}_{instrument}".replace("/", "_").replace(" ", "_")


# ======================================================
# PROCESS DOCUMENTS
# ======================================================
def process_all_views(driver, download_dir):
    wait = WebDriverWait(driver, 30)
    file_count = 0

    view_buttons = wait.until(
        EC.presence_of_all_elements_located(
            (By.XPATH, "//button[normalize-space()='View']")
        )
    )

    if not view_buttons:
        return 0

    for index in range(len(view_buttons)):
        view_buttons = driver.find_elements(By.XPATH, "//button[normalize-space()='View']")
        driver.execute_script("arguments[0].click();", view_buttons[index])

        wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(text(),'PDF / Print All Pages')]")
        )).click()

        existing_files = set(glob.glob(os.path.join(download_dir, "*.pdf")))

        wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//a[starts-with(@href,'blob:') and text()='View']")
        )).click()

        pdf_path = wait_for_new_pdf(download_dir, existing_files)
        filename = extract_type_and_instrument(driver)

        os.rename(pdf_path, os.path.join(download_dir, f"{filename}.pdf"))
        file_count += 1
        time.sleep(2)

    return file_count


# ======================================================
# API ENDPOINT
# ======================================================
@app.route("/scrape", methods=["POST"])
def scrape():
    driver = None
    try:
        payload = request.get_json()

        township = payload.get("township")
        lot = payload.get("lot")
        block = payload.get("block")
        party_name = format_owner_name(payload.get("party_name"))
        file_number = payload.get("file_number")
        date= payload.get("date")
        site_url = payload.get("site_url")
        if not file_number:
            return jsonify({"status": "ERROR", "message": "File number required"}), 400
        download_dir = get_download_dir(file_number, site_url)
        from_date = normalize_date(date)
        to_date = datetime.today().strftime("%m/%d/%Y")
        if not all([township, lot, block, party_name]):
            return jsonify({"status": "ERROR", "message": "Invalid payload"}), 400

        driver = start_browser(download_dir)
        open_site(driver, site_url)
        fill_search_form(driver, township, lot, block, party_name,from_date, to_date)

        file_count = process_all_views(driver, download_dir)

        if file_count > 0:
            return jsonify({
                "status": "PDF_FOUND_SUCCESSFULLY",
                "file_count": file_count
            })
        else:
            return jsonify({
                "status": "DATA_NOT_FOUND",
                "file_count": 0
            })

    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

    finally:
        if driver:
            driver.quit()


def create_party_download_folder(file_number, site_url=None):
    base_dir = get_base_download_dir(site_url)
    static_folder = "party"
    path = os.path.join(base_dir, str(file_number), static_folder)
    os.makedirs(path, exist_ok=True)
    return path

from selenium.webdriver.common.keys import Keys

# ======================================================
# SEARCH FLOW
# ======================================================
# ======================================================
# SEARCH FLOW
# ======================================================
def perform_search(driver, party_name, township, from_date, to_date, site_url=None):
    if not site_url:
        site_url = DEFAULT_SITE_URL
    print("--- Starting perform_search ---")
    driver.get(site_url)
    wait = WebDriverWait(driver, 50)
    time.sleep(4)
    
    # RETRY LOOP: Find Input (Switch Tab if needed)
    party_input_found = False
    
    for attempt in range(1, 4):
        print(f"Attempt {attempt}/3: Checking for Party Name input...")
        
        # 1. Check if visible immediately
        try:
            visible_inputs = [
                i for i in driver.find_elements(By.CSS_SELECTOR, "input[placeholder='Party Name']") 
                if i.is_displayed() and i.size['width'] > 0
            ]
            if visible_inputs:
                print("Party Input is visible!")
                party_input_found = True
                break
        except Exception as e:
            print(f"Check input error: {e}")

        # 2. If not found, switch tab
        print("Input not visible. Clicking 'Party' tab...")
        try:
            # JS Click
            clicked = driver.execute_script("""
                var tabs = document.querySelectorAll("ul.nav-tabs li a");
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].innerText.includes("Party")) {
                        tabs[i].click();
                        return true;
                    }
                }
                return false;
            """)
            if not clicked:
                # Fallback to XPath
                driver.find_element(By.XPATH, "//a[contains(text(),'Party')]").click()
        except Exception as e:
            print(f"Tab click warning: {e}")
            
        time.sleep(3) # Wait for digest cycle

    if not party_input_found:
        print("CRITICAL: Failed to locate Party Name input after 3 attempts. Aborting search form.")
        return

    # FILL FORM - HYBRID APPROACH (Angular + DOM)
    print(f"Filling form for Party: {party_name}")
    try:
        # We know input is visible now
        
        # Angular Injection
        injection_result = driver.execute_script("""
            var partyName = arguments[0];
            var town = arguments[1];
            var fromDate = arguments[2];
            var toDate = arguments[3];
            
            try {
                var inputs = Array.from(document.querySelectorAll('input[placeholder="Party Name"]'));
                var partyInput = inputs.find(i => i.offsetWidth > 0 && i.offsetHeight > 0) || inputs[0];
                
                if (!partyInput) return "No Party Input found in Script";
                
                var scope = angular.element(partyInput).scope();
                if (!scope || !scope.documentService) {
                    scope = angular.element(document.querySelector('div[ng-view]')).scope() || 
                            angular.element(document.body).scope();
                }

                if (scope && scope.documentService && scope.documentService.SearchCriteria) {
                    scope.$apply(function() {
                        scope.documentService.SearchCriteria.searchTerm = partyName;
                        scope.documentService.SearchCriteria.searchPartyName = partyName;
                        if (town) scope.documentService.SearchCriteria.searchCommonTown = town.toUpperCase();
                        scope.documentService.SearchCriteria.fromDate = fromDate;
                        scope.documentService.SearchCriteria.toDate = toDate;
                    });
                    return "INJECTED_SUCCESS";
                }
                return "SCOPE_MISSING";
            } catch(e) { return "ERROR: " + e.toString(); }
        """, party_name, township, from_date, to_date)
        
        print(f"Angular Injection Status: {injection_result}")

        # Fallback: DOM Typing if injection didn't explicitly succeed
        if "SUCCESS" not in injection_result:
            print("Applying DOM fallback...")
            party_input = driver.find_element(By.CSS_SELECTOR, "input[placeholder='Party Name']")
            if party_input.is_displayed():
                party_input.click()
                party_input.clear()
                party_input.send_keys(party_name)
                party_input.send_keys(Keys.TAB)

        # Select ALL checkbox
        driver.execute_script("""
            try {
                var cb = document.querySelector('.tree-checkbox');
                if(cb) angular.element(cb).scope().$apply(function(s){ s.parentNode.checked = true; });
            } catch(e){}
        """)
        
    except Exception as e:
        print(f"Error during form filling: {repr(e)}")
        return # Stop if filling failed

    # 3. Search
    print("Executing Search via Angular...")
    try:
        # 1. Force Angular Search (Bypasses button click issues)
        driver.execute_script("""
            var searchBtn = document.querySelector("button[ng-click*='runSearch']");
            if (searchBtn) {
                var scope = angular.element(searchBtn).scope();
                if (scope) {
                    scope.$apply(function() {
                        scope.runSearch(true); 
                    });
                } else {
                    searchBtn.click(); // Fallback
                }
            } else {
                console.error("Search button not found for scope launch");
            }
        """)
        
        # 2. ALSO Physical click to be safe (if Angular didn't trigger)
        try:
            search_btn = driver.find_element(By.XPATH, "//button[contains(text(),'Search')]")
            if search_btn.is_displayed():
                driver.execute_script("arguments[0].click();", search_btn)
        except:
            pass

    except Exception as e:
        print(f"Error triggering search: {repr(e)}")

    # Check for alerts
    try:
        WebDriverWait(driver, 5).until(EC.alert_is_present())
        alert = Alert(driver)
        print(f"Alert dismissed: {alert.text}")
        alert.accept()
    except:
        pass
    
    print("Waiting for results...")
    # Wait for results OR "No records found"
    try:
        # Wait for loading spinner to disappear first
        try:
             WebDriverWait(driver, 5).until(EC.invisibility_of_element_located((By.CLASS_NAME, "ajax-loader")))
        except:
             pass

        wait.until(lambda d: 
            d.find_elements(By.XPATH, "//button[contains(@ng-click,'fetchDocument')]") or 
            d.find_elements(By.XPATH, "//td[contains(text(),'No records found')]") or
            d.find_elements(By.XPATH, "//div[contains(text(),'No records found')]")
        )
        print("Results or Message detected.")
    except TimeoutException:
        print("Search timed out.")

    # Check for alerts
    try:
        WebDriverWait(driver, 5).until(EC.alert_is_present())
        alert = Alert(driver)
        msg = alert.text
        alert.accept()
        print(f"Alert dismissed: {msg}")
    except TimeoutException:
        pass
    
    # Wait for results OR "No records found"
    try:
        wait.until(lambda d: 
            d.find_elements(By.XPATH, "//button[contains(@ng-click,'fetchDocument')]") or 
            d.find_elements(By.XPATH, "//td[contains(text(),'No records found')]") or
            d.find_elements(By.XPATH, "//div[contains(text(),'No records found')]")
        )
    except TimeoutException:
        print("Search timed out or no results/message found.")


def download_all_pdfs(driver, download_dir):
    wait = WebDriverWait(driver, 10) # Reduced timeout since we already waited for results
    results = []
    
    # Check if results exist
    view_buttons = driver.find_elements(By.XPATH, "//button[contains(@ng-click,'fetchDocument')]")
    
    if not view_buttons:
        return []

    for index in range(len(view_buttons)):
        try:
            # Re-find elements to avoid stale element exception
            view_buttons = driver.find_elements(
                By.XPATH, "//button[contains(@ng-click,'fetchDocument')]"
            )
            
            if index >= len(view_buttons):
                break

            driver.execute_script("arguments[0].click();", view_buttons[index])
            time.sleep(2)

            # Convert to string to avoid join() error
            doc_type = str(driver.execute_script(
                "return document.querySelector('tr:nth-child(1) td.ng-binding')?.innerText || ''"
            ))
            instrument = str(driver.execute_script(
                "return document.querySelector('tr:nth-child(2) td.ng-binding')?.innerText || ''"
            ))

            existing_files = set(glob.glob(os.path.join(download_dir, "*.pdf")))

            pdf_btn = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[@ng-click='getPDF(false)']"))
            )
            pdf_btn.click()

            view_link = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//a[starts-with(@href,'blob:')]"))
            )
            view_link.click()

            pdf_path = wait_for_new_pdf(download_dir, existing_files)

            safe_name = re.sub(
                r'[\\/*?:"<>|]', "_",
                f"{doc_type}_{instrument}_{index+1}"
            )
            final_path = os.path.join(download_dir, f"{safe_name}.pdf")
            os.rename(pdf_path, final_path)

            results.append({
                "index": index + 1,
                "Type": doc_type,
                "Instrument No": instrument,
                "pdf_file": os.path.basename(final_path)
            })

        except Exception as e:
            print(f"Error processing record {index}: {e}")
            continue

    return results


# ======================================================
# API
# ======================================================

@app.route("/search-document", methods=["POST"])
def search_document():
    driver = None
    try:
        payload = request.get_json() or {}

        party_name = payload.get("party_name")
        township = payload.get("township") 
        from_date_raw = payload.get("from_date")
        file_number = payload.get("file_number")

        if not party_name or not from_date_raw or not file_number:
            return jsonify({
                "error": "party_name, from_date and file_number required"
            }), 400

        from_date = normalize_date(from_date_raw)
        to_date = datetime.today().strftime("%m/%d/%Y")
        site_url = payload.get("site_url")

        file_dir = create_party_download_folder(file_number, site_url)

        driver = start_browser(file_dir)

        perform_search(driver, party_name, township, from_date, to_date, site_url)

        results = download_all_pdfs(driver, file_dir)
        
        if results:
            status = "PDF_FOUND_SUCCESSFULLY"
        else:
            status = "DATA_NOT_FOUND"

        return jsonify({
            "status": status,
            "party_name": party_name,
            "file_number": file_number,
            "from_date": from_date,
            "to_date": to_date,
            "total_downloaded": len(results),
        })

    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

    finally:
        if driver:
            driver.quit()
# ======================================================
# RUN
# ======================================================
if __name__ == "__main__":
    app.run(debug=True)

