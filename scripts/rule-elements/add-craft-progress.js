import { spendingLimit } from "../constants.js";

class AddCraftProgressRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(source, options) {
        super(source, options);

        if (this.duration && this.mode) {
            this.failValidation("must either have duration or mode, not both");
        }
    }

    static defineSchema() {
        const { fields } = foundry.data;

        const rollOptionSchema = game.pf2e.RuleElements.builtin.RollOption.defineSchema();
        const ResolvableValueField = rollOptionSchema.value.constructor;

        return {
            ...super.defineSchema(),
            duration: new fields.StringField({
                required: true,
                nullable: false,
                blank: false,
                choices: ['hour', 'day', 'week'],
            }),
            amount: new ResolvableValueField({
                required: false,
                nullable: false,
                initial: undefined
            }),
            level: new ResolvableValueField({
                required: false,
                nullable: false,
                initial: undefined
            }),
            mode: new fields.StringField({
                required: false,
                nullable: false,
                blank: false,
                choices: ['multiply'],
            }),
            outcome: new fields.ArrayField(
                new fields.StringField({
                    required: true,
                    blank: false,
                    choices: ["criticalFailure", "failure", "success", "criticalSuccess"]
                }),
                {
                    required: false,
                    nullable: false,
                    initial: undefined
                },
            ),
        }
    }

    beforeRoll(_domains, rollOptions) {
        if (!this.test(rollOptions)) return;
        if (this.ignored) return;

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