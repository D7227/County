import os
import glob
import time
import re
from datetime import datetime

# ======================================================
# CONFIG & CONSTANTS
# ======================================================
BASE_DIR = os.getcwd()
# Default fallback if no URL provided (optional)
DEFAULT_SITE_URL = "https://bclrs.co.bergen.nj.us/browserview/"

# Full list of document types provided by user
ALL_DOC_TYPES = "1,10,11,11A,12,13,14,15,16,17,17A,18,18A,19,1A1,1A2,2,20,21,22,23,24,25,26,27,28,2A,2B,2C,2D,2E,2N,2S,3,31,32,33,33A,34,35,36,37,38,4,5,6,7,7A,8,9,A,AALPRO,ABSD,ABSJ,ABSLD,ABSLM,ACKR,ACONL,ACONSL,ADCLT,ADCLUA,ADEED,AGMD,AGR,AGRC,AHAGR,AIR,AMAGR,AMDCLUA,AMDMAP,AMLISP,AMNC,AMND,AMNN,AMTG,AMTN,APOA,ASALR,ASGD,ASGM,ASGN,ASGND,ASGNLLB,ASGNLN,ASLR,ASRD,ASRG,ASSUM,AST,ASTX,B,BAR,BS1,BS2,C,CAGNM,CASLR,CDEED,CDL,CEMD,CERT,CGRANTA,CGRANTB,CGRANTBER,CGRANTBRD,CGRANTC,CGRANTD,CGRANTE,CGRANTF,CGRANTG,CGRANTH,CGRANTI,CGRANTJ,CGRANTK,CGRANTL,CGRANTM,CGRANTN,CGRANTO,CGRANTP,CGRANTQ,CGRANTR,CGRANTS,CGRANTSCH,CGRANTT,CGRANTU,CGRANTV,CGRANTVAH,CGRANTW,CGRANTXYZ,CHANC,CHANCF,CINC,CLKC,CLUA,CMTS,CO,COLDEED,COLMTG,COMTG,CONLAD,CONORD,CONSD,CONSL,CRAMT,CRTNAFTL,CRTRL,CSALE,CTOD,CTOJ,CTORD,CTX,D,DACTL,DAGRC,DAIRL,DCLC,DCLE,DCLM,DCLT,DCLUA,DCNL,DCNT,DECM,DECMO,DECTR,DEED,DEED1MIL,DEED350,DEEDAJ,DEEDB1MIL,DEEDB350,DEEDCR,DEEDD,DEEDE1MIL,DEEDFLCR,DEEDL1MIL,DEEDL350,DEEDN,DEEDN1MIL,DEEDN350,DEEDS1MIL,DEEDS350,DEEDSP1MIL,DEEDSP350,DEP,DEVA,DISBLCON,DISCL,DISCLB,DISCLUA,DISDA,DISJDG,DISL,DISLEAS,DISMEMC,DISPROPFTL,DISRECOG,DISREIMB,DISSHRBD,DISTRDNM,DISTS,DISWKCMP,DLIEN,DMECHNOI,DMMTG,DNOS,DNOSN,DNOSN3,DNUB,DOR,DOTR,DPHYLIEN,DREM,DRTC,DSALR,DSARD,DSDN,DSMELIEN,DSNUB,DSTL,DSUBNA,E,EAS,EASEM MUN,ESTFTL,F,FEDTAXREL,FEDTAXRLWD,FINJ,FNDISCL,FTL,G,GRANT,GRANTORA,GRANTORBAA,GRANTORBEA,GRANTORBFA,GRANTORBOA,GRANTORBOH,GRANTORBRO,GRANTORC,GRANTORD,GRANTORE,GRANTORF,GRANTORG,GRANTORH,GRANTORI,GRANTORJ,GRANTORK,GRANTORL,GRANTORM,GRANTORN,GRANTORO,GRANTORP,GRANTORQ,GRANTORR,GRANTORS,GRANTORT,GRANTORU,GRANTORV,GRANTORVAN,GRANTORW,GRANTORX,GRANTORY,GRANTORZ,GRIMP,GRLEAS,H,HSPL,HSPR,I,IA,IA3,IA4,IA5,IA6,IA7,INREM,INREMCP,J,JUDG,JUDGAT,JUDGD,JUDGM,K,L,L1,L10,L11,L12,L13,L14,L15,L16,L17,L18,L19,L2,L20,L21,L22,L23,L24,L25,L26,L27,L28,L29,L3,L30,L31,L32,L33,L34,L35,L36,L37,L38,L39,L4,L5,L6,L7,L8,L9,LASAGR,LCKLG,LCKS,LEA,LIEN,LIENCLAIM,LOGOS,LPFD,M,MADT,MC,MDM,MDOE,MEMC,MEML,MEMO,MEMTL,MGE,MGIL,MISC,MISCL,MLPF,MMEML,MNCDT,MNM,MOD,MREV1,MRGL,MRTS,MSBA,MSTE,MTGMOD,MTGOC,MTRDEED,MTSC,MUAGREE,MUNARG,MUND,MUNDOR,MUNEAS,MUNFINJ,MUNL,MUNORD,MUNPAL,MUNROW,MUNSUB,N,NJCLUCE,NOLD,NONABD,NOP,NOSHER,NOSN,NOTINT,NOTLF,NOTUGT,NOTV,NPA,NPCHG,NRNTPOA,NUB,O,ODRMTG,ORAMEN,ORDD,ORDER,ORDR,ORDV,OVP,P,PARD,PARFTL,PARM,PCDL,PDCLC,PDCLM,PDIS,PHYD,PHYL,POA,POLD,POM,POML,PRAGR,PRTSH,Q,R,RAGR,RASGN,RASLR,RD,RDAGR,REABSLM,REAGR,RECAN,RECL,REDISC,REESMT,REFL,REJL,REJRP,REL,RELB,RELEAS,RELI,RELPROP,RELR,RELRGL,REMUNE,RERDCR,RERGL,RERLPF,RERLPR,RERP,RERS,RESD,RESG,RESM,RESV,REVFTL,REVRLTAXLN,RGL,RLEAS,RMDEED,RMOVR,ROW,RPMTG,RTC,RTS,RVFT,RVPA,RWA,S20,SAA,SBNAD,SEL,SHER,SIA,SNA,SS1,SS10,SS11,SS12,SS13,SS14,SS15,SS16,SS17,SS18,SS19,SS2,SS3,SS4,SS5,SS6,SS7,SS8,SS9,STA,STI,STR,SUA,SUB,SUBDEED,SUBJ,SUBL,SUBM,SUBNA,SUMTG,TAA,TAX WAIVER,TAXMAP,TAXW,TERML,TIA,TMEMGR,TN,TNA,TNANOFEE,TNCHG,U,UCC,UCC5,V-1,V-2,V3,V4,V5,VAN,VAR,VEN,VET,WAA,WAR,WARLC,WBA,WEXE,WFTLR,WGH,WIA,WIM,WOA,WOL,WRA,WSATJ,X,XEFE,XEROTHER,XESCROW,XEXPUNGED,XNOT,XSEFR,Y,Z"

