# confirmation
import time
import os
import glob
import re
import base64
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.alert import Alert
from selenium.common.exceptions import TimeoutException

from utils.helpers import ALL_DOC_TYPES, wait_for_new_pdf, DEFAULT_SITE_URL

# ======================================================
# NAVIGATION
# ======================================================
def open_site(driver, site_url=None):
    if not site_url:
        site_url = DEFAULT_SITE_URL
        
    driver.get(site_url)
    
    # Check if we are already on a search page or need to click the tab
    try:
        # If the tab is visible, click it. If not, maybe we are already there.
        # BrowserView sites often have these tabs at the top.
        tabs = driver.find_elements(By.XPATH, "//a[contains(text(),'Town/Lot/Block')]")
        if tabs and tabs[0].is_displayed():
            tabs[0].click()
            time.sleep(3)
        else:
            print("Town/Lot/Block tab not found or not visible, assuming direct search page or different county layout.")
    except Exception as e:
        print(f"Navigation warning: {e}")

# ======================================================
# SEARCH LOGIC (PARTY)
# ======================================================
def perform_search(driver, party_name, township, from_date, to_date, site_url=None):
    if not site_url:
        site_url = DEFAULT_SITE_URL
    print("--- Starting perform_search (Service) ---")
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
            var allDocTypes = arguments[4];
            
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
                        
                        // Force Fill Doc Types
                        scope.documentService.SearchCriteria.searchDocType = allDocTypes;
                    });
                    return "INJECTED_SUCCESS";
                }
                return "SCOPE_MISSING";
            } catch(e) { return "ERROR: " + e.toString(); }
        """, party_name, township, from_date, to_date, ALL_DOC_TYPES)
        
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

        # Handle 'ALL' Checkbox & Doc Type Field
        print("Handling 'ALL' Checkbox / Doc Types...")
        try:
            # Robust Selenium Click for 'ALL'
            all_checkbox = wait.until(EC.presence_of_element_located(
                (By.XPATH, "//input[contains(@class,'tree-checkbox')]")
            ))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", all_checkbox)
            time.sleep(0.5)
            if not all_checkbox.is_selected():
                print("Clicking 'ALL' checkbox...")
                driver.execute_script("arguments[0].click();", all_checkbox)
                time.sleep(1) # Wait for auto-fill to happen
            else:
                print("'ALL' checkbox is already selected.")
                
        except Exception as e:
            print(f"Checkbox interaction error: {e}")
        
        # Double check if Doc Type input is filled, if not, fill it manually
        try:
             driver.execute_script("""
                var docInput = document.querySelectorAll("input[ng-model*='DocType']")[0] || 
                               document.querySelector("input[placeholder*='Document Type']");
                var allTypes = arguments[0];
                if (docInput && !docInput.value) {
                    console.log("Doc Type empty after checkbox click, force filling...");
                    docInput.value = allTypes;
                    angular.element(docInput).triggerHandler('input');
                    angular.element(docInput).triggerHandler('change');
                }
             """, ALL_DOC_TYPES)
        except Exception as e:
            print(f"Doc Type fill warning: {repr(e)}")

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

    # Check for "Notice" modal regarding result limits
    try:
        modal_ok = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.XPATH, "//button[@ng-click='modal_ok()']"))
        )
        print("Notice modal detected. Clicking OK...")
        driver.execute_script("arguments[0].click();", modal_ok)
        time.sleep(2)
    except Exception:
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
    
    # Wait for results OR "No records found" (redundant but safe)
    try:
        wait.until(lambda d: 
            d.find_elements(By.XPATH, "//button[contains(@ng-click,'fetchDocument')]") or 
            d.find_elements(By.XPATH, "//td[contains(text(),'No records found')]") or
            d.find_elements(By.XPATH, "//div[contains(text(),'No records found')]")
        )
    except TimeoutException:
        print("Search timed out or no results/message found.")


def check_if_records_exist(driver):
    """
    Returns True if records were found (buttons exist), 
    False if "No records found" is explicitly detected.
    """
    no_records = driver.find_elements(By.XPATH, "//td[contains(text(),'No records found')]") or \
                 driver.find_elements(By.XPATH, "//div[contains(text(),'No records found')]")
    if no_records:
        return False
        
    view_btns = driver.find_elements(By.XPATH, "//button[contains(@ng-click,'fetchDocument')]") or \
                driver.find_elements(By.XPATH, "//button[normalize-space()='View']")
    
    return len(view_btns) > 0


# ======================================================
# SEARCH LOGIC (TOWN/LOT/BLOCK)
# ======================================================

def fill_search_form(driver, township, lot, block, party_name, from_date, to_date):
    wait = WebDriverWait(driver, 25)

    print("Navigating to Town/Lot/Block tab...")
    try:
        tab = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(text(),'Town/Lot/Block')]")))
        driver.execute_script("arguments[0].click();", tab)
        time.sleep(1)
    except Exception as e:
        print(f"Warning: Could not click Town/Lot/Block tab: {e}")

    # Wait for options to populate
    def options_populated(d):
        sel = d.find_element(By.XPATH, "//select[@ng-model='documentService.SearchCriteria.searchCommonTown']")
        return len(Select(sel).options) > 1

    try:
        wait.until(options_populated)
    except:
        print("Warning: Township dropdown options might not have loaded.")

    town_select = driver.find_element(By.XPATH, "//select[@ng-model='documentService.SearchCriteria.searchCommonTown']")
    select = Select(town_select)

    matched = False
    target = township.strip().upper()
    
    # Attempt 1: Select by value directly (often more reliable in Angular)
    try:
        option_by_val = town_select.find_element(By.XPATH, f"./option[@value='{target}']")
        driver.execute_script("arguments[0].selected = true; arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", option_by_val)
        driver.execute_script("arguments[1].dispatchEvent(new Event('change', { bubbles: true }));", option_by_val, town_select)
        matched = True
        # print(f"Selected '{target}' by value.")
    except:
        pass

    if not matched:
        # Attempt 2: Iterate through options (Selenium Select)
        for option in select.options:
            val = (option.get_attribute("value") or "").strip().upper()
            text = option.text.replace("\u00a0", " ").strip().upper()
            
            if text == target or val == target:
                driver.execute_script("arguments[0].selected = true;", option)
                driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", town_select)
                matched = True
                break
    
    if not matched:
        # Fallback 3: Partial match
        for option in select.options:
             text = option.text.replace("\u00a0", " ").strip().upper()
             val = (option.get_attribute("value") or "").strip().upper()
             if target in text or target in val:
                 # print(f"Partial match found: '{text}'/v:'{val}' for target '{target}'")
                 driver.execute_script("arguments[0].selected = true;", option)
                 driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true }));", town_select)
                 matched = True
                 break

    if not matched:
        # Log available options for debugging
        available = [f"{o.text.strip()}({o.get_attribute('value')})" for o in select.options[:10]]
        raise Exception(f"Township not found in dropdown: {township}. Available (first 10): {available}")


    # --- LOT & BLOCK ---
    try:
        lot_input = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@placeholder='Lot']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", lot_input)
        lot_input.clear()
        lot_input.send_keys(str(lot))
    except Exception as e:
        print(f"Warning: Lot input interaction failed, trying JS: {e}")
        driver.execute_script("var el = document.querySelector('input[placeholder=\"Lot\"]'); if(el){ el.value=arguments[0]; angular.element(el).triggerHandler('input'); }", str(lot))

    try:
        block_input = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@placeholder='Block']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", block_input)
        block_input.clear()
        block_input.send_keys(str(block))
    except Exception as e:
        print(f"Warning: Block input interaction failed, trying JS: {e}")
        driver.execute_script("var el = document.querySelector('input[placeholder=\"Block\"]'); if(el){ el.value=arguments[0]; angular.element(el).triggerHandler('input'); }", str(block))

    # --- ALL CHECKBOX ---
    try:
        checkbox = wait.until(EC.presence_of_element_located((By.XPATH, "//input[contains(@class,'tree-checkbox')]")))
        if not checkbox.is_selected():
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", checkbox)
            driver.execute_script("arguments[0].click();", checkbox)
    except Exception as e:
        print(f"Checkbox interaction error: {e}")

    # --- PARTY NAME ---
    if party_name:
        try:
            party = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@name='partyName']")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", party)
            party.clear()
            party.send_keys(party_name)
        except Exception as e:
            print(f"Warning: Party Name interaction failed, trying JS: {e}")
            driver.execute_script("var el = document.querySelector('input[name=\"partyName\"]'); if(el){ el.value=arguments[0]; angular.element(el).triggerHandler('input'); }", party_name)
    else:
        print("party_name is empty, skipping party name field.")

    # --- DATES ---
    try:
        from_el = wait.until(EC.presence_of_element_located((By.NAME, "fromdate")))
        to_el = wait.until(EC.presence_of_element_located((By.NAME, "todate")))
        for el, val in [(from_el, from_date), (to_el, to_date)]:
            driver.execute_script("""
                arguments[0].scrollIntoView({block: 'center'});
                arguments[0].value = arguments[1];
                angular.element(arguments[0]).triggerHandler('input');
                angular.element(arguments[0]).triggerHandler('change');
            """, el, val)
    except Exception as e:
        print(f"Date range error: {e}")

    # --- SEARCH ---
    print("Executing Search...")
    try:
        search_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[@ng-click='runSearch(true)']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", search_btn)
        driver.execute_script("arguments[0].click();", search_btn)
    except Exception as e:
        print(f"Search button click failed: {e}")
        # Fallback search trigger
        driver.execute_script("var btn = document.querySelector('button[ng-click=\"runSearch(true)\"]'); if(btn){ angular.element(btn).scope().runSearch(true); }")

    time.sleep(6)


# ======================================================
# DOWNLOAD HELPERS
# ======================================================
def extract_type_and_instrument(driver, index=None):
    wait = WebDriverWait(driver, 5) # Short timeout for metadata
    
    try:
        doc_type_el = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//td[text()='Type:']/following-sibling::td")
            )
        )
        doc_type = doc_type_el.text.strip()
    except:
        doc_type = ""

    try:
        instrument_el = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//td[contains(text(),'Instrument')]/following-sibling::td")
            )
        )
        instrument = instrument_el.text.strip()
    except:
        instrument = ""

    # If both are valid, return the formatted name
    if doc_type and instrument:
        return f"{doc_type}_{instrument}".replace("/", "_").replace(" ", "_")
    
    # Check if we have at least one
    if doc_type or instrument:
         combined = f"{doc_type}{instrument}".strip().replace("/", "_").replace(" ", "_")
         if combined:
             return combined

    # Fallback if both are empty/missing
    idx_str = f"_{index}" if index is not None else ""
    return f"Document{idx_str}_{int(time.time())}"

def download_all_pdfs(driver, download_dir):
    wait = WebDriverWait(driver, 10) 
    results = []
    
    # Check for "No records found" or empty results
    if driver.find_elements(By.XPATH, "//td[contains(text(),'No records found')]") or \
       driver.find_elements(By.XPATH, "//div[contains(text(),'No records found')]"):
        print("No records found (download_all_pdfs). Skipping downloads.")
        return []

    # Check if results exist
    view_buttons = driver.find_elements(By.XPATH, "//button[contains(@ng-click,'fetchDocument')]")

    if not view_buttons:
        print("No results found in download_all_pdfs")
        return []

    print(f"Found {len(view_buttons)} documents to download.")

    for index in range(len(view_buttons)):
        try:
            # Re-find elements to avoid stale element exception
            view_buttons = driver.find_elements(
                By.XPATH, "//button[contains(@ng-click,'fetchDocument')]"
            )
            
            if index >= len(view_buttons):
                break

            print(f"Processing document {index + 1}...")
            driver.execute_script("arguments[0].click();", view_buttons[index])
            time.sleep(2)

            # Using shared extraction logic to match /scrape endpoint ("rename as scrape")
            # This extracts from the Details view which we just opened
            filename = extract_type_and_instrument(driver, index)

            base_name = filename
            extension = ".pdf"
            final_path = os.path.join(download_dir, f"{base_name}{extension}")

            # Check for duplicates before downloading
            if os.path.exists(final_path):
                 print(f"Skipping duplicate file: {final_path}")
                 continue

            # Extract doc_type and instrument separately for JSON response only
            # (We could parse filename, but getting from DOM is safer for the response fields)
            try:
                doc_type_text = driver.execute_script(
                     "return document.evaluate(\"//td[text()='Type:']/following-sibling::td\", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.innerText || ''"
                ).strip()
                instrument_text = driver.execute_script(
                     "return document.evaluate(\"//td[contains(text(),'Instrument')]/following-sibling::td\", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue?.innerText || ''"
                ).strip()
            except:
                doc_type_text = "Unknown"
                instrument_text = "Unknown"

            existing_files = set(glob.glob(os.path.join(download_dir, "*.pdf")))

            pdf_btn = wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(),'PDF / Print All Pages')]"))
            )
            pdf_btn.click()
            print("Clicked 'PDF / Print All Pages', waiting for generation...")

            # Check for "Large Document" Notice modal (e.g. >40 pages)
            try:
                large_doc_ok = WebDriverWait(driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[@ng-click='modal_ok()']"))
                )
                print("Large Document modal detected. Clicking OK...")
                driver.execute_script("arguments[0].click();", large_doc_ok)
                time.sleep(2)
            except Exception:
                pass

            # User reported ~35s delay, setting timeout to 60s to be safe
            wait_long = WebDriverWait(driver, 60)
            view_link = wait_long.until(
                EC.element_to_be_clickable((By.XPATH, "//a[starts-with(@href,'blob:')]"))
            )
            view_link.click()

            pdf_path = wait_for_new_pdf(download_dir, existing_files)

            # Rename using the consistent filename format
            # base_name = filename # Already defined above
            # extension = ".pdf" # Already defined above
            counter = 1
            # final_path = os.path.join(download_dir, f"{base_name}{extension}") # Already defined above
            
            # Handle duplicates if file exists (this is for files that might have been downloaded
            # by another process or if the initial check was insufficient, e.g., race condition)
            while os.path.exists(final_path):
                 final_path = os.path.join(download_dir, f"{base_name}_{counter}{extension}")
                 counter += 1
            
            os.rename(pdf_path, final_path)
            print(f"Downloaded and renamed: {os.path.basename(final_path)}")

            results.append({
                "index": index + 1,
                "Type": doc_type_text,
                "Instrument No": instrument_text,
                "pdf_file": os.path.basename(final_path)
            })
            
            # Close details/modal if needed or just go back? 
            # The loop re-clicks view buttons which are on the main list. 
            # If opening 'View' replaces the list, we need to go back.
            # But based on `process_all_views`, it seems we stay on the page or it's a modal?
            # `process_all_views` simply loops. Let's assume it's fine.
            # Wait! `process_all_views` logic does NOT seem to navigate back. 
            # If the "View" button opens a new page/tab, we might need logic.
            # But `perform_search` opens a result list.
            # Let's assume the previous logic was correct about navigation.

        except Exception as e:
            print(f"Error processing record {index}: {e}")
            continue

    return results

def process_all_views(driver, download_dir):
    wait = WebDriverWait(driver, 30)
    file_count = 0

    # Check for "No records found" or empty results
    if driver.find_elements(By.XPATH, "//td[contains(text(),'No records found')]") or \
       driver.find_elements(By.XPATH, "//div[contains(text(),'No records found')]"):
        print("No records found (process_all_views). Skipping downloads.")
        return 0

    try:
        view_buttons = wait.until(
            EC.presence_of_all_elements_located(
                (By.XPATH, "//button[normalize-space()='View']")
            )
        )
    except TimeoutException:
        print("No 'View' buttons found or timed out in process_all_views")
        return 0

    if not view_buttons:
        return 0

    for index in range(len(view_buttons)):
        view_buttons = driver.find_elements(By.XPATH, "//button[normalize-space()='View']")
        driver.execute_script("arguments[0].click();", view_buttons[index])

        # Extract filename and resolve duplicates with counter suffix
        try:
            filename = extract_type_and_instrument(driver, index)
            base_name = filename
            extension = ".pdf"
            final_path = os.path.join(download_dir, f"{base_name}{extension}")

            # If file already exists, add counter suffix instead of skipping
            counter = 1
            while os.path.exists(final_path):
                final_path = os.path.join(download_dir, f"{base_name}_{counter}{extension}")
                counter += 1
        except Exception as e:
            print(f"Error determining filename: {e}")
            continue

        wait.until(EC.element_to_be_clickable(
            (By.XPATH, "//button[contains(text(),'PDF / Print All Pages')]")
        )).click()

        # Check for "Large Document" Notice modal (e.g. >40 pages)
        try:
            large_doc_ok = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, "//button[@ng-click='modal_ok()']"))
            )
            print("Large Document modal detected. Clicking OK...")
            driver.execute_script("arguments[0].click();", large_doc_ok)
            time.sleep(2)
        except Exception:
            pass

        existing_files = set(glob.glob(os.path.join(download_dir, "*.pdf")))

        # User reported ~35s delay, setting timeout to 60s to be safe
        wait_long = WebDriverWait(driver, 60)
        wait_long.until(EC.element_to_be_clickable(
            (By.XPATH, "//a[starts-with(@href,'blob:') and text()='View']")
        )).click()

        pdf_path = wait_for_new_pdf(download_dir, existing_files)

        os.rename(pdf_path, final_path)
        file_count += 1
        time.sleep(2)

    return file_count

def save_results_as_pdf(driver, download_dir, party_name):
    print("--- process start save_results_as_pdf ---")
    try:
        # 1. Sanitize filename
        safe_name = re.sub(r'[\\/*?:"<>|]', "", party_name) if party_name else "results"
        filename = f"index_{safe_name}.pdf"
        file_path = os.path.join(download_dir, filename)

        # 2. Click "Print Results"
        # We need to handle two cases:
        # A) It opens a new window/tab (common for print views)
        # B) It changes the current DOM
        
        original_window = driver.current_window_handle
        existing_windows = set(driver.window_handles)
        
        print("Clicking 'Print Results'...")
        
        # 1. Robust Print Suppression (Current + Popups)
        # We override window.open to catch any new windows and kill their print function immediately.
        try:
            driver.execute_script("""
                // Main window suppression
                window.print = function(){ console.log('Main window print suppressed'); };

                // Capture window.open to suppress popups
                if (!window.oldOpen) { window.oldOpen = window.open; }
                window.open = function(url, name, features) {
                    var newWin = window.oldOpen(url, name, features);
                    try {
                        if (newWin) {
                            newWin.print = function(){ console.log('Popup print suppressed'); };
                            // Try to lock it
                            Object.defineProperty(newWin, 'print', {
                                value: function(){}, writable: false, configurable: false
                            });
                        }
                    } catch(e) { console.log('Error suppressing popup: ' + e); }
                    return newWin;
                };
            """)
        except Exception as e:
            print(f"Warning: Failed to inject JS suppression: {e}")

        # Also use CDP as backup
        try:
            driver.execute_cdp_cmd("Page.enable", {})
            driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
                "source": "window.print = function(){};"
            })
        except:
            pass

        try:
            # Use robust JS click on the specific ng-click element
            # We use presence_of_element_located + JS click to be most robust
            print_btn = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//button[contains(@ng-click, 'exportGridResults')]"))
            )
            
            # Ensure in view
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", print_btn)
            time.sleep(1)
            
            print("Found Print Results button. Attempting JS Click...")
            driver.execute_script("arguments[0].click();", print_btn)
            
        except Exception as e:
            print(f"Primary Print Results click failed: {e}")
            # Try to find any element with text 'Print Results' (button, a, span)
            try:
                 print("Trying generic text match via JS...")
                 # Matches any element with exact text or text inside
                 fallback = driver.find_element(By.XPATH, "//*[contains(text(),'Print Results')]")
                 driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", fallback)
                 driver.execute_script("arguments[0].click();", fallback)
            except Exception as e2:
                 print(f"Fallback click failed: {e2}")
            # If we can't click it, we might just try printing the current page as fallback
            # but usually this means we shoud return None or try another selector.
            # Let's proceed to try printing anyway.

        # 3. Check for new window
        time.sleep(3) # Wait for window open or DOM update
        new_windows = set(driver.window_handles) - existing_windows
        
        if new_windows:
            print("New window detected. Switching...")
            driver.switch_to.window(new_windows.pop())
            # Wait for load
            try:
                WebDriverWait(driver, 10).until(lambda d: d.execute_script('return document.readyState') == 'complete')
            except:
                pass
        else:
            print("No new window detected. Using current window.")

        # 4. Suppress Print Dialog (important if the page auto-executes window.print())
        driver.execute_script("window.print = function(){};")

        # 5. Generate PDF via CDP
        print("Generating PDF via CDP...")
        pdf_data = driver.execute_cdp_cmd("Page.printToPDF", {
            "printBackground": True,
            "landscape": False, # Usually result lists are portrait, but adjust if needed
            "paperWidth": 8.27, # A4
            "paperHeight": 11.69, # A4
            "marginTop": 0.4,
            "marginBottom": 0.4,
            "marginLeft": 0.4,
            "marginRight": 0.4,
            "displayHeaderFooter": False
        })

        # 6. Save to file
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(pdf_data['data']))
        
        print(f"Saved Results PDF: {file_path}")

        # 7. Cleanup (Close new window if we opened one)
        if driver.current_window_handle != original_window:
            driver.close()
            driver.switch_to.window(original_window)

        return file_path

    except Exception as e:
        print(f"Error in save_results_as_pdf: {e}")
        # Ensure we return to original window if we crashed mid-switch
        try:
            if driver.current_window_handle != original_window:
                 driver.switch_to.window(original_window)
        except:
            pass
        return None
