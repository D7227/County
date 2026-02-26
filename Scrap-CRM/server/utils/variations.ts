export function generateVariations(rawName: string | undefined | null): string[] {
    const variations = new Set<string>();

    if (!rawName || !rawName.trim()) {
        return [];
    }

    const name = rawName
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\b(JR|SR|II|III|IV)\b\.?/gi, "")
        .trim();

    // Detect patterns (SAFE)
    const isCompany = /\b(LLC|INC|CORP|CO|HOLDINGS|LTD|PC|PLLC)\b/i.test(name);
    const isTrust = /\b(TRUST|REVOCABLE|ESTATE)\b/i.test(name);
    const isPartnership = /\s(&|AND)\s/i.test(name);
    const isHyphen = /-/.test(name);
    const isMarried = /\(.*\)/.test(name);

    /* ================= COMPANY ================= */
    if (isCompany) {
        variations.add(name);
        variations.add(name.replace(/\./g, ""));
        variations.add(name.replace(/LLC/i, "L.L.C."));
        variations.add(name.replace(/LLC/i, "LC"));
        variations.add(name.replace(/LLC/i, ""));
        variations.add(name.replace(/\s+/g, "-"));
        variations.add(name.replace(/LLC/i, "Inc"));
        variations.add(name.replace(/LLC/i, "Corp"));
    }

    /* ================= TRUST / ESTATE ================= */
    else if (isTrust) {
        const parts = name.split(" ");
        const first = parts[0];
        const last = parts[1] || first;

        variations.add(`${last}, ${first}`);
        variations.add(`${last}, ${first} Trustee`);
        variations.add(`${first} ${last} Trust`);
        variations.add(`${last} Family Trust`);
        variations.add(`Estate of ${first} ${last}`);
    }

    /* ================= PARTNERSHIP ================= */
    else if (isPartnership) {
        variations.add(name);
        variations.add(name.replace("&", "and"));
        variations.add(name.replace(/\s(&|AND)\s/i, " "));
        variations.add(`${name} LLP`);
    }

    /* ================= HYPHENATED ================= */
    else if (isHyphen) {
        const [p1, p2] = name.split("-").map(p => p.trim());

        variations.add(name);
        variations.add(`${p1} ${p2}`);
        variations.add(`${p2}, ${p1}`);
        variations.add(`${p2}-${p1}`);
        variations.add(`${p2} ${p1}`);
    }

    /* ================= MARRIED / ALIAS ================= */
    else if (isMarried) {
        const clean = name.replace(/\(.*\)/g, "").trim();
        variations.add(clean);
    }

    /* ================= INDIVIDUAL ================= */
    else {
        const parts = name.split(" ");

        if (parts.length === 2) {
            const [first, last] = parts;

            variations.add(name);
            variations.add(`${last}, ${first}`);
            variations.add(`${last} ${first}`);
            variations.add(`${last}, ${first.charAt(0)}`);
            variations.add(`${first.charAt(0)} ${last}`);
        }

        else if (parts.length === 3) {
            const [first, middle, last] = parts;

            variations.add(`${first} ${middle} ${last}`);
            variations.add(`${first} ${middle.charAt(0)} ${last}`);
            variations.add(`${first.charAt(0)} ${last}`);
            variations.add(`${last}, ${first}`);
            variations.add(`${last}, ${first} ${middle}`);
            variations.add(`${last}, ${first} ${middle.charAt(0)}`);
            variations.add(`${first.charAt(0)}${middle.charAt(0)} ${last}`);
        }

        else if (parts.length === 4) {
            // Hispanic / compound surnames
            variations.add(`${parts[2]}, ${parts[0]}`);
            variations.add(`${parts[2]} ${parts[3]}, ${parts[0]}`);
            variations.add(`${parts[0]} ${parts[2]}`);
        }

        else {
            variations.add(name);
        }
    }

    return Array.from(variations).filter(Boolean);
}
