// Copyright 2023 Starknight Group

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Operations recognized by the interpreter.
 */
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

    /**
     * Get an opcode from a possibly signed value.
     *
     * This function will coerce every value within the interval of
     * known opcodes, so if a token representing an argument, rather
     * than a real opcode, is given as a value, the result is
     * undefined.
     *
     * The interpreter might not know how to handle the returned
     * opcode.
     *
     * @param trace interpreter stack trace
     * @param token signed value to transform
     * @returns an opcode
     */
    get: (trace, token) => {
        trace.push('OPCODES.get');
        const b = (token >>> 0) % 32; // 31 max value in 5 bits signed
        trace.pop();
        return b;
    },

    /**
     * Tell whether an opcode expects a parameter.
     *
     * With parameterized opcodes the interpreter has to jump two
     * tokens after executing the opcode.
     *
     * @param trace interpreter stack trace
     * @param opcode the opcode to test
     * @returns false if it is not parameterized
     */
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

    /**
     * Get a human-readable representation of the opcode.
     *
     * Effectively the `toString` method of opcodes, the other name
     * was too long.
     *
     * If an opcode is not recognized it is returned as-is within a
     * string, i.e. it will be a string spelling a number.
     *
     * @param opcode the opcode to get the name of
     * @returns the opcode's name
     */
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

/**
 * Transform a string into a sequence of tokens.
 *
 * Tokens are just numbers which the interpreter will then execute as
 * much as possible.
 *
 * @param trace interpreter stack trace
 * @param input the string to parse
 * @returns a sequence of tokens
 * @throws a syntax error if the input is malformed
 */
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

/**
 * Error thrown during opcode execution.
 */
class OpcodeError extends Error {
    /**
     * @param opcode the opcode generating the error
     * @param message the user-facing message
     * @param ...params rest of arguments
     */
    constructor(opcode, message, ...params) {
        super(`(${OPCODES.name(opcode)}) ${message}`, ...params);
        this.name = 'OpcodeError';
    }
};

/**
 * Error thrown when certain limits are exeeded.
 */
class LimitError extends Error {
    /**
     * @param message the user-facing message
     * @param ...params rest of arguments 
     */
    constructor(message, ...params) {
        super(message, ...params);
        this.name = 'LimitError';
    }
};

/**
 * Wrapper around a value.
 *
 * The interpreter operates on bubbles not raw values, as that is the
 * language semantics.
 */
class Bubble {
    /**
     * @param ...values initial values of the bubble
     */
    constructor(...values) {
        this.backing = [...values];
    }

    /**
     * Get the raw value stored inside the bubble.
     *
     * If the bubble has multiple values, these values will be
     * returned within a new array.
     *
     * @returns a value, 0 by default
     */
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

    /**
     * Merge the given bubble's contents inside this bubble.
     *
     * @param bubble the bubble to merge
     * @returns self
     */
    merge(bubble) {
        const v = bubble.value();

        try {
            this.backing.unshift(...v);
        } catch {
            this.backing.unshift(v);
        }

        return this;
    }

    /**
     * Generate a new bubble with the same values as this bubble.
     *
     * @returns a new bubble
     */
    clone() {
        return new Bubble(...this.backing);
    }

    /**
     * Tell whether the bubble has more than one value.
     *
     * @returns false if the bubble has only one value
     */
    isDouble() {
        return this.backing.length > 1;
    }

    /**
     * Return the size of the bubble.
     *
     * By definition bubbles with only one value inside have a size of
     * 0, therefore it is an error to have bubbles of size 1.
     *
     * @returns the bubble's size
     */
    size() {
        return (1 === this.backing.length) ? 0 : this.backing.length;
    }
};

/**
 * Provide functions to handle opcode input and output.
 */
class InOut {
    /**
     * @param stdin an input reader
     * @param stdout an output writer
     */
    constructor(stdin, stdout) {
        this.stdin = stdin;
        this.stdout = stdout;

        this.ALPHABET = 'AWawJELYHOSIUMjelyhosiumPCNTpcntBDFGRbdfgr0123456789 .,!\'()~_/;\n';
    }

    /**
     * Get the letter associated with the given value.
     *
     * The alphabet is limited per specifications of the language, so
     * any values outside the specified range will generate an error.
     *
     * @param trace intepreter stack trace
     * @param v the value to transform
     * @returns the associated letter
     * @throws a range error if the value is not in the alphabet
     */
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

    /**
     * Write the contents of a bubble as a string.
     *
     * The string representation is obtained by transforming each
     * number into the associated letter.
     *
     * @param trace interpreter stack trace
     * @param bubble the bubble to write
     * @returns null
     */
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

