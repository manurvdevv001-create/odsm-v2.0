/**
 * Token Engine — Advanced DSL parser and evaluator for student/staff numbering.
 *
 * Supports tokens:
 *   {#}, {##}, {###}, ...   → Numeric sequences (base-10)
 *   {A}, {AA}, {AAA}, ...   → Alphabetic sequences (base-26)
 *   {YY}, {YYYY}            → Year (short/long)
 *   {SY2}, {SY4}            → School year range (25-26 / 2025-2026)
 *   {SYL2}, {SYL4}          → School year start (25 / 2025)
 *   {SYR2}, {SYR4}          → School year end (26 / 2026)
 *   {LEVEL}, {CAT}          → Level or category code
 *   {PREFIX}                → School matricule
 *
 * Modifier functions (applied in order: [fs] → [rnd] → [-]):
 *   [-"O","I"]              → Exclude characters from charset
 *   [rnd{...}]              → Random instead of sequential
 *   [fs{...},"VALUE"]       → Force starting value of sequence
 *
 * Composition example:
 *   CLB-{#}[rnd{###}[-"0"]][fs[rnd{AA}[-"O","I"]],"FG"]
 *   → CLB-0346FG, CLB-1219SA, ...
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface SequenceTokenConfig {
    base: 'numeric' | 'alpha';
    length: number;
    exclusions: string[];
    isRandom: boolean;
    forceStart?: string;
}

export interface TokenSegment {
    type: 'literal' | 'static' | 'sequence';
    text?: string;           // for literal
    staticToken?: string;    // for static: 'YY','YYYY','SY2','SY4','SYL2','SYL4','SYR2','SYR4','LEVEL','PREFIX','CAT'
    sequence?: SequenceTokenConfig;
}

export interface EvalContext {
    activeYear?: number; // The active school year (e.g. 2024 for 2024-2025)
    level?: string;
    category?: string;
    prefix?: string;
}

// ─── Charsets ────────────────────────────────────────────────────────

const NUMERIC_CHARSET = '0123456789';
const ALPHA_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function buildCharset(base: 'numeric' | 'alpha', exclusions: string[]): string {
    const full = base === 'numeric' ? NUMERIC_CHARSET : ALPHA_CHARSET;
    if (!exclusions.length) return full;
    const excSet = new Set(exclusions.map(e => e.toUpperCase()));
    return full.split('').filter(c => !excSet.has(c)).join('');
}

// ─── Value Conversion ────────────────────────────────────────────────

/** Convert a 0-based index to a padded string in the given charset (mixed-radix). */
function indexToValue(index: number, charset: string, length: number): string {
    const base = charset.length;
    if (base === 0) return '?'.repeat(length);
    const capacity = Math.pow(base, length);
    let remaining = ((index % capacity) + capacity) % capacity; // positive mod
    let result = '';
    for (let i = 0; i < length; i++) {
        result = charset[remaining % base] + result;
        remaining = Math.floor(remaining / base);
    }
    return result;
}

/** Convert a value string back to a 0-based index in the given charset. */
function valueToIndex(value: string, charset: string): number {
    const base = charset.length;
    if (base === 0) return 0;
    let result = 0;
    for (const char of value.toUpperCase()) {
        const idx = charset.indexOf(char);
        if (idx === -1) continue;
        result = result * base + idx;
    }
    return result;
}

/** Generate a random string of given length from charset. */
function generateRandom(charset: string, length: number): string {
    if (charset.length === 0) return '?'.repeat(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset[Math.floor(Math.random() * charset.length)];
    }
    return result;
}

// ─── Parser ──────────────────────────────────────────────────────────

const STATIC_TOKENS = new Set([
    'YY', 'YYYY', 
    'SY2', 'SY4', 'SYL2', 'SYL4', 'SYR2', 'SYR4', 
    'LEVEL', 'PREFIX', 'CAT'
]);

class FormatParser {
    private fmt: string;
    private pos: number;

    constructor(format: string) {
        this.fmt = format;
        this.pos = 0;
    }

    parse(): TokenSegment[] {
        const segments: TokenSegment[] = [];
        while (this.pos < this.fmt.length) {
            const c = this.fmt[this.pos];
            if (c === '{') {
                segments.push(this.parseBareToken());
            } else if (c === '[') {
                segments.push(this.parseModifier());
            } else {
                segments.push(this.parseLiteral());
            }
        }
        return segments;
    }

    private parseLiteral(): TokenSegment {
        let text = '';
        while (this.pos < this.fmt.length) {
            const c = this.fmt[this.pos];
            if (c === '{' || c === '[') break;
            text += c;
            this.pos++;
        }
        return { type: 'literal', text };
    }

    /** Parse {TOKEN} and optional trailing [-"x","y"] */
    private parseBareToken(): TokenSegment {
        this.consume('{');
        let content = '';
        while (this.pos < this.fmt.length && this.fmt[this.pos] !== '}') {
            content += this.fmt[this.pos++];
        }
        this.consume('}');

        // Static tokens
        if (STATIC_TOKENS.has(content)) {
            return { type: 'static', staticToken: content };
        }

        // Sequence tokens: {#...} or {A...}
        if (/^#+$/.test(content)) {
            return this.finishSequenceToken('numeric', content.length);
        }
        if (/^A+$/i.test(content)) {
            return this.finishSequenceToken('alpha', content.length);
        }

        // Unknown → treat as literal
        return { type: 'literal', text: `{${content}}` };
    }

    /** After parsing the base token, check for trailing [-...] exclusion. */
    private finishSequenceToken(base: 'numeric' | 'alpha', length: number): TokenSegment {
        let exclusions: string[] = [];
        if (this.lookAhead('[-')) {
            exclusions = this.parseExclusion();
        }
        return {
            type: 'sequence',
            sequence: { base, length, exclusions, isRandom: false },
        };
    }