# ======================================================
# UTILITIES
# ======================================================
def get_site_folder(site_url, county=None):
    """
    Determine local folder name based on site URL or explicit county.
    """
    if county:
        return county.lower()

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

def get_base_download_dir(site_url, county=None):
    folder = get_site_folder(site_url, county)
    path = os.path.join(BASE_DIR, folder)
    os.makedirs(path, exist_ok=True)
    return path

def get_formatted_date(date_input):
    """
    Convert a string or datetime object to 'MM/DD/YYYY' format.
    Accepts 'MM/DD/YYYY' or datetime object as input.
    """
    if isinstance(date_input, datetime):
        date_obj = date_input
    else:
        date_obj = datetime.strptime(date_input, "%m/%d/%Y")

    return date_obj.strftime("%m/%d/%Y")

def normalize_date(date_str: str) -> str:
    # Accept MM/DD/YYYY, MM-DD-YYYY, and DD/MM/YYYY
    formats = ("%m/%d/%Y", "%m-%d-%Y", "%d/%m/%Y")
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%m/%d/%Y")
        except ValueError:
            pass
    raise ValueError(f"Invalid date format: {date_str}")

def format_owner_name(name: str) -> str:
    if not isinstance(name, str):
        return ""

    name = name.strip()
    entity_keywords = [
        "LLC", "INC", "CORP", "COMPANY", "CO",
        "TRUST", "CHURCH", "FBO", "/"
    ]

    for k in entity_keywords:
        # Use word boundaries to avoid matching "VINCENZO" as "INC"
        if re.search(r'\b' + re.escape(k) + r'\b', name.upper()):
            return name

    parts = name.split()
    if len(parts) == 2:
        return f"{parts[1]} {parts[0]}"
    if len(parts) >= 3:
        return f"{parts[-1]} {parts[0]}"

    return name

def get_download_dir(file_number, site_url=None, county=None):
    base_dir = get_base_download_dir(site_url, county)
    static_folder = "Town_Lot_Block"
    path = os.path.join(base_dir, str(file_number), static_folder)
    os.makedirs(path, exist_ok=True)
    return path

def create_party_download_folder(file_number, site_url=None, folder_name=None, county=None):
    base_dir = get_base_download_dir(site_url, county)
    static_folder = folder_name if folder_name else "party"
    
    # 1. Search for existing folder with this file_number (ignoring suffix)
    # We look for folders starting with "{file_number}" (e.g. "12345" or "12345_5")
    search_pattern = os.path.join(base_dir, f"{file_number}*")
    candidates = glob.glob(search_pattern)
    
    # Filter for directories only and exact prefix match
    existing_dirs = [c for c in candidates if os.path.isdir(c) and os.path.basename(c).startswith(str(file_number))]
    
    if existing_dirs:
        # Sort to find the most relevant if multiple (though we aim for only one)
        # Choosing the first one found to reuse
        target_dir = existing_dirs[0]
        final_path = os.path.join(target_dir, static_folder)
    else:
        # Create new if none exists
        target_dir = os.path.join(base_dir, str(file_number))
        final_path = os.path.join(target_dir, static_folder)
    
    os.makedirs(final_path, exist_ok=True)
    return final_path


def wait_for_new_pdf(download_dir, existing_files, timeout=60):
    end = time.time() + timeout
    while time.time() < end:
        current_files = set(glob.glob(os.path.join(download_dir, "*.pdf")))
        new_files = current_files - existing_files
        if new_files:
            pdf = new_files.pop()
            if not os.path.exists(pdf + ".crdownload"):
                return pdf
        time.sleep(1)
    raise TimeoutError("PDF download timeout")
