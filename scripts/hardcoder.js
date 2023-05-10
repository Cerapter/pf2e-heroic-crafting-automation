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
                "text": "When you roll a critical success on a check to Craft A Project for at least a day, your expertise in crafting allows you to make more progress than normal with the materials available.  In addition to the progress you would make on a success, if you spent 1 day crafting, add the value listed in Table 1: Spending Limit for 1 hour to your Current Value. If you spent 1 week crafting, add the value listed in Table 1: Spending Limit for 1 day to your Current Value. This feat cannot add more than the Cost of the Craft a Project activity to the item's Current Value.",
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
                    "crafting:heroic:settings:midnightCrafting"
                ],
                "outcome": [
                    "criticalFailure"
                ]
            },
            {
                "key": "Note",
                "selector": "skill-check",
                "text": "If you critically fail a Crafting check using this feat, you deduct twice as much progress as normal from your progress.",
                "predicate": [
                    "action:craftproj",
                    "crafting:heroic:duration:hour",
                    "crafting:heroic:settings:midnightCrafting"
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
            return true;
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Craft with Survival instead of Crafting."
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
            }
        ]
    },
    "Compendium.heroic-crafting.feats.0EfF9bH92Y2dk1J6": {
        check: (item) => {
            return true;
        },
        deleteOldRules: true,
        newrules: [
            {
                "key": "CraftingOption",
                "desc": "Double the spending limit."
            }
        ]
    }
}