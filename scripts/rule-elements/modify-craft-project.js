import { ROLLOPTION_ITEM_PREFIX } from "../constants.js";

class ModifyCraftAProjectRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(source, options) {
        super(source, options);

        if (this.mode === "override" && !(["skill"].includes(this.target))) {
            this.failValidation(`"override" mode can only be used with the "skill" target!`);
        }

        if (this.mode === "multiply" && ["skill"].includes(this.target)) {
            this.failValidation(`"multiply" mode cannot be used with the "skill" target!`);
        }
    }

    static defineSchema() {
        const { fields } = foundry.data;

        const rollOptionSchema = game.pf2e.RuleElements.builtin.RollOption.defineSchema();
        const ResolvableValueField = rollOptionSchema.value.constructor;

        return {
            ...super.defineSchema(),
            mode: new fields.StringField({
                required: true,
                nullable: false,
                blank: false,
                choices: ['multiply', 'override'],
            }),
            target: new fields.StringField({
                required: true,
                nullable: false,
                blank: false,
                choices: ['rushCost', 'max', 'skill'],
            }),
            amount: new ResolvableValueField({
                required: false,
                nullable: false,
                initial: undefined
            }),
            toggledBy: new fields.StringField({
                required: false,
                nullable: false,
                blank: false,
                initial: undefined
            }),
        }
    }

    preCraft(item) {
        const rollOptions = this.actor.getRollOptions().concat(item.getRollOptions(ROLLOPTION_ITEM_PREFIX));
        if (!this.test(rollOptions)) return;

        let resolvedAmount = "";

        if (this.mode === "override") {
            resolvedAmount = String(this.resolveValue(this.amount, ""));
        } else if (this.mode === "multiply") {
            resolvedAmount = Number(this.resolveValue(this.amount, 1));
        }

        const synthetic = { amount: resolvedAmount, mode: this.mode, target: this.target, toggledBy: this.toggledBy };

        if ("ModifyCraftAProject" in this.actor.synthetics) {
            this.actor.synthetics["ModifyCraftAProject"].push(synthetic);
        } else {
            this.actor.synthetics["ModifyCraftAProject"] = [synthetic];
        }
    }
}

export { ModifyCraftAProjectRuleElement }