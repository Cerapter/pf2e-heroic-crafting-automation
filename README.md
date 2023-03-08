# [PF2E] Heroic Crafting - Automation

A companion module for the [Heroic Crafting](https://foundryvtt.com/packages/heroic-crafting) Foundry module, based on the supplement on Pathfinder Infinite of the same name.

[**Check out the original Pathfinder Infinite product here!**](https://www.pathfinderinfinite.com/product/389992/Heroic-Crafting?src=ceraptor-module)

## Features
### Beginning and Crafting Projects

The module introduces a new interface in the Crafting tab on the Player Character sheets where the player can keep track of their projects.

![An image of the Foundry PF2E Character sheet's Crafting tab, with a new entry in the middle, called "Projects". The cursor is hovering over a new "Begin Project" button next to a formula for a rapier.](./docs/begin_project.png?raw=true)

The formulas "Known Formulas" entry gain a new "Begin Project" button with the icon of a scroll, and a new entry is created called "Projects" for projects in the process of being crafted.

Clicking "Begin Project" will allow the player to set a starting Current Value for the project, and determine how they will pay for it.

![An image of a popup window that displays what project the player intends to start, how much they can spend on it at most, with an input field for how much they ARE spending on it, and a "pay method" dropdown menu that asks how the spent amount should be paid.](./docs/begin_project_menu.png?raw=true)

"Coins only" and "Material Troves only" use only the specified method to craft. "Coins, then Troves" will attempt to pay for it with coins first, then takes value away from troves if its not enough, and "Troves, then coins" is the reverse of that.

![An image of a popup window that asks the player how much they are spending to craft a project, how long they are working on it, if they are taking any overtime penalties, and how they intend to pay the costs.](./docs/craft_project_menu.png?raw=true)

Crafting a project, done by clicking the hammer icon at the end of a project's row, uses a similar interface. The player has the option to input a crafting duration (the skill check's trait can change from exploration to downtime depending on the duration set), and an overtime penalty.

![An image of a chat message of a failed crafting check. The message has a button to progress the project's completion by 5 sp.](./docs/crafting_check.png?raw=true)

When the player rolls the check using the popup above, the result is output into a chat message, with a button that can be used to automatically progress the project's status.

If the project's Current Value is ever above the Price of the project, the project is deleted and the item is created. If it ever dips below 0 gp of Current Value, the project is also removed.

### Foraging

![An image of a chat message of a successful foraging check. The message instructs the user to refill their material troves by 20 gp.](./docs/foraging.png?raw=true)

The module comes with a foraging macro that calculates the results for you -- though the DC cannot truly be secret at the moment because of Foundry limitations.

### Heroic Crafting module support

![A GIF of the crafting popup, now with multiple extra options, all named after various Heroic Crafting feats.](./docs/heroic_crafting_support.gif?raw=true)

If you have the [Heroic Crafting](https://foundryvtt.com/packages/heroic-crafting) module, this module will extend support wherever possible if you have the appropriate feats. 
## How to Install

### Standard Foundry module installation

1. Fire up your Foundry client, and navigate to "Add-on Modules", then search up the module's name, and click "Install" beside it.
2. *(Optional, but heavily suggested)* Do the same with the Heroic Crafting module as well.
3. Enjoy!
### Using the manifest file directly

1. Fire up your Foundry client, and navigate to "Add-on Modules", then click "Install Module".
2. Copy the manifest link (this: `https://raw.githubusercontent.com/Cerapter/pf2e-heroic-crafting-automation/master/module.json`) into the "Manifest URL:" part, then install it. 
3. Enjoy!