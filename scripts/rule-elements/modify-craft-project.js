import { ROLLOPTION_ITEM_PREFIX } from "../constants.js";

class ModifyCraftAProjectRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(data, item, options = null) {
        super(data, item, options);

        if (this.#isValid(data)) {
            this.amount = this.resolveValue(data.amount ?? 1);
            this.mode = data.mode;
            this.target = data.target;
            this.toggledBy = data.toggledBy;
        }
    }

    #isValid(data) {
        if (!(typeof data.mode === "string" && ["multiply", "override"].includes(data.mode))) {
            this.failValidation(`A Modify Craft a Project rule element's mode must either be "multiply" or "override"!`);
            return false;
        }

        if (!(typeof data.target === "string" && ["rushCost", "max", "skill"].includes(data.target))) {
            this.failValidation(`A Modify Craft a Project rule element's target must be either be "rushCost", "max", or "skill"!`);
            return false;
        }

        if (data.mode === "override" && !(["skill"].includes(data.target))) {
            this.failValidation(`"override" mode can only be used with the "skill" target!`);
            return false;
        }

        if (data.mode === "multiply" && ["skill"].includes(data.target)) {
            this.failValidation(`"multiply" mode cannot be used with the "skill" target!`);
            return false;
        }

        return true;
    }

    preCraft(item) {
        const rollOptions = this.actor.getRollOptions().concat(item.getRollOptions(ROLLOPTION_ITEM_PREFIX));
        if (!this.test(rollOptions)) return;

        const synthetic = { amount: this.amount, mode: this.mode, target: this.target, toggledBy: this.toggledBy };

        if ("ModifyCraftAProject" in this.actor.synthetics) {
            this.actor.synthetics["ModifyCraftAProject"].push(synthetic);
        } else {
            this.actor.synthetics["ModifyCraftAProject"] = [synthetic];
        }
    }
}

export { ModifyCraftAProjectRuleElement }