    /** Parse a modifier: [rnd...], [fs...], or [-"x"] */
    private parseModifier(): TokenSegment {
        if (this.lookAhead('[rnd')) {
            return this.parseRnd();
        }
        if (this.lookAhead('[fs')) {
            return this.parseFs();
        }
        // Unknown bracket → consume as literal until ]
        let text = '';
        while (this.pos < this.fmt.length && this.fmt[this.pos] !== ']') {
            text += this.fmt[this.pos++];
        }
        if (this.pos < this.fmt.length) text += this.fmt[this.pos++]; // consume ]
        return { type: 'literal', text };
    }

    /** Parse [rnd INNER_EXPR ] */
    private parseRnd(): TokenSegment {
        this.pos += 4; // skip "[rnd"
        const inner = this.parseInner();
        this.consume(']');
        if (inner.type === 'sequence' && inner.sequence) {
            inner.sequence.isRandom = true;
        }
        return inner;
    }

    /** Parse [fs INNER_EXPR ,"VALUE"] */
    private parseFs(): TokenSegment {
        this.pos += 3; // skip "[fs"
        const inner = this.parseInner();
        this.consume(',');
        this.consume('"');
        let value = '';
        while (this.pos < this.fmt.length && this.fmt[this.pos] !== '"') {
            value += this.fmt[this.pos++];
        }
        this.consume('"');
        this.consume(']');
        if (inner.type === 'sequence' && inner.sequence) {
            inner.sequence.forceStart = value;
        }
        return inner;
    }

    /** Parse an inner expression: either {TOKEN}[-...] or [modifier...] */
    private parseInner(): TokenSegment {
        if (this.pos < this.fmt.length) {
            if (this.fmt[this.pos] === '{') return this.parseBareToken();
            if (this.fmt[this.pos] === '[') return this.parseModifier();
        }
        return { type: 'literal', text: '' };
    }

    /** Parse [-"x","y",...] */
    private parseExclusion(): string[] {
        this.pos += 2; // skip "[-"
        const exclusions: string[] = [];
        while (this.pos < this.fmt.length && this.fmt[this.pos] !== ']') {
            if (this.fmt[this.pos] === '"') {
                this.pos++; // skip opening "
                let ch = '';
                while (this.pos < this.fmt.length && this.fmt[this.pos] !== '"') {
                    ch += this.fmt[this.pos++];
                }
                this.pos++; // skip closing "
                if (ch) exclusions.push(ch);
            } else {
                this.pos++; // skip , or whitespace
            }
        }
        this.pos++; // skip ]
        return exclusions;
    }

    // ── Helpers ──

    private consume(expected: string): void {
        if (this.pos < this.fmt.length && this.fmt[this.pos] === expected) {
            this.pos++;
        }
    }

    private lookAhead(prefix: string): boolean {
        return this.fmt.substring(this.pos, this.pos + prefix.length) === prefix;
    }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Parse a format string into a list of token segments.
 * Pure function, no side effects.
 */
export function parseFormat(format: string): TokenSegment[] {
    return new FormatParser(format).parse();
}

/**
 * Evaluate parsed token segments to produce an ID string.
 *
 * @param segments  — the parsed format
 * @param counter   — 1-based sequential counter (first student = 1)
 * @param ctx       — static context (year, level, prefix, category)
 * @returns the generated identifier string
 */
export function evaluateSegments(
    segments: TokenSegment[],
    counter: number,
    ctx: EvalContext = {}
): string {
    const year = ctx.activeYear ?? new Date().getFullYear();
    const yearFull = year.toString();
    const yearShort = yearFull.slice(-2);
    
    const nextYear = year + 1;
    const nextYearFull = nextYear.toString();
    const nextYearShort = nextYearFull.slice(-2);

    const levelCode = ctx.level ? ctx.level.substring(0, 3).toUpperCase() : '';
    const catCode = ctx.category ? ctx.category.substring(0, 3).toUpperCase() : '';
    const prefix = ctx.prefix ?? '';

    return segments.map(seg => {
        if (seg.type === 'literal') return seg.text ?? '';

        if (seg.type === 'static') {
            switch (seg.staticToken) {
                case 'YY': return yearShort;
                case 'YYYY': return yearFull;
                case 'SY2': return `${yearShort}-${nextYearShort}`;
                case 'SY4': return `${yearFull}-${nextYearFull}`;
                case 'SYL2': return yearShort;
                case 'SYL4': return yearFull;
                case 'SYR2': return nextYearShort;
                case 'SYR4': return nextYearFull;
                case 'LEVEL': return levelCode;
                case 'CAT': return catCode;
                case 'PREFIX': return prefix;
                default: return '';
            }
        }

        // Sequence token
        const seq = seg.sequence!;
        const charset = buildCharset(seq.base, seq.exclusions);

        if (seq.isRandom) {
            // Random mode: on the very first generation with [fs], use forced value
            if (seq.forceStart && counter === 1) {
                return seq.forceStart;
            }
            return generateRandom(charset, seq.length);
        }

        // Sequential mode
        let effectiveIndex = counter - 1; // 0-based
        if (seq.forceStart) {
            effectiveIndex += valueToIndex(seq.forceStart, charset);
        }
        return indexToValue(effectiveIndex, charset, seq.length);
    }).join('');
}

/**
 * Convenience: parse + evaluate in one call.
 */
export function generateFromFormat(
    format: string,
    counter: number,
    ctx: EvalContext = {}
): string {
    return evaluateSegments(parseFormat(format), counter, ctx);
}
