import { spendingLimit } from "../constants.js";

class AddCraftProgressRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(source, options) {
        super(source, options);

        if (this.duration && this.mode) {
            this.failValidation("must either have duration or mode, not both");
        }

        if (!this.duration && !this.mode) {
            this.failValidation("must either have duration or mode");
        }
    }

    static defineSchema() {
        const { fields } = foundry.data;

        const rollOptionSchema = game.pf2e.RuleElements.builtin.RollOption.defineSchema();
        const ResolvableValueField = rollOptionSchema.value.constructor;

        return {
            ...super.defineSchema(),
            duration: new fields.StringField({
                required: false,
                nullable: false,
                blank: false,
                choices: ['hour', 'day', 'week'],
            }),
            amount: new ResolvableValueField({
                required: false,
                nullable: false,
                initial: 1
            }),
            level: new ResolvableValueField({
                required: false,
                nullable: false,
                initial: '@actor.level'
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

        const resolvedLevel = Number(this.resolveValue(this.level, 1));
        const resolvedAmount = Number(this.resolveValue(this.amount, 1));

        const synthetic = this.duration ?
            { coins: spendingLimit(this.duration, resolvedLevel).scale(resolvedAmount), outcome: this.outcome } :
            { mode: this.mode, amount: resolvedAmount, outcome: this.outcome };

        if ("AddCraftProgress" in this.actor.synthetics) {
            this.actor.synthetics["AddCraftProgress"].push(synthetic);
        } else {
            this.actor.synthetics["AddCraftProgress"] = [synthetic];
        }
    }
};

export { AddCraftProgressRuleElement }