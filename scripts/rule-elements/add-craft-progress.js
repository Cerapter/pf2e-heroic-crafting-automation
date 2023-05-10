import { spendingLimit } from "../constants.js";

class AddCraftProgressRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(data, item, options = null) {
        super(data, item, options);

        if (this.#isValid(data)) {
            this.amount = this.resolveValue(data.amount ?? 1);
            this.level = this.resolveValue(data.level ?? this.actor.level);
            this.duration = data.duration;
            this.mode = data.mode;
            this.outcome = data.outcome;
        }
    }

    #isValid(data) {
        if (data.duration && !(typeof data.duration === "string" && ["hour", "day", "week"].includes(data.duration))) {
            this.failValidation(`An Add Craft Progress rule element's duration must either be "hour", "day", or "week"!`);
            return false;
        }
        if (data.mode && !(typeof data.mode === "string" && ["multiply"].includes(data.mode))) {
            this.failValidation(`An Add Craft Progress rule element's mode must be "multiply"!`);
            return false;
        }

        return true;
    }

    _validateModel(data) {
        super._validateModel(data);

        if (data.duration && data.mode) {
            throw Error("must either have duration or mode, not both");
        }
    }

    beforeRoll(domains, rollOptions) {
        if (!this.test(rollOptions)) return;

        const synthetic = this.duration ?
            { coins: spendingLimit(this.duration, this.level).scale(this.amount), outcome: this.outcome } :
            { mode: this.mode, amount: this.amount, outcome: this.outcome };


        if ("AddCraftProgress" in this.actor.synthetics) {
            this.actor.synthetics["AddCraftProgress"].push(synthetic);
        } else {
            this.actor.synthetics["AddCraftProgress"] = [synthetic];
        }
    }
};

export { AddCraftProgressRuleElement }