    /**
     * Read a string provided by the user.
     *
     * While reading, numbers are converted to letters of the known
     * alphabet; to read actual numbers use `readRaw`.
     *
     * If the reader gives an empty line, the string `'0'` is
     * returned.
     *
     * @param trace interpreter stack trace
     * @returns new bubble with the value
     */
    async read(trace) {
        trace.push('InOut.read');
        let line = await this.stdin.read();
        if (!line || 0 === line.length) {
            // if there are no lines provide a string nonetheless
            line = ['0'];
        } else {
            // validate the given characters
            const split = this.ALPHABET.split('');
            const cache = [];
	    const collected = [];
            let invalid = false;

            for (let i=0; i<line.length && false===invalid; ++i) {
                // fast check when multiple occurrences
                if (cache[line[i]]) {
		    collected.push(line[i]);
                    continue;
                }

                // warning: includes is somewhat slow
                if (split.includes(line[i])) {
                    cache[line[i]] = true;
		    collected.push(line[i]);
                    continue;
                }

                invalid = true;
            }

            if (true === invalid) {
                throw new RangeError(`'${line}' contains invalid characters`);
            }

	    line = collected;
        }

        trace.pop();
        return new Bubble(...line);
    }

    /**
     * Writes the contents of a bubble as a number or array.
     *
     * The actual format of the output is left to Javascript's own
     * built-in toString functions.
     *
     * @param trace interpreter stack trace
     * @param bubble the bubble to write
     * @returns null
     */
    writeRaw(trace, bubble) {
        trace.push('InOut.writeRaw');
        let out = `${bubble.value()}`;

        this.stdout.write(out);

        trace.pop();
        return null;
    }

    /**
     * Read a number provided by the user.
     *
     *
     * If the reader gives an empty line, the number `0` is returned.
     *
     * @param trace interpreter stack trace
     * @returns new bubble with the value
     */
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

/**
 * Provide functions to move bubbles around.
 */
class Abysser {
    /**
     * @param abyss the interpreter state stack
     */
    constructor(abyss) {
        this.abyss = abyss;
    }

    /**
     * Move a bubble down the stack according to input.
     *
     * @param trace interpreter stack trace
     * @param input how many positions to move down
     * @returns null
     */
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

    /**
     * Remove or split a bubble.
     *
     * The split happens only if the bubble has more than one value.
     *
     * @param trace interpreter stack trace
     * @param input the bubble to pop
     * @returns null or an array of bubbles to push into the abyss
     */
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

    /**
     * Clone the given bubble and push both into the abyss.
     *
     * @param trace interpreter stack trace
     * @param input the bubble to clone
     * @returns array of bubbles to push into the abyss
     */
    duplicate(trace, input) {
        trace.push('Abysser.duplicate');
        const bubbles = [input, input.clone()];

        trace.pop();
        return bubbles;
    }

    /**
     * Create a single bubble from multiple ones.
     *
     * @param trace interpreter stack trace
     * @param input how many bubble to take from the abyss
     * @returns the new bubble
     */
    surround(trace, input) {
        trace.push('Abysser.surround');
        const bubble = new Bubble();

        for (let i=0; i<input; ++i) {
            bubble.merge(this.abyss.pop());
        }

        trace.pop();
        return bubble;
    }

    /**
     * Create one bubble from the two topmost bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns the merged bubble
     */
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

/**
 * Provide basic arithmetic functions on bubbles.
 */
class Arith {
    /**
     * Add two bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns a new bubble with the result
     */
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

    /**
     * Subtract two bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns a new bubble with the result
     */
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

    /**
     * Multiply two bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns a new bubble with the result
     */
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

    /**
     * Divide two bubbles and keep the remainder.
     *
     * The result will be a double bubble that can contain other
     * double bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns a new bubble with the result
     */
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

    /**
     * Calculate the division and the remainder of two bubbles.
     *
     * @param trace interpreter stack trace
     * @param v1 the first value
     * @param v2 the second value
     * @return array with remainder and division, in this order
     */
    static bubblediv(trace, v1, v2) {
        trace.push('Arith.bubblediv');
        let division = v1 / v2;
        division = (division < 0) ? Math.ceil(division) : Math.floor(division);

        let remainder = v1 % v2;

        trace.pop();
        return [remainder, division];
    }
}

/**
 * Provide function to compare two bubbles.
 */
class Comparator {
    /**
     * Test for bubble equality.
     *
     * Double bubbles are compared in every contained value.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns false if the bubbles are different
     */
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

    /**
     * Test whether the first bubble is smaller than the second.
     *
     * This test applies only to single bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns false if the bubble is greater
     */
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

    /**
     * Test whether the first bubble is greater than the second.
     *
     * This test applies only to single bubbles.
     *
     * @param trace interpreter stack trace
     * @param b1 the first bubble
     * @param b2 the second bubble
     * @returns false if the bubble is smaller
     */
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

    /**
     * Test whether a bubble is exactly the value 0.
     *
     * A double bubble with only zero values does not pass this test;
     * it has to be a single bubble.
     *
     * @param trace interpreter stack trace
     * @param b1 the bubble to test
     * @returns false if the bubble is not the value 0.
     */
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

/**
 * Iterate over a sequence of tokens and perform associated actions.
 *
 * This interpreter has a fixed limit of 10000 (ten thousand)
 * operations; when exceeded the interpreter will terminate with an
 * error.
 *
 * @param trace the interpreter stack trace
 * @param abyss the interpreter state stack
 * @param tokens the sequence of tokens
 * @param stdin an input reader
 * @param stdout an output writer
 * @returns the value of the topmost bubble, 0 by default
 */
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

/**
 * Input reader backed by an array.
 */
class ArrayReader {
    /**
     * @param backing the array to read from
     */
    constructor(backing) {
        this.backing = [...backing];
        this.line = -1;
    }

