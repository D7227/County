export function generateVariationsStrict(rawName: string | null | undefined): string[] {
    const out = new Set<string>();
    if (!rawName || !String(rawName).trim()) return [];

    const normSpaces = (s: string) => String(s).replace(/\s+/g, " ").trim();
    const normApos = (s: string) => String(s).replace(/['']/g, "'");
    const normComma = (s: string) => String(s).replace(/\s*,\s*/g, ", ").trim();
    const stripEdge = (s: string) => String(s).replace(/^[,.\s]+|[,.\s]+$/g, "").trim();
    const first3 = (s: string) => (s ? String(s).trim().slice(0, 3) : "");
    const isAlpha = (s: string) => /^[A-Za-z]+$/.test(s);
    const isAllUpper = (s: string) => s === s.toUpperCase() && /[A-Z]/.test(s);

    const add = (s: string) => {
        if (!s) return;
        const v = normComma(normSpaces(normApos(String(s))));
        if (v) out.add(v);
    };

    const stripSuffixes = (s: string) =>
        s.replace(/\b(JR|SR|II|III|IV)\b\.?/gi, "").replace(/\s+/g, " ").trim();

    const original = normSpaces(normApos(rawName));
    const cleaned = stripSuffixes(original);

    let name = cleaned;
    const commaMatch = cleaned.match(/^(.+?),\s*(.+)$/);
    if (commaMatch) {
        const last = stripEdge(commaMatch[1]);
        const first = stripEdge(commaMatch[2]);
        add(`${last}, ${first}`);
        name = normSpaces(`${first} ${last}`);
    } else {
        add(cleaned);
    }

    // Extraction Flags (Keeping for future logic extensions or as requested)
    const hasAKA = /\b(AKA|A\/K\/A|FKA|F\/K\/A|NKA|N\/K\/A)\b/i.test(name);
    const isPartnership = /\s(&|AND)\s/i.test(name);
    const isTrust = /\b(TRUST|REVOCABLE|ESTATE)\b/i.test(name);
    const isCompany = /\b(LLC|INC|CORP|CO|HOLDINGS|LTD|PC|PLLC|ORG)\b/i.test(name);

    let baseName = name;

    /* ─────────────────────────  COMPANY  ───────────────────────── */
    if (isCompany) {
        const clean = normSpaces(baseName);
        const match = clean.match(/^(.+?),?\s*(LLC|INC|CORP|CO|LTD|PC|PLLC|ORG)?\.?$/i);

        let base = clean;
        let suffix = "";

        if (match) {
            base = normSpaces(match[1]);
            suffix = match[2] ? match[2].toUpperCase() : "";
        }

        const singular = base.replace(/\bInvestments\b/i, "Investment");

        if (suffix) add(`${base}, ${suffix}`);
        add(base);
        add(singular);

        if (/^LLC$/i.test(suffix)) {
            add(`${base}, INC`);
        }

        /* ───── STREET VARIATIONS (CORRECT LOCATION) ───── */
        if (/^\d+\s/i.test(base)) {
            const shortAve = base.replace(/\bAvenue\b/i, "Ave");
            add(shortAve);

            const longAve = base.replace(/\bAve\b\.?/i, "Avenue");
            add(longAve);

            const noSuffix = base.replace(
                /\b(Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\b\.?/gi,
                ""
            ).trim();

            add(noSuffix);
        }

        return Array.from(out);
    }

    /* ─────────────────────────  PERSON LOGIC  ───────────────────────── */
    addStrictPersonOrEntity(baseName, add);
    return Array.from(out);

    function addStrictPersonOrEntity(nm: string, addFn: (s: string) => void) {
        const s = normSpaces(nm);
        const parts = s.split(" ").filter(Boolean);
        if (!parts.length) return;

        const first = parts[0];
        const f3 = first3(first);

        /* ─── GENERIC 2 PART ─── */
        if (parts.length === 2) {
            const lastUpper = parts[1].toUpperCase();
            const firstUpper = first.toUpperCase();
            const f3Upper = f3.toUpperCase();

            addFn(`${lastUpper} ${f3Upper}`);
            addFn(`${lastUpper} ${firstUpper}`);
            addFn(`${lastUpper}`);
            return;
        }

        /* ─── GENERIC 3 PART ─── */
        if (parts.length === 3) {
            const [f, m, l] = parts;
            const f3p = f.slice(0, 3);
            const m1 = m.charAt(0);

            addFn(`${f} ${m} ${l}`);
            addFn(`${l}, ${f}`);
            addFn(`${l}, ${f3p}`);
            addFn(`${l}, ${f} ${m}`);
            addFn(`${l}, ${f} ${m1}`);
            addFn(`${l}, ${m}`);

            if (/^rodriguez$/i.test(l)) {
                addFn(`Rodrigues, ${f}`);
                addFn(`Rodrigues, ${f3p}`);
            }
            return;
        }

        /* ─── GENERIC 4 PART ─── */
        if (parts.length === 4) {
            const [f, , l1, l2] = parts;
            const f3x = first3(f);
            addFn(`${l1} ${l2}, ${f}`);
            addFn(`${l1}${l2}, ${f}`);
            addFn(`${l1}, ${f}`);
            addFn(`${l2}, ${f}`);
            addFn(`${l1} ${l2}, ${f3x}`);
            addFn(`${l1}${l2}, ${f3x}`);
            addFn(`${l1}, ${f3x}`);
            addFn(`${l2}, ${f3x}`);
            return;
        }
    }
}
