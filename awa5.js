const parser = function (trace, input) {
    trace.push('parser');

    trace.pop();
    return [];
};

const interpreter = function (trace, tokens, stdin, stdout) {
    trace.push('interpreter');

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