    /**
     * Return a string from the backing array.
     *
     * @returns a string, can be empty
     */
    async read() {
        this.line = this.line + 1;
        return (undefined === this.backing[this.line]) ? '' : this.backing[this.line];
    }

    /**
     * Reset the reader to read from the first line again.
     *
     * @returns this
     */
    reset() {
        this.line = -1;
        return this;
    }
};

/**
 * Input reader able to wait from users.
 *
 * This reader takes its lines from a DOM node, which can be an actual
 * user interface where users can write in freely.
 *
 * To ensure users are actually able to type in something, this
 * function will suspend the interpreter until a second DOM node is
 * activated with a `click` event.
 *
 * The DOM node must support the `value` property, effectively
 * limiting it only to `<input>` and `<textarea>` elements.
 */
class DOMReader {
    /**
     * @param node the node to read from
     * @param actor the node restarting the interpreter
     */
    constructor(node, actor) {
        this.backing = node;
        this.button = actor;
    }

    /**
     * Return a string from the backing DOM node.
     *
     * Before reading begins, this method will generate an event
     * called `awa5:prompt`; after the value has been received, it
     * will generated an event called `awa5:processing`.
     *
     * These events can be used to manipulate a user interface or
     * similar actions.
     *
     * @returns a string, can be empty
     */
    async read() {
        let listener = null;
        let promise = new Promise((resolve, reject) => {
            listener = (e) => { resolve(this.backing.value); };

            this.button.addEventListener('click', listener);
        });

        const prompt = new CustomEvent('awa5:prompt', {
            bubbles: true,
            detail: {
                node: this.backing,
                actor: this.button,
            }
        });
        this.backing.dispatchEvent(prompt);

        // "block" the script/interpreter until the click listener on actor/button is executed
        const value = await promise;

        const processing = new CustomEvent('awa5:processing', {
            bubbles: true,
            detail: {
                node: this.backing,
                actor: this.button,
                value: value,
            },
        });
        this.backing.dispatchEvent(processing);

        this.button.removeEventListener('click', listener);

        return value;
    }

    /**
     * Reset the reader to read from the first line again.
     *
     * @returns this
     */
    reset() {
        // nothing to reset, but it keeps the interface uniform
        return this;
    }
};

/**
 * Output writer backed by an array.
 */
class ArrayWriter {
    /**
     * @param backing the array to write to
     */
    constructor(backing) {
        this.backing = backing;
    }

    /**
     * Write (push) a line inside the backing array.
     *
     * @param line the line to push
     * @returns this
     */
    write(line) {
        this.backing.push(line);
        return this;
    }
};

/**
 * Output writer backed by a DOM node.
 *
 * This writer will try to append some text to the specified DOM node.
 *
 * Not every DOM node is suitable: only `<input type="text">`, `<textarea>`,
 * `<div>`, `<span>`, `<p>` and `<pre>` are supported.
 */
class DOMWriter {
    /**
     * @param node the node to write to
     * @throws a type error if the DOM node is not supported
     */
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

    /**
     * Write (append) a line inside the backing DOM node.
     *
     * @param line the line to push
     * @returns this
     */
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

        return this;
    }
};

/**
 * Implentation of an interpreter for the AWA5.0 language.
 */
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

    /**
     * Start the interpreter and execute the given input.
     *
     * @param input the input string
     * @returns the last value generated by the interpreter
     */
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

    /**
     * Set the input reader to the given object.
     *
     * @param reader an input reader
     * @returns this
     */
    setInputReader(reader) {
        if (false === reader instanceof ArrayReader && false === reader instanceof DOMReader) {
            throw new TypeError('not a valid reader');
        }

        this.intake = reader;
        return this;
    }

    /**
     * Set the output writer to the given object.
     *
     * @param reader an output writer
     * @returns this
     */
    setOutputWriter(writer) {
        if (false === writer instanceof ArrayWriter && false === writer instanceof DOMWriter) {
            throw new TypeError('not a valid reader');
        }

        this.output = writer;
        return this;
    }

    /**
     * Create an input reader based on the given options, if present.
     *
     * Options are an object with two possible format: if the `buffer`
     * property is present, the reader will be backed by the
     * associated array; if `node` and `actor` are present, the reader
     * will be backed by a DOM node.
     *
     * If all possible options are present, array-backed readers are
     * given priority.
     *
     * @param options the reader options
     * @returns an input reader
     */
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

    /**
     * Create an output writer based on the given options, if present.
     *
     * Options are an object with two possible format: if the `buffer`
     * property is present, the writer will be backed by the
     * associated array; if `node` is present, the writer will be
     * backed by a DOM node.
     *
     * If all possible options are present, array-backed writers are
     * given priority.
     *
     * @param options the writer options
     * @returns an output writer
     */
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
