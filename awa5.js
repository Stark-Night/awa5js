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
        const b = (token >>> 0) % 32; // 31 max value in 5 bits signed
        trace.pop();
        return b;
    },
    parameterized: (trace, opcode) => {
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
        return b;
    },

    name: (opcode) => {
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
        case OPCODES.EQZ: return 'EQZ';
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
          .toLocaleLowerCase();

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
            value = value << 1;
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
        return (1 === this.backing.length) ? 0 : this.backing.length;
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

        this.stdout.write(out);

        trace.pop();
        return null;
    }

    async read(trace) {
        trace.push('InOut.read');
        let line = await this.stdin.read();
        if (!line || 0 === line.length) {
            // if there are no lines provide a string nonetheless
            line = '0';
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
        return new Bubble(line);
    }

    writeRaw(trace, bubble) {
        trace.push('InOut.writeRaw');
        let out = `${bubble.value()}`;

        this.stdout.write(out);

        trace.pop();
        return null;
    }

    async readRaw(trace) {
        trace.push('InOut.read');
        let line = await this.stdin.read();
        if (!line || 0 === line.length) {
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
        return new Bubble(line);
    }
}

class Abysser {
    constructor(abyss) {
        this.abyss = abyss;
    }

    submerge(trace, input) {
        trace.push('Abysser.submerge');
        const value = this.abyss.pop();

        if (0 === input) {
            this.abyss.unshift(value);
        } else {
            // warning: can be slow in some cases
            this.abyss.splice(this.abyss.length - input, 0, value);
        }

        trace.pop();
        return null;
    }

    pop(trace, input) {
        trace.push('Abysser.pop');
        if (false === input.isDouble()) {
            return null;
        }

        const bubbles = [];
        for (let v of input.value()) {
            bubbles.push(new Bubble(v));
        }

        trace.pop();
        return bubbles;
    }

    duplicate(trace, input) {
        trace.push('Abysser.duplicate');
        const bubbles = [input, input.clone()];

        trace.pop();
        return bubbles;
    }

    surround(trace, input) {
        trace.push('Abysser.surround');
        const bubble = new Bubble();

        for (let i=0; i<input; ++i) {
            bubble.merge(this.abyss.pop());
        }

        trace.pop();
        return bubble;
    }

    merge(trace, b1, b2) {
        trace.push('Abysser.merge');
        const bubble = b1;

        if (false === b1.isDouble() && false === b2.isDouble()) {
            // merge two single bubble into one double bubble
            const v1 = b1.value();
            const v2 = b2.value();

            bubble = new Bubble([v2, v1]);
        } else {
            bubble.merge(input[1]);
        }

        trace.pop();
        return bubble;
    }
}

class Arith {
    static add(trace, b1, b2) {
        trace.push('Arith.add');
        let result = null;

        const b1double = b1.isDouble();
        const b2double = b2.isDouble();
        const b1v = b1.value();
        const b2v = b2.value();

        if (false === b1double && false === b2double) {
            // two single bubbles
            result = new Bubble(b1v + b2v);
        } else if (true === b1double && false === b2double) {
            // first bubble is double
            result = new Bubble(b1v.map((e) => (e + b2v)));
        } else if (false === b1double && true === b2double) {
            // second bubble is double
            result = new Bubble(b2v.map((e) => (e + b1v)));
        } else if (true === b1double && true === b2double) {
            // all bubbles are double
            const values = [];
            const len = Math.min(b1.size(), b2.size());
            for (let i=0; i<len; ++i) {
                values.push(b1v[i] + b2v[i]);
            }
            result = new Bubble(...values);
        }

        trace.pop();
        return result;
    }

    static sub(trace, b1, b2) {
        trace.push('Arith.sub');
        let result = null;

        const b1double = b1.isDouble();
        const b2double = b2.isDouble();
        const b1v = b1.value();
        const b2v = b2.value();

        if (false === b1double && false === b2double) {
            // two single bubbles
            result = new Bubble(b1v - b2v);
        } else if (true === b1double && false === b2double) {
            // first bubble is double
            result = new Bubble(b1v.map((e) => (e - b2v)));
        } else if (false === b1double && true === b2double) {
            // second bubble is double
            result = new Bubble(b2v.map((e) => (e - b1v)));
        } else if (true === b1double && true === b2double) {
            // all bubbles are double
            const values = [];
            const len = Math.min(b1.size(), b2.size());
            for (let i=0; i<len; ++i) {
                values.push(b1v[i] - b2v[i]);
            }
            result = new Bubble(...values);
        }

        trace.pop();
        return result;
    }

    static mul(trace, b1, b2) {
        trace.push('Arith.mul');
        let result = null;

        const b1double = b1.isDouble();
        const b2double = b2.isDouble();
        const b1v = b1.value();
        const b2v = b2.value();

        if (false === b1double && false === b2double) {
            // two single bubbles
            result = new Bubble(b1v * b2v);
        } else if (true === b1double && false === b2double) {
            // first bubble is double
            result = new Bubble(b1v.map((e) => (e * b2v)));
        } else if (false === b1double && true === b2double) {
            // second bubble is double
            result = new Bubble(b2v.map((e) => (e * b1v)));
        } else if (true === b1double && true === b2double) {
            // all bubbles are double
            const values = [];
            const len = Math.min(b1.size(), b2.size());
            for (let i=0; i<len; ++i) {
                values.push(b1v[i] * b2v[i]);
            }
            result = new Bubble(...values);
        }

        trace.pop();
        return result;
    }

    static div(trace, b1, b2) {
        trace.push('Arith.div');
        let result = null;

        const b1double = b1.isDouble();
        const b2double = b2.isDouble();
        const b1v = b1.value();
        const b2v = b2.value();

        if (false === b1double && false === b2double) {
            // two single bubbles
            result = new Bubble(...Arith.bubblediv(bv1, bv2));
        } else if (true === b1double && false === b2double) {
            // first bubble is double
            result = new Bubble(b1v.map((e) => (new Bubble(...Arith.bubblediv(e, b2v)))));
        } else if (false === b1double && true === b2double) {
            // second bubble is double
            result = new Bubble(b2v.map((e) => (new Bubble(...Arith.bubblediv(e, b1v)))));
        } else if (true === b1double && true === b2double) {
            // all bubbles are double
            const values = [];
            const len = Math.min(b1.size(), b2.size());
            for (let i=0; i<len; ++i) {
                values.push(new Bubble(...Arith.bubblediv(b1v[i], b2v[i])));
            }
            result = new Bubble(...values);
        }

        trace.pop();
        return result;
    }

    static bubblediv(trace, v1, v2) {
        trace.push('Arith.bubblediv');
        let division = v1 / v2;
        division = (division < 0) ? Math.ceil(division) : Math.floor(division);

        let remainder = v1 % v2;

        trace.pop();
        return [remainder, division];
    }
}

class Comparator {
    static equal(trace, b1, b2) {
        trace.push('Comparator.equal');
        let result = false;

        const b1double = b1.isDouble();
        const b2double = b2.isDouble();
        const b1v = b1.value();
        const b2v = b2.value();

        if ((true === b1double && false === b2double)
            || (false === b1double && true === b2double)) {
            // single and double bubbles are always different
            result = false;
        } else if (true === b1double && true === b2double) {
            // double bubbles are compared in every value
            if (b1.size() !== b2.size()) {
                // different sizes make bubbles different
                result = false;
            } else {
                result = true;

                const bsize = b1.size();
                for (let i=0; i<bsize && true===result; ++i) {
                    if (b1v[i] === b2v[i]) {
                        continue;
                    }

                    result = false;
                }
            }
        } else {
            result = (b1v === b2v);
        }

        trace.pop();
        return result;
    }

    static less(trace, b1, b2) {
        trace.push('Comparator.less');
        let result = false;

        // only single bubbles can be sorted in a less-than order
        // vectors (double bubbles) have many edge cases in their
        // sorting and it's not worth it without a generic comparator
        // function
        if (false === b1.isDouble() && false === b2.isDouble()) {
            result = (b1.value() < b2.value());
        }

        trace.pop();
        return result;
    }

    static greater(trace, b1, b2) {
        trace.push('Comparator.greater');
        let result = false;

        // only single bubbles can be sorted in a greater-than order
        // vectors (double bubbles) have many edge cases in their
        // sorting and it's not worth it without a generic comparator
        // function
        if (false === b1.isDouble() && false === b2.isDouble()) {
            result = (b1.value() < b2.value());
        }

        trace.pop();
        return result;
    }

    static zero(trace, b1) {
        trace.push('Comparator.zero');
        let result = false;

        // only single bubbles can be compared with the single value 0
        if (false === b1.isDouble()) {
            result = (0 === b1.value());
        }

        trace.pop();
        return result;
    }
};

const interpreter = async function (trace, abyss, tokens, stdin, stdout) {
    trace.push('interpreter');

    // limit the number of executed operations to avoid infinite loops
    const oplimit = 10000;
    let executed = 0;

    // register jump labels
    // warning: slow because it traverses all tokens before execution
    const labels = [];
    for (let i=0; i<tokens.length; ++i) {
        if (OPCODES.get(trace, tokens[i]) === OPCODES.LBL) {
            if (undefined === tokens[i + 1]) {
                throw new OpcodeError(tokens[i], 'not enough arguments');
            }
            labels[tokens[i + 1]] = i + 1;
        }

        if (OPCODES.parameterized(trace, tokens[i])) {
            i = i + 1;
        }
    }

    // handle in/out
    const inout = new InOut(stdin, stdout);

    // handle bubble juggling
    const abysser = new Abysser(abyss);

    // execute the tokens
    let cursor = 0;
    let result = null;
    while (cursor < tokens.length) {
        const code = OPCODES.get(trace, tokens[cursor]);
        trace.push(OPCODES.name(code));

        switch (code) {
        case OPCODES.NOP:
            // nop = no operations...
            break;
        case OPCODES.PRN:
            if (0 === abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = inout.write(trace, abyss.pop());
            break;
        case OPCODES.PR1:
            if (0 === abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = inout.writeRaw(trace, abyss.pop());
            break;
        case OPCODES.RED:
            result = await inout.read(trace);
            break;
        case OPCODES.R3D:
            result = await inout.readRaw(trace);
            break;
        case OPCODES.BLO:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            result = new Bubble(tokens[cursor + 1]);
            cursor = cursor + 1;
            break;
        case OPCODES.SBM:
            if (undefined  === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            result = abysser.submerge(trace, tokens[cursor + 1]);
            cursor = cursor + 1;
            break;
        case OPCODES.POP:
            if (0 === abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = abysser.pop(trace, abyss.pop());
            break;
        case OPCODES.DPL:
            if (0 === abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = abysser.duplicate(trace, abyss.pop());
            break;
        case OPCODES.SRN:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            if (tokens[cursor + 1] > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = abysser.surround(trace, tokens[cursor + 1]);
            cursor = cursor + 1;
            break;
        case OPCODES.MRG:
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = abysser.merge(trace, abyss.pop(), abyss.pop());
            break;
        case OPCODES.DD4:
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = Arith.add(trace, abyss.pop(), abyss.pop());
            break;
        case OPCODES.SUB:
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = Arith.sub(trace, abyss.pop(), abyss.pop());
            break;
        case OPCODES.MUL:
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = Arith.mul(trace, abyss.pop(), abyss.pop());
            break;
        case OPCODES.DIV:
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = Arith.div(trace, abyss.pop(), abyss.pop());
            break;
        case OPCODES.CNT:
            if (0 === abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            result = new Bubble(abyss[abyss.length - 1].size());
            break;
        case OPCODES.LBL:
            // labels are already handled here; simply jump the argument
            cursor = cursor + 1;
            break;
        case OPCODES.JMP:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            if (undefined === labels[tokens[cursor + 1]]) {
                // unregistered labels are ignored instead of singaling an error
                cursor = cursor + 1;
            } else {
                cursor = labels[tokens[cursor + 1]];
            }
            break;
        case OPCODES.EQL:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            if (true === Comparator.equal(trace, abyss[abyss.length - 1], abyss[abyss.length - 2])
                && undefined !== labels[tokens[cursor + 1]]) {
                cursor = labels[tokens[cursor + 1]];
            } else {
                cursor = cursor + 1;
            }
            break;
        case OPCODES.LSS:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            if (true === Comparator.less(trace, abyss[abyss.length - 1], abyss[abyss.length - 2])
                && undefined !== labels[tokens[cursor + 1]]) {
                cursor = labels[tokens[cursor + 1]];
            } else {
                cursor = cursor + 1;
            }
            break;
        case OPCODES.GR8:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            if (2 > abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            if (true === Comparator.greater(trace, abyss[abyss.length - 1], abyss[abyss.length - 2])
                && undefined !== labels[tokens[cursor + 1]]) {
                cursor = labels[tokens[cursor + 1]];
            } else {
                cursor = cursor + 1;
            }
            break;
        case OPCODES.EQZ:
            if (undefined === tokens[cursor + 1]) {
                throw new OpcodeError(tokens[cursor], 'not enough arguments');
            }
            if (0 === abyss.length) {
                throw new OpcodeError(tokens[cursor], 'not enough bubbles');
            }
            if (true === Comparator.zero(trace, abyss[abyss.length - 1])
                && undefined !== labels[tokens[cursor + 1]]) {
                cursor = labels[tokens[cursor + 1]];
            } else {
                cursor = cursor + 1;
            }
            break;
        case OPCODES.TRM:
            // pushing the cursor out of the tokens size terminates the program
            cursor = tokens.length;
            break;
        default:
            throw new OpcodeError(tokens[cursor], 'invalid opcode');
        }

        trace.pop();

        // push result into the abyss, if any
        if (null !== result) {
            try {
                abyss.push(...result);
            } catch {
                abyss.push(result);
            }
        }

        result = null;
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

class ArrayReader {
    constructor(backing) {
        this.backing = [...backing];
        this.line = -1;
    }

    async read() {
        this.line = this.line + 1;
        return (undefined === this.backing[this.line]) ? '' : this.backing[this.line];
    }

    reset() {
        this.line = -1;
    }
};

class DOMReader {
    constructor(node, actor) {
        this.backing = node;
        this.button = actor;
    }

    async read() {
        let listener = null;
        let promise = new Promise((resolve, reject) => {
            listener = (e) => { resolve(this.backing.value); };

            this.button.addEventListener('click', listener);
        });

        // "block" the script/interpreter until the click listener on actor/button is executed
        const value = await promise;

        this.button.removeEventListener('click', listener);

        return value;
    }

    reset() {
        // nothing to reset, but it keeps the interface uniform
    }
};

class ArrayWriter {
    constructor(backing) {
        this.backing = backing;
    }

    write(line) {
        this.backing.push(line);
    }
};

class DOMWriter {
    constructor(node) {
        const tag = node.tagName.toLowerCase();

        switch (tag) {
        case 'input':
            if ('text' !== node.type) {
                throw new TypeError('not a valid DOM node');
            }
            break;
        case 'textarea':
        case 'div':
        case 'span':
        case 'p':
        case 'pre':
            break;
        default:
            throw new TypeError('not a valid DOM node');
        }

        this.backing = node;
    }

    write(line) {
        if (0 === line.length) {
            return;
        }

        const towrite = `${line}`.replace(/\n/g, '<br/>');
        switch (this.backing.tagName.toLowerCase()) {
        case 'input':
        case 'textarea':
            this.backing.value += towrite;
            break;
        default:
            this.backing.innerHTML += towrite;
            break;
        }
    }
};

export default class AWA5 {
    constructor() {
        // global stack
        this.abyss = [];

        // execution stack trace
        this.trace = [];

        // input by line
        this.intake = new ArrayReader([]);

        // output by line
        this.output = new ArrayWriter([]);
    }

    async run(input) {
        try {
            const tokens = parser(this.trace, input);
            const result = await interpreter(this.trace, this.abyss, tokens, this.intake, this.output);
            this.intake.reset(); // allow repeating the program as-is
            return result;
        } catch (e) {
            this.output.write(e);
            for (let i=this.trace.length-1; i>=0; --i) {
                this.output.write(`#${i} ${this.trace[i]}`);
            }
            return 1;
        }
    }

    setInputReader(reader) {
        if (false === reader instanceof ArrayReader && false === reader instanceof DOMReader) {
            throw new TypeError('not a valid reader');
        }

        this.intake = reader;
        return this;
    }

    setOutputWriter(writer) {
        if (false === writer instanceof ArrayWriter && false === writer instanceof DOMWriter) {
            throw new TypeError('not a valid reader');
        }

        this.output = writer;
        return this;
    }

    static reader(options) {
        if (!options || 'object' !== typeof options) {
            return new ArrayReader([]);
        }

        if (options.buffer) {
            if ('object' === typeof options.buffer) {
                return new ArrayReader(options.buffer);
            }

            return new ArrayReader([]);
        }

        if (options.node && options.actor) {
            return new DOMReader(options.node, options.actor);
        }

        return new ArrayReader([]);
    }

    static writer(options) {
        if (!options || 'object' !== typeof options) {
            return new ArrayWriter([]);
        }

        if (options.buffer) {
            if ('object' === typeof options.buffer) {
                return new ArrayWriter(options.buffer);
            }

            return new ArrayWriter([]);
        }

        if (options.node) {
            return new DOMWriter(options.node);
        }

        return new ArrayWriter([]);
    }
};
