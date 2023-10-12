const OPCODES = {
    NOP: 0,
    PRN: 1,
    PR1: 2,
    RED: 3,
    R3D: 4,
    BLO: 5,
    SBM: 6,
    POP: 7,
    DPL: 8,
    SRN: 9,
    MRG: 10,
    DD4: 11,
    SUB: 12,
    MUL: 13,
    DIV: 14,
    CNT: 15,
    LBL: 16,
    JMP: 17,
    EQL: 18,
    LSS: 19,
    GR8: 20,
    EQZ: 21,
    TRM: 31,

    // utility functions
    get: (trace, token) => {
        trace.push('OPCODES.get');
        const b = (n >>> 0) % 32; // 31 max value in 5 bits signed
        trace.pop();
        return b;
    },
    parameterized: (trace, opcode) {
        trace.push('OPCODES.parameterized');
        let b = false;

        switch (opcode) {
        case OPCODES.BLO:
        case OPCODES.SBM:
        case OPCODES.SRN:
        case OPCODES.LBL:
        case OPCODES.JMP:
        case OPCODES.EQL:
        case OPCODES.LSS:
        case OPCODES.GR8:
        case OPCODES.EQZ:
            b = true;
            break;
        default:
            break;
        }

        trace.pop();
        const b;
    },

    name: (opcode) {
        let n = `${opcode}`;

        switch (opcode) {
        case OPCODES.NOP: return 'NOP';
        case OPCODES.PRN: return 'PRN';
        case OPCODES.PR1: return 'PR1';
        case OPCODES.RED: return 'RED';
        case OPCODES.R3D: return 'R3D';
        case OPCODES.BLO: return 'BLO';
        case OPCODES.SBM: return 'SBM';
        case OPCODES.POP: return 'POP';
        case OPCODES.DPL: return 'DPL';
        case OPCODES.SRN: return 'SRN';
        case OPCODES.MRG: return 'MRG';
        case OPCODES.DD4: return '4DD';
        case OPCODES.SUB: return 'SUB';
        case OPCODES.MUL: return 'MUL';
        case OPCODES.DIV: return 'DIV';
        case OPCODES.CNT: return 'CNT';
        case OPCODES.LBL: return 'LBL';
        case OPCODES.JMP: return 'JMP';
        case OPCODES.EQL: return 'EQL';
        case OPCODES.LSS: return 'LSS';
        case OPCODES.GR8: return 'GR8';
        case OPCODES.TRM: return 'TRM';
        default:
            break;
        }

        return n;
    },
};

const parser = function (trace, input) {
    trace.push('parser');

    // sanitize
    // warning: slow as molasses especially on large strings
    const cleaned = input
          .replace(/[^aw~\s]+/gi, '')
          .replace(/[\n\s]+/g, ' ')
          .toLocaleLowercase();

    // find start of block
    let cursor = cleaned.search(/awa\s*/);
    if (-1 === cursor) {
        throw new SyntaxError('missing start of block');
    }
    cursor = cursor + 3;

    // parsed tokens
    const tokens = [];

    // state for the machine
    let bits = 0;
    let target = 5;
    let value = 0;
    let parameter = false;

    // read tokens
    // warning: also slow, but doing things properly is too much code
    while (cursor < cleaned.length - 1) {
        if ('wa' === cleaned.substring(cursor, cursor + 2)) {
            // wa is 1
            value = << 1;
            value = value + 1;
            cursor = cursor + 2;
        } else if (' awa' === cleaned.substring(cursor, cursor + 4)) {
            // awa is 0
            // mind the space in front
            value = value << 1;
            cursor = cursor + 4;
        } else if (' ~wa' === cleaned.substring(cursor, cursor + 4) && 0 === bits) {
            // ~wa is -1
            // mind the space in front
            // it can appear only as the first bit; doesn't make sense in other places
            value = -1;
            cursor = cursor + 4;
        } else {
            throw new SyntaxError(`malformed input (${cursor})`);
        }

        bits = bits + 1;

        if (bits >= target) {
            // add token to list
            tokens.push(value);

            // reset machine state
            bits = 0;
            if (true === parameter) {
                target = 5;
                value = 0;
                parameter = false;
                continue;
            }

            switch (OPCODES.get(trace, value)) {
            case OPCODES.BLO:
            case OPCODES.SBM:
            case OPCODES.SRN:
            case OPCODES.LBL:
            case OPCODES.JMP:
            case OPCODES.EQL:
            case OPCODES.LSS:
            case OPCODES.GR8:
            case OPCODES.EQZ:
                // parameterized opcode
                parameter = true;
                target = 8;
                break;
            default:
                break;
            }

            value = 0;
        }
    }

    trace.pop();
    return tokens;
};

class OpcodeError extends Error {
    constructor(opcode, message, ...params) {
        super(`(${OPCODES.name(opcode)}) ${message}`, ...params);
        this.name = 'OpcodeError';
    }
};

class LimitError extends Error {
    constructor(...params) {
        super(...params);
        this.name = 'LimitError';
    }
};

class Bubble {
    constructor(...values) {
        this.backing = [...values];
    }

    value() {
        if (this.backing.length > 1) {
            // clone to avoid phantom edits
            // it's obviously expensive
            return [...this.backing];
        }

        if (0 === this.backing.length) {
            // ensure we always have a value
            // 0 is not necessarily the correct value
            return 0;
        }

        return this.backing[0];
    }

