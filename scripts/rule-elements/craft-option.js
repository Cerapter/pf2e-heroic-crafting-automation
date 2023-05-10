import { ROLLOPTION_ITEM_PREFIX } from "../constants.js";

class CraftingOptionRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(data, item, options = null) {
        super(data, item, options);

        if (this.#isValid(data)) {
            this.toggleable = Boolean(data.toggleable ?? true);
            this.default = Boolean(data.default ?? false);
            this.value = data.value ?? this.item.name;
            this.desc = data.desc ?? "";
        }
    }

    #isValid(data) {
        return true;
    }

    preCraft(item) {
        const rollOptions = this.actor.getRollOptions().concat(item.getRollOptions(ROLLOPTION_ITEM_PREFIX));
        if (!this.test(rollOptions)) return;

        const synthetic = { label: this.value, desc: this.desc, toggleable: this.toggleable, default: this.default };

        if ("CraftingOption" in this.actor.synthetics) {
            this.actor.synthetics["CraftingOption"].push(synthetic);
        } else {
            this.actor.synthetics["CraftingOption"] = [synthetic];
        }
    }
};

export { CraftingOptionRuleElement }