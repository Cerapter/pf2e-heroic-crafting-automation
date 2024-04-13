import { ROLLOPTION_ITEM_PREFIX } from "../constants.js";

class CraftingOptionRuleElement extends game.pf2e.RuleElement {
    static validActorTypes = ["character"];

    constructor(source, options) {
        super(source, options);
        const item = this.parent;

        this.value = this.value
            ? game.i18n.format(this.resolveInjectedProperties(this.value), {
                actor: item.actor.name,
                item: item.name,
                origin: item.isOfType("effect") ? item.origin?.name ?? null : null,
            })
            : item.slug;
    }

    static defineSchema() {
        const { fields } = foundry.data;

        const auraSchema = game.pf2e.RuleElements.builtin.Aura.defineSchema();
        const ResolvableValueField = auraSchema.radius.constructor;
        const DataUnionField = auraSchema.appearance.fields.border.fields.color.constructor;
        const StrictStringField = auraSchema.appearance.fields.texture.fields.src.constructor;

        return {
            ...super.defineSchema(),
            value: new fields.StringField({
                required: false,
                nullable: false,
                blank: false,
                initial: undefined
            }),
            desc: new DataUnionField(
                [
                    new StrictStringField({ required: true, blank: false }),
                    new ResolvableValueField(),
                ],
                { required: true, nullable: false },
            ),
            toggleable: new fields.BooleanField({ required: false, initial: true }),
            default: new fields.BooleanField({ required: false, initial: false }),
        }
    }

    preCraft(item) {
        const rollOptions = this.actor.getRollOptions().concat(item.getRollOptions(ROLLOPTION_ITEM_PREFIX));
        if (!this.test(rollOptions)) return;

        const synthetic = {
            label: this.label,
            value: this.value, 
            desc: this.desc, 
            toggleable: 
            this.toggleable, 
            default: this.default
        };

        if ("CraftingOption" in this.actor.synthetics) {
            this.actor.synthetics["CraftingOption"].push(synthetic);
        } else {
            this.actor.synthetics["CraftingOption"] = [synthetic];
        }
    }
};

export { CraftingOptionRuleElement }