    merge(bubble) {
        const v = bubble.value();

        try {
            this.backing.unshift(...v);
        } catch {
            this.backing.unshift(v);
        }

        return this;
    }

    clone() {
        return new Bubble(...this.backing);
    }

    isDouble() {
        return this.backing.length > 1;
    }

    size() {
        return this.backing.length;
    }
};

class InOut {
    constructor(stdin, stdout) {
        this.stdin = stdin;
        this.stdout = stdout;

        this.ALPHABET = 'AWawJELYHOSIUMjelyhosiumPCNTpcntBDFGRbdfgr0123456789 .,!\'()~_/;\n';
    }

    letter(trace, v) {
        trace.push('InOut.letter');
        let letter = v;

        if ('string' !== typeof v) {
            if (v < 0 || v > this.ALPHABET.length) {
                throw new RangeError(`index ${v} out of range`);
            }

            letter = this.ALPHABET[v];
        }

        trace.pop();
        return letter;
    }

    write(trace, bubble) {
        trace.push('InOut.write');
        let out = '';
        if (bubble.isDouble()) {
            // write all values of double bubbles as single string
            out = bubble.value().map((e) => (this.letter(trace, e))).join('');
        } else {
            out = this.letter(trace, bubble.value());
        }

        this.stdout.push(out);

        trace.pop();
        return null;
    }

    read(trace) {
        trace.push('InOut.read');
        let line = this.stdin.pop();
        if (!line) {
            // if there are no lines provide a string nonetheless
            line = '';
        } else {
            // validate the given characters
            const split = this.ALPHABET.split('');
            const cache = [];
            let invalid = false;

            for (let i=0; i<line.length && false===invalid; ++i) {
                // fast check when multiple occurrences
                if (cache[line[i]]) {
                    continue;
                }

                // warning: includes is somewhat slow
                if (split.includes(line[i])) {
                    cache[line[i]] = true;
                    continue;
                }

                invalid = true;
            }

            if (true === invalid) {
                throw new RangeError(`'${line}' contains invalid characters`);
            }
        }

        trace.pop();
        return line;
    }

    writeRaw(trace, bubble) {
        trace.push('InOut.writeRaw');
        let out = `${bubble.value()}`;

        this.stdout.push(out);

        trace.pop();
        return null;
    }

    readRaw(trace) {
        trace.push('InOut.read');
        let line = this.stdin.pop();
        if (!line) {
            // if there are no lines provide a number nonetheless
            line = 0;
        } else {
            const v = parseInt(line);
            if (isNaN(v)) {
                throw new TypeError(`'${line}' is not a number`);
            }
            line = v;
        }

        trace.pop();
        return line;
    }
}

const interpreter = function (trace, abyss, tokens, stdin, stdout) {
    trace.push('interpreter');

    // limit the number of executed operations to avoid infinite loops
    const oplimit = 10000;
    let executed = 0;

    // register jump labels
    // warning: slow because it traverses all tokens before execution
    const labels = [];
    for (let i=0; i<tokens.length; ++i) {
        if (OPCODES.get(trace, tokens[i]) === OPCODES.LBL) {
            labels[tokens[i + 1]] = i + 1;
        }

        if (OPCODES.parameterized(trace, tokens[i])) {
            i = i + 1;
        }
    }

    // execute the tokens
    let cursor = 0;
    let result = null;
    while (cursor < tokens.length) {
        const code = OPCODES.get(trace, tokens[cursor]);
        trace.push(OPCODE.name(code));

        switch (code) {
        case OPCODES.NOP:
            break;
        case OPCODES.PRN:
            break;
        case OPCODES.PR1:
            break;
        case OPCODES.RED:
            break;
        case OPCODES.R3D:
            break;
        case OPCODES.BLO:
            break;
        case OPCODES.SBM:
            break;
        case OPCODES.POP:
            break;
        case OPCODES.DPL:
            break;
        case OPCODES.SRN:
            break;
        case OPCODES.MRG:
            break;
        case OPCODES.DD4:
            break;
        case OPCODES.SUB:
            break;
        case OPCODES.MUL:
            break;
        case OPCODES.DIV:
            break;
        case OPCODES.CNT:
            break;
        case OPCODES.LBL:
            break;
        case OPCODES.JMP:
            break;
        case OPCODES.EQL:
            break;
        case OPCODES.LSS:
            break;
        case OPCODES.GR8:
            break;
        case OPCODES.TRM:
            break;
        default:
            throw new OpcodeError(tokens[cursor], 'invalid opcode');
        }

        trace.pop();
        cursor = cursor + 1;

        // stop interpreter on too many ops
        executed = executed + 1;
        if (executed >= oplimit) {
            throw new LimitError('too many operations');
        }
    }

    // use last value in the abyss as return value, if it exists
    const retval = (abyss.length > 0) ? abyss.pop().value() : 0;
    // reset the abyss so the interpreter can run other programs
    abyss.splice(0, abyss.length);

    trace.pop();
    return retval;
};

export default class AWA5 {
    constructor() {
        // global stack
        this.abyss = [];

        // execution stack trace
        this.trace = [];

        // input by line
        this.intake = [];

        // output by line
        this.output = [];
    }

    run(input) {
        try {
            const tokens = parser(this.trace, input);
            return interpreter(this.trace, this.abyss, tokens, this.intake, this.output);
        } catch (e) {
            this.output.push(e);
            for (let i=this.trace.length-1; i>=0; --i) {
                this.output.push(`#${i} ${this.trace[i]}`);
            }
            return 1;
        }
    }
};
