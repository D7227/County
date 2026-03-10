from flask import Blueprint, request, jsonify
from datetime import datetime
from services.driver_service import start_browser
from services.scraper_service import open_site, fill_search_form, process_all_views, save_results_as_pdf, check_if_records_exist
from utils.helpers import normalize_date, format_owner_name, get_download_dir

scrape_bp = Blueprint('scrape_bp', __name__)

@scrape_bp.route("/scrape", methods=["POST"])
def scrape():
    driver = None
    try:
        payload = request.get_json()

        township = payload.get("township") or payload.get("Township") or payload.get("Townsnhip")
        lot = payload.get("lot")
        block = payload.get("block")
        party_name_raw = payload.get("party_name")
        party_name = format_owner_name(party_name_raw) if party_name_raw else ""
        file_number = payload.get("file_number")
        date = payload.get("date")
        site_url = payload.get("site_url")
        county = payload.get("county")
        
        if not file_number:
            return jsonify({"status": "ERROR", "message": "File number required"}), 400
            
        download_dir = get_download_dir(file_number, site_url, county)
        from_date = normalize_date(date)
        to_date = datetime.today().strftime("%m/%d/%Y")
        
        if not township or not lot or not block:
            return jsonify({"status": "ERROR", "message": "township, lot, and block are required"}), 400

        driver = start_browser(download_dir)
        open_site(driver, site_url)
        fill_search_form(driver, township, lot, block, party_name, from_date, to_date)

        # 1. Check if records actually exist (helps distinguish DATA_NOT_FOUND)
        records_found = check_if_records_exist(driver)

        file_count = 0

        # 2. Process individual views FIRST (while results page is intact)
        if records_found:
            download_count = process_all_views(driver, download_dir)
            file_count += download_count
            status = "PDF_FOUND_SUCCESSFULLY"
        else:
            status = "DATA_NOT_FOUND"

        # 3. Save results index PDF last (may navigate away from results page)
        index_path = save_results_as_pdf(driver, download_dir, party_name)
        if index_path:
            file_count += 1

        return jsonify({
            "status": status,
            "file_count": file_count
        })

    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

    finally:
        if driver:
            driver.quit()
