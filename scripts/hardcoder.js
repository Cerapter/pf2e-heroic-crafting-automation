export const hardcodeRules = {
    "Compendium.heroic-crafting.feats.GNYDY7NsX0O8BcLw": {
        check: (item) => {
            return (item.rules[0].selector === "crafting")
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "AddCraftProgress",
                "duration": "day",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:duration:week"
                ],
                "outcome": [
                    "criticalSuccess"
                ]
            },
            {
                "key": "AddCraftProgress",
                "duration": "hour",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:duration:day"
                ],
                "outcome": [
                    "criticalSuccess"
                ]
            },
            {
                "key": "Note",
                "selector": "skill-check",
                "text": "When you roll a critical success on a check to Craft A Project for at least a day, your expertise in crafting allows you to make more progress than normal with the materials available.  In addition to the progress you would make on a success, if you spent 1 day crafting, add the value listed in @UUID[Compendium.heroic-crafting.tables.EDZW2vtmpGZUqUrk]{Table 1: Spending Limit} for 1 hour to your Current Value. If you spent 1 week crafting, add the value listed in @UUID[Compendium.heroic-crafting.tables.EDZW2vtmpGZUqUrk]{Table 1: Spending Limit} for 1 day to your Current Value. This feat cannot add more than the Cost of the Craft a Project activity to the item's Current Value.",
                "predicate": [
                    "action:craftproj",
                    {
                        "or": [
                            "crafting:heroic:duration:week",
                            "crafting:heroic:duration:day"
                        ]
                    }
                ],
                "title": "{item|name}",
                "outcome": [
                    "criticalSuccess"
                ]
            }
        ]
    },
    "Compendium.heroic-crafting.feats.Bt7VlbJdvdjarCEI": {
        check: (item) => {
            return (item.rules[0].selector === "crafting")
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Craft in 10 minutes. Lose double progress on critical failure."
            },
            {
                "key": "AddCraftProgress",
                "mode": "multiply",
                "amount": 2,
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:duration:hour",
                    "crafting:heroic:settings:midnight-crafting"
                ],
                "outcome": [
                    "criticalFailure"
                ]
            },
            {
                "key": "ModifyCraftAProject",
                "mode": "multiply",
                "target": "rushCost",
                "amount": 1,
                "toggledBy": "midnight-crafting"
            },
            {
                "key": "Note",
                "selector": "skill-check",
                "text": "If you critically fail a Crafting check using this feat, you deduct twice as much progress as normal from your progress.",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:duration:hour",
                    "crafting:heroic:settings:midnight-crafting"
                ],
                "title": "{item|name}",
                "outcome": [
                    "criticalFailure"
                ]
            }
        ]
    },
    "Compendium.heroic-crafting.feats.G6mEj1Maoan4s5mx": {
        check: (item) => {
            return (item.rules.length === 0)
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Craft with Survival instead of Crafting."
            },
            {
                "key": "ModifyCraftAProject",
                "target": "skill",
                "mode": "override",
                "amount": "survival",
                "toggledBy": "natural-born-tinker"
            }
        ]
    },
    "Compendium.pf2e.feats-srd.5CRt5Dy9eLv5LpRF": {
        check: (item) => {
            return true;
        },
        deleteOldRules: false,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Craft with Nature instead of Crafting.",
                "predicate": [
                    {
                        "or": [
                            "crafting:heroic:item:tag:herbal",
                            {
                                "and": [
                                    "crafting:heroic:item:trait:alchemical",
                                    "crafting:heroic:item:trait:healing"
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "key": "ModifyCraftAProject",
                "target": "skill",
                "mode": "override",
                "amount": "nature",
                "toggledBy": "herbalist-dedication"
            }
        ]
    },
    "Compendium.heroic-crafting.feats.7GEXIP3cKDxu2Tw9": {
        check: (item) => {
            return (item.rules[0].selector === "crafting")
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Recover half the materials on failure. Check manually if applies!"
            },
            {
                "key": "Note",
                "selector": "skill-check",
                "title": "{item|name}",
                "text": "When you roll a failure, but not a critical failure, on a check to Craft A Project that your Specialty Crafting applies to, you recover half the materials you spent as the Cost of the Craft a Project activity. (See at the bottom of this chat card for the value.)",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:settings:efficient-crafting"
                ],
                "outcome": [
                    "failure"
                ]
            }
        ]
    },
    "Compendium.heroic-crafting.feats.0EfF9bH92Y2dk1J6": {
        check: (item) => {
            return (item.rules.length === 0)
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Double the spending limit."
            },
            {
                "key": "ModifyCraftAProject",
                "mode": "multiply",
                "target": "max",
                "amount": 2,
                "toggledBy": "quick-crafting"
            }
        ]
    },
    "Compendium.pf2e.feats-srd.PiUe3tpv7UVtnfvS": {
        check: (item) => {
            return (item.rules[0].selector === "crafting" &&
                item.system.prerequisites.value.find(
                    i => i.value === "Hyperfocus"
                ).value === "Hyperfocus")
        },
        deleteOldRules: true,
        newrules: [
            {
                "adjustment": {
                    "success": "one-degree-better"
                },
                "key": "AdjustDegreeOfSuccess",
                "selector": "skill-check",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:settings:impeccable-crafting"
                ]
            },
            {
                "key": "CraftingOption",
                "desc": "Upgrade success to critical success on specialty crafting. Check manually if applies!"
            },
            {
                "key": "Note",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:settings:impeccable-crafting"
                ],
                "selector": "skill-check",
                "title": "{item|name}",
                "text": "Whenever you roll a success at a Crafting check to make an item of the type you chose with Specialty Crafting, you get a critical success instead."
            }
        ]
    },
    "Compendium.heroic-crafting.items.qc0jdrtVr7R3BbY9": {
        check: (item) => {
            return (item.rules[0].selector === "crafting")
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "FlatModifier",
                "label": "Crafter's Fulu",
                "selector": "skill-check",
                "type": "status",
                "value": 1,
                "removeAfterRoll": "true",
                "predicate": [
                    "action:craftproj",
                    "downtime"
                ]
            }
        ]
    },
    "Item.J1yQte0LiN0zzbv8": {
        check: (item) => {
            return (item.rules[0].selector === "crafting")
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "RollTwice",
                "selector": "skill-check",
                "keep": "higher",
                "removeAfterRoll": "true",
                "predicate": [
                    "action:craftproj",
                    "exploration"
                ]
            }
        ]
    }
}