# The new Rule Elements

This module offers some additional rule elements to allow you to modify how the players interact with the Heroic Crafting system.

### Note: Heroic Crafting feats

When you place down a Heroic Crafting feat, they will be filled up with some of these rule elements -- nothing is hardcoded.

## AddCraftProgress (fixed)

```ts
{
    "key": "AddCraftProgress",
    "duration": "hour" | "day" | "week",
    "amount": number,
    "level": number,
    "outcome": string[]
}
```

Adds the given amount of progress to a Craft A Project.

`duration` and `level` come together to essentially act as a "lookup" in the Spending Limit table. So for example, `{"duration": "week", "level": 6}` would equal `60 gp` of value. `amount` then can scale this value, so for example, if `amount` was `0.5`, we'd take `30 gp` of value instead.

`duration` can only be the choices listed above.  
`amount` can be any number. Defaults to 1.  
`level` can be any number, though only values between 1 and 20 (inclusive) actually give you results as that's all the rows in the Spending Limit table. Defaults to the actor's level.  
`outcome` is a combination of `"criticalFailure"`, `"failure"`, `"success"` and `"criticalSuccess"`, like the RollNote RE.

## AddCraftProgress (based on result progress)

```ts
{
    "key": "AddCraftProgress",
    "mode": "multiply",
    "amount": number,
    "outcome": string[]
}
```

This one instead takes the progress result you would have gotten by default, takes a multiple of that, then adds it to the aforementioned progress.

Do note that this **does not** scale the progress itself! It just takes a scaled version of it, and *then* adds it to the progress. So if you wanted to double the progress made, you'd make `amount` 1, not 2.

"Progress" refers to actual progress made on success and crit success, half progress made on failure, and the setback on critical failure, all positive -- so you don't have to do negatives when trying to increase the setback on a crit fail.

Both `amount` and `outcome` are as described in the fixed version of this RE.

## CraftOption

```ts
{
    "key": "CraftingOption",
    "value": string,
    "desc": string,
    "toggleable": boolean,
    "default": boolean
}
```

Makes a toggle appear in the Craft a Project window.

`value` is the name of the toggle. By default, this is the item's name. When the toggle is on, other REs can listen in onto it by referring to it by the `value`'s value. (See ModifyCraftAProject's `toggledBy`.)  
`desc` is a custom textual description of what the toggle does. Should preferably be short and to-the-point. Defaults to empty text.  
`toggleable` determines if the input for the toggle is disabled or not. Defaults to `true`.  
`default` determines the, well, default state of the toggle. Defaults to `false`. Combined with `toggleable`, can be used to enforce a specific toggle state.

## ModifyCraftAProject (costs)

```ts
{
    "key": "ModifyCraftAProject",
    "mode": "multiply",
    "target": "rushCost" | "max",
    "amount": number,
    "toggledBy": string?
}
```

Changes a value in the Craft A Project window.

"Rush costs" are extra costs you have to pay that don't count towards the current progress or Cost (capitalised). Because of this, when `target` is `rushCost`, `amount` refers to a separate value from the activity's current Cost -- so if you want the player to pay double, you must input 1, not 2.

However, when the `target` is `max`, it *is* referencing the activity's maximum Cost, so if you want to double that, you *do* input 2. 

Kinda confusing, apologies for that.

`amount`, as usual, can be any number.  
`toggledBy` is an optional reference to a CraftOption's `value`. If it does not exists, it's always active. If it does, then the only time the RE is considered active is if the matching toggle's on.

## ModifyCraftAProject (skills)

```ts
{
    "key": "ModifyCraftAProject",
    "target": "skill",
    "mode": "override",
    "amount": string,
    "toggledBy": string?
}
```

You can also use ModifyCraftAProject to change what skill the Craft A Project will use.

When the `target` is `skill`, `mode` is locked to `override`. In this case, `amount` must be a long-form skill name, for example `"survival"`. They can be Lore skill names.

`toggledBy` behaves as above.

## Note: RollOptions

This module also adds some extra roll options to the Craft A Project check you can use to determine what exactly is / was being crafted.

`crafting:heroic:duration:XYZ` contains "hour", "day" or "week" depending on what the user selected for the crafting duration.

`crafting:heroic:item:XYZ` contains all the roll options related to the item about to be crafted. These roll options also exist when the user clicks on the hammer icon to start a Craft A Project activity, so you can use these to selectively show CraftOptions in the window.

`crafting:heroic:settings:XYZ` contain the `value`s of various CraftOption toggles that were turned on.

As an example, this is how you would show a CraftOption only when the player is trying to craft alchemical bombs:

```json
{
    "key": "CraftingOption",
    "desc": "Make extra progress when crafting bombs.",
    "predicate": [
        "crafting:heroic:item:trait:alchemical",
        "crafting:heroic:item:base:alchemical-bomb"
    ]
}
```

*(There is unfortunately [one item](https://2e.aonprd.com/Equipment.aspx?ID=2416) in the entire game that's a bomb but not alchemical, so you cannot guarantee that an "alchemical" bomb really is one without the extra check for the trait.)*