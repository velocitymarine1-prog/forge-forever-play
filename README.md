# Forge Forever · the first playable

One game in three pages, in the browser. It opens on the **main menu** (the title over rolling mountains at dusk): Forge,
Battlegrounds, General Settings. A phone that has never played is asked its name first (**Who's at the forge?**), and Grycus
walks the new knight through the first five minutes: the first forge (one Fire from the Trader's Cart onto his old Sword makes
Emberbane), the Training Cellar's lessons shouted from the stairs, "Good luck, kid" with a purse and a crate, and Into the wild onto
the Troll Gate. **Skip the lessons** is on his first line and in Settings; **Copy my playtest notes** in Settings gives a tester's
step times and stray taps to paste into a message.

**The Forge** (`forge.html`). The smithy fills the screen wall to wall: the arch down to the Training Cellar on the left under the
tool rack, the open door through to the Armory on the right, the hearth and the anvil between them. By the bellows stands **Grycus**,
the hunched old smith of the Forge, sixty years at this anvil hunting the perfect weapon and not done yet; tap him for a word. You
are no smith: you bring him the things, and he does the forging. Put any two things on the anvil and strike: both fly into the fire,
the room cuts in close, and Grycus, his back screaming, swings the sledge from behind his back, over his head and down onto the
glowing billet in slow, heavy blows until the world answers; the result comes out of the last blow onto its plaque, a card that holds everything at once and
never scrolls (the rarity on its own coloured band, what it does in words, the stats in a column of their own, who forged it first,
TAP ANYWHERE TO CONTINUE). A weapon and an ingredient, two weapons (the left one is the base and takes one gift), two ingredients.
From level 25 the Crucible melts two rare weapons and a Legend Ember into a legend, and the first smith to pour one may name it.
Legend Embers are found, never bought: bosses, chests and rare enemies in the Battlegrounds drop them. **Every forge pays XP** by
the rarity of what it makes (common 5, uncommon 8, rare 12, epic 25, legendary 50), shown rising into the Lv chip on the sign; only
forging two weapons into something you already have pays nothing. Clearing the Troll Gate pays 250 XP (38 on a replay). Tap the Lv
chip to see how far the next level is. The house on the sign goes back to the menu; the cog opens Settings.

**The Armory** (through its door in the smithy, or ARMORY on the sign) is a room of its own: a hall drawn like the smithy, with every
weapon you hold standing on oak shelves, a bay for each class, lit by lamps. Drag it sideways to walk it; tap a weapon for its
plaque. A second wall, Legends, hangs each legend in a gilt case, the newest first. The door at the hall's left end, or FORGE on
the sign, goes back to the anvil.

**The Training Cellar** (`battlegrounds.html`), the first of the Battlegrounds. Go down through the arch in the smithy, with
**Try it in the cellar** on a new weapon's plaque, or from the menu. Walk a knight among the training dummies and swing, shoot,
stream, lob, orbit, ward, trap and summon with anything you own. A legend strikes with its body's weapon and has one ability from
its head's class (Volley, Quake, Whirlwind…) on the gold button above Strike, with a cooldown. Nothing bleeds, nothing is used up,
and nothing pays. The rack on the wall holds every weapon you own. **The door on the cellar's left wall** ("← The Troll Gate": tap the
prompt, press E, or walk into the wall) opens the gate plate: go alone, or bring one to three sword-brothers.

**The Troll Gate** (`battlegrounds.html?area=gate`), the first real Battleground. A dusk field two screens deep before a troll castle,
played exactly like the cellar: five waves of trolls in five arenas among thorn-wire, stakes, trenches and troll outposts that send trolls
until they are wrecked, a chapel with a stair to its roof, a watchtower with a ladder, two trebuchets worked by troll winchmen; then
the war horn, the drawbridge, the maul brute and the rock brute, the gate to batter down (any weapon, or the Last Army's Ram lying on
the bank), the last of them, the iron chest, and the castle. Trolls hurt here: a knight who falls is lifted by a friend, a lone knight
gets one Second Wind, and a wipe restarts the wave at full health. Trolls, huts and the chest drop ingredients (never weapons); walk
into the castle and they go home to the Forge's stock and pay coin and experience, leave early and they are banked unpaid. Normal is
the only difficulty. Your health is the red bar in the top-left corner (100); it grows back, a point a second, after five seconds
without a hit. Yellow arrows point at what to go to and use (the ram, the gate to break, the iron chest, the way into the castle, a
fallen friend to lift), a yellow GO shows the way on between the waves, the plate in the top-right corner counts the trolls the wave
still has, and whatever you hit shows its health over it.

Play: https://velocitymarine1-prog.github.io/forge-forever-play/

Built for a phone held sideways, landscape only, and add it to the home screen: held upright, every page shows a turn plate, and
if the screen won't turn (rotation lock) "My screen won't turn" turns the game for you. On a desktop: W A S D, J strikes, K swaps,
L dodges, U plays a legend's ability, E uses the rack, the stairs and the door, takes up the ram and opens the chest, Esc opens the
cellar's menu.

This is a **world of one**: the pairs the seed ledger knows reveal the Forge Oracle's real results (the model wrote them once), and
every other pair is the offline Combiner's provisional draft. Your game is saved in this browser and online, on the forge's server,
so it can go to another phone (Settings: Play on another phone, then Bring a game here on the other). The design passes, the engine, the
world service and the ledger's source of truth live in the private `forgecrawl` repository; this copy is written by its
`tools/deploy.sh` from commit `9cf9234`.
