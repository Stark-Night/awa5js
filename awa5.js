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

const interpreter = function (trace, tokens, stdin, stdout) {
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
        // todo

        cursor = cursor + 1;

        // stop interpreter on too many ops
        executed = executed + 1;
        if (executed >= oplimit) {
            throw new Error('too many operations');
        }
    }

    trace.pop();
    return 0;
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
            return interpreter(this.trace, tokens, this.intake, this.output);
        } catch (e) {
            this.output.push(e);
            for (let i=this.trace.length-1; i>=0; --i) {
                this.output.push(`#${i} ${this.trace[i]}`);
            }
            return this.output;
        }
    }
};
