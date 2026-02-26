from flask import Blueprint, request, jsonify
import os
from datetime import datetime
from services.driver_service import start_browser
from services.scraper_service import perform_search, download_all_pdfs, save_results_as_pdf, check_if_records_exist
from utils.helpers import normalize_date, create_party_download_folder

party_bp = Blueprint('party_bp', __name__)

@party_bp.route("/search-document", methods=["POST"])
def search_document():
    driver = None
    try:
        payload = request.get_json() or {}

        party_name = payload.get("party_name")
        township = payload.get("township") 
        from_date_raw = payload.get("from_date")
        file_number = payload.get("file_number")
        site_url = payload.get("site_url")
        folder_name = payload.get("folder_name")
        county = payload.get("county")

        if not party_name or not from_date_raw or not file_number:
            return jsonify({
                "error": "party_name, from_date and file_number required"
            }), 400

        from_date = normalize_date(from_date_raw)
        to_date = datetime.today().strftime("%m/%d/%Y")

        file_dir = create_party_download_folder(file_number, site_url, folder_name, county)

        driver = start_browser(file_dir)

        perform_search(driver, party_name, township, from_date, to_date, site_url)

        # 1. Check if records actually exist
        records_found = check_if_records_exist(driver)

        # 2. Print/Save Results Grid as PDF (the index)
        index_path = save_results_as_pdf(driver, file_dir, party_name)
        
        file_count = 0
        if index_path:
            file_count += 1

        # 3. Process individual downloads
        results = []
        if records_found:
            results = download_all_pdfs(driver, file_dir)
            file_count += len(results)
            status = "PDF_FOUND_SUCCESSFULLY"
        else:
            status = "DATA_NOT_FOUND"
        
        # Close driver explicitly to release file locks
        if driver: 
            driver.quit()
            driver = None

        return jsonify({
            "status": status,
            "party_name": party_name,
            "file_number": file_number,
            "from_date": from_date,
            "to_date": to_date,
            "total_downloaded": file_count,
        })

    except Exception as e:
        return jsonify({"status": "ERROR", "message": str(e)}), 500

    finally:
        if driver:
            driver.quit()