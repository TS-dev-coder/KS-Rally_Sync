/**
 * i18n.js — the app in the languages Kingshot itself ships in.
 *
 * The language list is not invented: it is exactly the seventeen locales the
 * Kingshot App Store listing declares, so anyone who can read the game can read
 * this. Arabic is right-to-left and flips the whole layout.
 *
 * Deliberately a plain lookup with an English fallback rather than a framework.
 * A missing key renders the English string instead of a blank or a raw key, so
 * a half-translated locale degrades into a readable mix rather than a broken
 * screen — which matters because translations arrive a few at a time.
 */
;(function (root) {
  'use strict';

  /** Exactly the locales Kingshot lists on the App Store, English first. */
  var LANGUAGES = [
    { code: 'en', native: 'English', english: 'English', short: 'EN' },
    { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true, short: 'ع' },
    { code: 'de', native: 'Deutsch', english: 'German', short: 'DE' },
    { code: 'es', native: 'Español', english: 'Spanish', short: 'ES' },
    { code: 'fr', native: 'Français', english: 'French', short: 'FR' },
    { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', short: 'ID' },
    { code: 'it', native: 'Italiano', english: 'Italian', short: 'IT' },
    { code: 'ja', native: '日本語', english: 'Japanese', short: '日' },
    { code: 'ko', native: '한국어', english: 'Korean', short: '한' },
    { code: 'pl', native: 'Polski', english: 'Polish', short: 'PL' },
    { code: 'pt', native: 'Português', english: 'Portuguese', short: 'PT' },
    { code: 'ru', native: 'Русский', english: 'Russian', short: 'RU' },
    { code: 'th', native: 'ไทย', english: 'Thai', short: 'ไท' },
    { code: 'tr', native: 'Türkçe', english: 'Turkish', short: 'TR' },
    { code: 'vi', native: 'Tiếng Việt', english: 'Vietnamese', short: 'VI' },
    { code: 'zh-Hans', native: '简体中文', english: 'Simplified Chinese', short: '简' },
    { code: 'zh-Hant', native: '繁體中文', english: 'Traditional Chinese', short: '繁' }
  ];

  /**
   * English is the key set. Every other locale is a partial overlay: anything
   * it omits falls through to here.
   */
  var EN = {
    'nav.calculate': 'Calculate',
    'nav.leads': 'Leads',
    'nav.targets': 'Targets',
    'nav.tune': 'Tune',
    'nav.more': 'More',

    'row.on': 'on',
    'row.type': 'type',
    'row.march': 'march',
    'row.departs': 'departs',
    'row.lands': 'lands',
    'row.from': 'from',
    'row.to': 'to',
    'row.dist': 'dist',
    'row.speed': 'speed',
    'row.power': 'power',

    'badge.measured': 'measured',
    'badge.calibrated': 'calibrated',
    'badge.estimated': 'estimated',
    // Shown with badge-error when a row is missing coordinates or a speed --
    // NOT the slow-centre detour, which is a real and separate concept in this
    // app. "blocked" invited exactly that misreading and four locales made it.
    'badge.blocked': 'incomplete',

    'btn.focus': 'Focus',
    'btn.share': 'Share link',
    'btn.copy': 'Copy',
    'btn.copied': 'Copied',
    'btn.copyFailed': 'Copy failed',
    'btn.linkCopied': 'Link copied',
    'btn.exactTime': 'Exact time',
    'btn.exactSet': 'Exact set',
    'btn.setExact': 'Set exact',
    'btn.clear': 'Clear',

    'head.launchOrder': 'Launch order',
    'head.target': 'Target',
    'head.mode': 'Mode',
    'head.timing': 'Timing',
    'head.eventSetups': 'Event setups',
    'head.language': 'Language',

    'mode.sync': 'Sync',
    'mode.syncSub': 'All land together',
    'mode.sequence': 'Sequence',
    'mode.sequenceSub': 'Staggered, gapless',

    'label.tapRallyAt': 'TAP RALLY AT',
    'label.marchAt': 'MARCH AT',
    'label.untilYouGo': 'until you go',
    'label.gone': 'gone',
    'label.noGrouping': 'No grouping',
    'label.alarmOn': 'Alarm on',
    'label.alarmOff': 'Alarm off',

    'common.add': 'Add',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.cancel': 'Cancel',
    'common.done': 'Done',
    'common.edit': 'Edit',
    'common.name': 'Name',
    'common.alliance': 'Alliance',
    'common.language': 'Language',
    'common.none': 'None',

    'targetType.castle': 'King’s Castle',
    'targetType.turret': 'Turret',
    'targetType.sanctuary': 'Sanctuary',
    'targetType.fortress': 'Fortress',
    'targetType.outpost': 'Outpost',
    'targetType.monster': 'Terror or Beast',
    'targetType.city': 'Enemy player city',
    'targetType.hq': 'Enemy HQ',
    'targetType.hqOwn': 'Own HQ (reinforce)',
    'targetType.ruins': 'Ruins',
    'targetType.other': 'Other',
    'zone.general': 'Open map',
    'zone.monster': 'Monster (Terror, Beast)',
    'zone.castleRelic': 'Castle (Relic)',
    'zone.turret': 'Turret',
    'zone.ruins': 'Ruins',
    'zone.hqOwn': 'Own HQ (reinforce)',
    'roster.title': 'Rally leads',
    'roster.empty': 'No rally leads yet',
    'roster.noMatch': 'No leads match this filter.',
    'roster.inGameName': 'In-game name',
    'roster.pasteRoster': 'Paste a roster',
    'roster.pasteList': 'Paste list',
    'roster.optional': 'optional',
    'roster.incomplete': 'incomplete',
    'roster.duplicateName': 'duplicate name',
    'targets.title': 'Targets',
    'targets.add': 'Add target',
    'targets.addAnother': 'Add another',
    'targets.whatAdding': 'What are you adding?',
    'targets.empty': 'No targets yet',
    'targets.noneOfType': 'No targets of this type yet.',
    'targets.setXY': 'set X/Y',
    'settings.version': 'Version',
    'settings.appearance': 'Appearance',
    'settings.clock': 'Clock correction',
    'settings.alarm': 'Launch alarm',
    'settings.background': 'Keep running in the background',
    'settings.buffer': 'Safety buffer',
    'settings.backup': 'Backup',
    'settings.accuracy': 'How accurate is this?',

    'speech.rallyIn': '{name}, rally in {seconds} seconds',
    'speech.goNow': '{name}, go now',

    // Extracted from the views so every rendered string has a key.
    'cal.active': 'active',
    'cal.addAtLeastOne': 'Add at least one rally lead and one target first.',
    'cal.allZonesResetTo': 'All zones reset to the shipped defaults.',
    'cal.calibrate': 'Calibrate',
    'cal.calibrated': 'calibrated',
    'cal.calibrationSamples': 'Calibration samples',
    'cal.chargesOnlyTheTiles': 'Charges only the tiles the route actually spends inside the Relic radius at the slow rate. Physically motivated, but unverified — calibrate before relying on it.',
    'cal.constantsAreEditableConfig': 'Constants are editable config, never baked into the math. Reset any zone back to its research default at any time.',
    'cal.deleteMeasurement': 'Delete measurement',
    'cal.deleteSample': 'Delete sample',
    'cal.discardEveryFitAnd': 'Discard every fit and hand edit, and reload the shipped constants',
    'cal.everyMarchYouLog': 'Every march you log makes this tool more accurate.',
    'cal.exact': 'exact',
    'cal.exact2': 'exact',
    'cal.exactPairs': 'Exact pairs',
    'cal.guess': 'guess',
    'cal.handTuned': 'hand-tuned',
    'cal.kingshotShowsTheTrue': 'Kingshot shows the true march duration once the rally departs. Read it off and enter it here — that pair becomes exact from then on.',
    'cal.logARealMarch': 'Log a real march',
    'cal.noPublishedSourceQuantifies': 'No published source quantifies this zone at all. The numbers below are a placeholder copied from the red zone. Do not trust them until you have logged a real march here.',
    'cal.noSamplesRecordedYet': 'No samples recorded yet.',
    'cal.noneYetLoggedMarches': 'None yet. Logged marches appear here and override the formula entirely.',
    'cal.offsetHeldFixedNeeds': 'offset held fixed — needs samples at two different distances to fit it',
    'cal.realMarchesShowTime': 'Real marches show time rising faster than distance, which a straight line cannot describe without going negative. An exponent above 1 bends the curve upward.',
    'cal.stale': 'stale',
    'cal.startingModel': 'Starting model',
    'cal.twoCommunityModelsDisagree': 'Two community models disagree by roughly 2× on seconds per tile, and neither shows its data. Pick a starting point, then let real samples settle it. Switching discards every fit and hand-edit.',
    'cal.unverified': 'unverified',
    'cal.useTheGeometricRelic': 'Use the geometric Relic model',
    'cal.zoneModels': 'Zone models',
    'calc.333Or213': '3:33, or 213 for seconds',
    'calc.addTheCastleA': 'Add the Castle, a turret, a Sanctuary — whatever you are hitting.',
    'calc.backOutWithThe': 'Back out with the arrow. Nothing deploys, no stamina is spent.',
    'calc.chooseATarget': 'Choose a target',
    'calc.dragToReorder': 'Drag to reorder',
    'calc.eGWeeklyCastle': 'e.g. Weekly Castle Battle',
    'calc.eachLeadMarchesOn': 'Each lead marches on:',
    'calc.estimatesNotGuarantees': 'Estimates, not guarantees. ',
    'calc.exactMarchTimeAs': 'Exact march time as the game states it',
    'calc.gap': 'Gap',
    'calc.getThisFromThe': 'Get this from the game without marching',
    'calc.groupResultsBy': 'Group results by',
    'calc.landsInThisOrder': 'Lands in this order — drag the handle or use the arrows.',
    'calc.noPlanYet': 'no plan yet',
    'calc.noRallyLeadsYet': 'No rally leads yet — add them on the Leads tab.',
    'calc.noStartSetSo': 'No start set, so rallies are treated as opening now.',
    'calc.noTargetsYet': 'No targets yet',
    'calc.openRalliesRightNow': 'Open rallies right now',
    'calc.pickATargetAnd': 'pick a target and some leads',
    'calc.pickAnyRallyWindow': 'Pick any rally window, then Hold a rally.',
    'calc.readTheTimeBeside': 'Read the time beside the timer icon, left of Deploy.',
    'calc.sanctuaryAndFortressPushes': 'Sanctuary and Fortress pushes are usually staggered 10–15s so the first rally softens the garrison.',
    'calc.saveTheCurrentTarget': 'Save the current target, roster and mode as a named setup you can reload next event.',
    'calc.secondsApart': 'seconds apart',
    'calc.sendPartOfThe': 'Send part of the roster somewhere else in the same run — Castle and a turret together. Assign each lead below; the target above stays the default.',
    'calc.setThisTargetS': 'Set this target’s coordinates on the Targets tab before calculating.',
    'calc.setUpOnceReuse': 'Set up once, reuse every event',
    'calc.setWhenRalliesOpen': 'Set when rallies open. The slowest lead taps then, everyone else follows, and the app works out when it all lands.',
    'calc.setWhenRalliesOpen2': 'Set when rallies open',
    'calc.smallMonstersShowAttack': 'Small monsters show Attack instead of Rally — that screen gives the same number.',
    'calc.splitAcrossMultipleTargets': 'Split across multiple targets',
    'calc.startRalliesAt': 'START RALLIES AT',
    'calc.startRalliesAt2': 'Start rallies at',
    'calc.tapTheTargetOn': 'Tap the target on the map, then Rally.',
    'calc.troopsLandAt': 'TROOPS LAND AT',
    'calc.whenTheFirstPerson': 'when the first person taps their rally button',
    'ros.add': 'Add',
    'ros.addEachPlayerWho': 'Add each player who will open a rally, with their city coordinates and their March Speed Up %. Or paste your whole roster at once.',
    'ros.close': 'Close',
    'ros.delete': 'Delete',
    'ros.duplicateName': 'duplicate name',
    'ros.eGVng': 'e.g. VNG',
    'ros.eGWave1': 'e.g. Wave 1',
    'ros.inGameName': 'In-game name',
    'ros.incomplete': 'incomplete',
    'ros.noLeadsMatchThis': 'No leads match this filter.',
    'ros.noRallyLeadsYet': 'No rally leads yet',
    'ros.optional': 'optional',
    'ros.optional2': 'optional',
    'ros.pasteARoster': 'Paste a roster',
    'ros.pasteList': 'Paste list',
    'ros.rallyLeads': 'Rally leads',
    'set.aNewerVersionIs': 'A newer version is live. ',
    'set.appearance': 'Appearance',
    'set.automatic': 'Automatic',
    'set.backup': 'Backup',
    'set.browsersSlowHiddenTabs': 'Browsers slow hidden tabs down to save power — after a few minutes Chrome runs their timers only once a minute, and may discard the tab entirely.',
    'set.clockCorrection': 'Clock correction',
    'set.correctedUtc': 'Corrected UTC',
    'set.deviceUtc': 'Device UTC',
    'set.downloadBlockedOpenPaste': 'Download blocked. Open “Paste a backup instead” and copy the JSON out manually.',
    'set.everyLaunchTimeIs': 'Every launch time is only as good as this device’s clock. Compare the reading below against the in-game event timer; if they differ, correct it here.',
    'set.everythingStaysOnThis': 'Everything stays on this device.',
    'set.followsYourDeviceBy': 'Follows your device by default. Dark uses layered dark greys rather than pure black, which is easier on the eyes during a long night event.',
    'set.fullSourcingDisagreementsAnd': 'Full sourcing, disagreements and open questions are written up in RESEARCH-NOTES.md alongside this app.',
    'set.holdTheTabAwake': 'Hold the tab awake while a launch is pending',
    'set.howAccurateIsThis': 'How accurate is this?',
    'set.iosWipesWebsiteStorage': 'iOS wipes website storage after 7 days without a visit — that hits every browser storage type, not just this one. Add RallySync to your Home Screen to be exempt, and keep an exported backup.',
    'set.keepRunningInThe': 'Keep running in the background',
    'set.launchAlarm': 'Launch alarm',
    'set.myClockIsAhead': 'My clock is ahead by (seconds)',
    'set.onByDefaultSounds': 'On by default. Sounds and vibrates shortly before your launch, then again at the moment itself, so a locked screen does not cost you the hit.',
    'set.pasteABackupInstead': 'Paste a backup instead',
    'set.pasteExportedJsonHere': 'Paste exported JSON here',
    'set.playsASilentTrack': 'Plays a silent track so the tab counts as active, and keeps the screen on while you are looking at it. Only while something is still to launch, and it does use extra battery.',
    'set.published': 'Published',
    'set.publishedIsWhenThe': 'Published is when the copy you are looking at went live. Compare it against your last deploy to tell a slow build apart from a stale browser cache.',
    'set.recommendedBufferSeconds': 'Recommended buffer (seconds)',
    'set.release': 'Release',
    'set.safetyBuffer': 'Safety buffer',
    'set.sayItOutLoud': 'Say it out loud',
    'set.settings': 'Settings',
    'set.shownAlongsideEstimatedRows': 'Shown alongside estimated rows as the margin to keep. It does not shift any calculated time — it is advice, not a fudge factor.',
    'set.soundAndVibrateBefore': 'Sound and vibrate before a launch',
    'set.thatFileCouldNot': 'That file could not be read.',
    'set.thatIsNotValid': 'That is not valid JSON.',
    'set.theDeveloperPublishesNo': 'The developer publishes no march formula. The two community models available disagree by roughly 2× on seconds per tile, and the “ceiling model” some sites cite for the red zone is never actually defined anywhere — so RallySync does not pretend to implement it. Log real marches and the estimates stop mattering.',
    'set.thisBrowserIsBlocking': 'This browser is blocking site storage, so nothing will survive a reload. Export a backup before you close the tab.',
    'set.thisIsTheLatest': 'This is the latest published version.',
    'set.useANegativeNumber': 'Use a negative number if this device is behind the game. The app subtracts this from every displayed time and countdown.',
    'set.version': 'Version',
    'set.volume': 'Volume',
    'set.warnThisManySeconds': 'Warn this many seconds before',
    'tgt.addAnother': 'Add another',
    'tgt.addAnotherOfThis': 'Add another of this type',
    'tgt.addTarget': 'Add target',
    'tgt.addWhateverYourAlliance': 'Add whatever your alliance hits — the Castle, turrets, Sanctuaries, Outposts. You can have as many of each as you like, with your own names.',
    'tgt.close': 'Close',
    'tgt.delete': 'Delete',
    'tgt.eGNorthSanctuary': 'e.g. North Sanctuary',
    'tgt.noTargetsOfThis': 'No targets of this type yet.',
    'tgt.noTargetsYet': 'No targets yet',
    'tgt.pickATypeTo': 'Pick a type to start from. It only sets the zone model and rally window — you can rename it and change both afterwards, and add as many of a type as you need.',
    'tgt.setXY': 'set X/Y',
    'tgt.targets': 'Targets',
    'tgt.whatAreYouAdding': 'What are you adding?',

    // In-context instructions, from guide.js.
    'guide.bulkPaste.note': 'Lines it cannot read are listed separately rather than skipped silently, so nobody goes missing.',
    'guide.bulkPaste.step0': 'One player per line: name, X, Y, then March Speed Up %.',
    'guide.bulkPaste.step1': 'Commas, spaces, brackets and x:/y: labels all work.',
    'guide.bulkPaste.title': 'Pasting a roster',
    'guide.cityCoords.note': 'Coordinates must be the city the rally launches from. If someone relocates, update them here.',
    'guide.cityCoords.step0': 'Switch to the World map.',
    'guide.cityCoords.step1': 'Tap the player’s city.',
    'guide.cityCoords.step2': 'Read the X and Y shown in its info panel.',
    'guide.cityCoords.title': 'Find a player’s city coordinates',
    'guide.marchSpeed.note': 'Enter the bonus only. If it shows 45%, type 45 — not 145.',
    'guide.marchSpeed.step0': 'Tap your avatar, top-left of the town screen.',
    'guide.marchSpeed.step1': 'Open Bonus Overview (under Power).',
    'guide.marchSpeed.step2': 'Scroll to the Military section.',
    'guide.marchSpeed.step3': 'Read the March Speed value.',
    'guide.marchSpeed.title': 'Find your March Speed Up %',
    'guide.marchTime.note': 'Verified against real marches: the number the screen shows before you commit is the time the march actually takes. It holds still rather than counting down, and it does not change with the rally window you picked, so there is no rush to read it. Small monsters offer only Attack rather than Rally — that screen shows the same number, so use it. Once typed in, that lead and target are exact and no formula is used for them again.',
    'guide.marchTime.step0': 'Tap the target on the map, then Rally.',
    'guide.marchTime.step1': 'Pick any rally window and tap Hold a rally.',
    'guide.marchTime.step2': 'On the troop screen, read the time beside the timer icon at the bottom right, just left of Deploy — that is the march time.',
    'guide.marchTime.step3': 'Leave with the arrow at the top left. Nothing is deployed, no rally is created, and no stamina is spent.',
    'guide.marchTime.step4': 'Type that time into Exact time on the result row.',
    'guide.marchTime.title': 'Read a march time without marching',
    'guide.rallyPower.note': 'Neither affects march timing. They are there so you can see how much force is landing on each target.',
    'guide.rallyPower.step0': 'Open the rally screen in game to see your march capacity.',
    'guide.rallyPower.step1': 'Power is the marching power shown for that troop selection.',
    'guide.rallyPower.step2': 'Both are optional — they only drive the committed totals.',
    'guide.rallyPower.title': 'Rally capacity and power',
    'guide.rallyWindow.note': 'RallySync subtracts this automatically, so the time it gives you is when to TAP the rally button — not when troops leave.',
    'guide.rallyWindow.step0': 'It is the gather countdown between opening a rally and the troops leaving.',
    'guide.rallyWindow.step1': 'A Castle rally marches at exactly 5 minutes whether or not it filled.',
    'guide.rallyWindow.step2': 'Leave this at 5 for Castle and turret rallies.',
    'guide.rallyWindow.step3': 'Set it to 0 for a solo march, which departs immediately.',
    'guide.rallyWindow.title': 'What is the rally window?',
    'guide.startTime.note': 'You never pick the landing time — it falls out of who is marching and how far they are. Add a slower player and the whole plan shifts later on its own.',
    'guide.startTime.step0': 'Set START RALLIES AT — the moment the first person taps.',
    'guide.startTime.step1': 'The slowest lead taps right then, because they need the most time.',
    'guide.startTime.step2': 'Everyone faster taps later, so all the marches arrive together.',
    'guide.startTime.step3': 'TROOPS LAND AT is the result: as early as the slowest lead can manage.',
    'guide.startTime.title': 'How the timing works',
    'guide.targetCoords.note': 'These are kingdom-specific. Set them once and they are reused every event.',
    'guide.targetCoords.step0': 'Switch to the World map.',
    'guide.targetCoords.step1': 'Tap the King’s Castle, a turret, or the structure you want.',
    'guide.targetCoords.step2': 'Read the X and Y from its info panel.',
    'guide.targetCoords.title': 'Find a target’s coordinates',
    'guide.timingChain.note': 'The rally window is the gather countdown set on the target — 5 minutes for a Castle. It is separate from the march, and both are already included in the tap time.',
    'guide.timingChain.step0': 'Start at TROOPS LAND AT — the moment everyone hits.',
    'guide.timingChain.step1': 'Subtract that player’s march time to get when their troops leave the city (DEPARTS).',
    'guide.timingChain.step2': 'Subtract the target’s rally window to get when they tap the rally button.',
    'guide.timingChain.step3': 'Slower players therefore tap earlier, so everyone still lands together.',
    'guide.timingChain.title': 'How your tap time is worked out',
    'guide.zoneAccuracy.note': 'The constants drift between sessions — one identical march has read 684s on one day and 777s on another — so treat them as a starting point, not gospel. For any target you actually care about, read its march time off the rally screen and set it with Exact time on the result row: that is exact, with no formula involved.',
    'guide.zoneAccuracy.step0': 'Monsters and player structures are two different families: a rally on a city or an HQ runs about 2.1x slower per tile than one on a Terror or Beast.',
    'guide.zoneAccuracy.step1': 'Each family is fitted from two real marches, read minutes apart so nothing else could drift between them.',
    'guide.zoneAccuracy.step2': 'The city line then predicted an HQ it had never seen to within 3 seconds, which is the only out-of-sample check in the model.',
    'guide.zoneAccuracy.step3': 'Castle and Ruins have never been measured at all, and anything far outside a fitted range is flagged on the results.',
    'guide.zoneAccuracy.title': 'Why some zones are trusted more than others',

    // The visual walkthrough, from howto.js.
    'howto.backOut.body': 'Leave using the arrow at the top left. No troops move, no rally is created and no stamina is spent. Never tap Deploy unless you actually mean to march.',
    'howto.backOut.title': 'Back out with the arrow',
    'howto.exactButton.body': 'On the lead’s row in Launch order, tap Exact time. The row is currently an estimate from the distance formula.',
    'howto.exactButton.title': 'Back in RallySync, tap Exact time',
    'howto.holdRally.body': 'Pick whichever gather time you like and tap Hold a rally. The march time does not depend on which window you chose, so this choice does not matter here.',
    'howto.holdRally.title': 'Hold a rally, any window',
    'howto.measured.body': 'The badge turns to MEASURED and the tap time is recalculated from the real march. No formula is used for that lead and target again.',
    'howto.measured.title': 'That row is now exact',
    'howto.readTimer.body': 'On the troop screen, the time to the left of Deploy is the real march time. It holds still rather than counting down, so there is no rush.',
    'howto.readTimer.title': 'Read the time beside the timer icon',
    'howto.tapRally.body': 'On the world map, tap the city, HQ or monster you plan to hit, then tap Rally. Nothing is committed by opening it.',
    'howto.tapRally.title': 'Open the target in Kingshot',
    'howto.title': 'How to get an exact launch time',
    'howto.typeIt.body': 'Enter it the way the game wrote it — 3:33 — or as plain seconds, 213. Then tap Set exact.',
    'howto.typeIt.title': 'Type what the game showed you',
    'howto.why': 'The distance formula is accurate to about 2% across 62 measured marches, which is close — but 2% of an eleven-minute march is thirteen seconds, and thirteen seconds is a rally that lands alone. Setting a real time once per lead and target removes the guess entirely.',

    // The Exact time call to action.
    'exact.helpTitle': 'Get this from the game without marching',
    'exact.tipSet': 'Using the real time you entered. No formula is involved for this lead and target.',
    'exact.tipUnset': 'The game will tell you the real march time before you march. Tap to enter it, and this row stops being an estimate.',
    'exact.what': 'The time below is worked out from the distance, so it is close but not exact. Kingshot will show you the real march time before you commit any troops — put that number here and this row becomes exact.',

    // Whole sentences with a {placeholder}, replacing fragments that
    // were concatenated with hard-coded English tails.
    'cal.fittedToMany': 'Fitted to {n} samples',
    'cal.fittedToOne': 'Fitted to {n} sample',
    'cal.lastRefittedOn': 'Last refitted {date}',
    'cal.switchedToModel': 'Switched to the {model}. Refit each zone from your samples.',
    'cal.typicalErrorOf': 'typical error {value}s',
    'cal.worstOf': 'worst {value}s',
    'calc.deleteNamed': 'Delete {name}',
    'calc.moveEarlier': 'Move {name} earlier',
    'calc.moveLater': 'Move {name} later',
    'calc.rallyWindowIncluded': 'The {window} rally window is already included — times below are when to TAP the rally button.',
    'calc.savedOn': 'Saved {date}',
    'ros.importedAndUpdated': 'Imported {added} new leads and updated {updated} existing.',
    'ros.importedMany': 'Imported {added} new leads.',
    'ros.importedOne': 'Imported {added} new lead.',
    'set.alarmClockNote': 'Either way, the alarm tones are booked on the audio clock up to two minutes ahead, and that clock is never throttled — so they still sound on time even if the tab is frozen. Spoken callouts cannot be booked ahead and may be missed while hidden.',
    'set.backupExportedAsFile': 'Backup exported as {name}.',
    'set.backupRestoredWith': 'Backup restored ({list}).',
    'set.languagesNote': 'These are the languages Kingshot itself supports. Partly translated ones fall back to English for anything still missing, so nothing goes blank.',
    'tgt.addAType': 'Add a {type}',
    'tgt.rallyWindowOf': 'rally {window}',

    // Duration shapes. The separator is part of the translation:
    // English "3m 33s" vs Japanese "3分33秒" with no space.
    'dur.hms': '{h}h {m}m {s}s',
    'dur.minutes': '{n} min',
    'dur.ms': '{m}m {s}s',
    'dur.s': '{s}s',
    'tgt.noWindow': 'none',
    'tgt.noCoordinates': 'no coordinates',
    'tgt.noRallyWindow': 'no rally window',

    // The countdown overlay and the time picker.
    'focus.alarmOff': 'Alarm off',
    'focus.alarmOn': 'Alarm on',
    'focus.close': 'Close',
    'focus.departs': 'Departs',
    'focus.estimated': 'estimated',
    'focus.estimatedNote': 'Community-estimated. Keep a couple of seconds spare and trust the in-game timer.',
    'focus.getReady': 'get ready',
    'focus.goNow': 'GO NOW',
    'focus.lands': 'Lands',
    'focus.local': 'Local',
    'focus.march': 'March',
    'focus.marchAt': 'March at',
    'focus.marchIn': 'MARCH IN',
    'focus.measured': 'measured',
    'focus.measuredNote': 'This came from a real march, so it is exact.',
    'focus.onTarget': 'on {name}',
    // Spoken only, standing in for a lead's name inside speech.rallyIn. It is
    // the word Kingshot itself uses to address the player -- the client says
    // Governor throughout ("the Cities of other Governors") -- so the callout
    // addresses them the way the game does rather than inventing a rank.
    'focus.rallyFallback': 'Governor',
    'focus.tapAt': 'Tap at',
    'focus.tapRallyIn': 'TAP RALLY IN',
    'focus.waiting': 'waiting',
    'focus.windowPassed': 'launch window passed',
    'focus.yourRally': 'Your rally',
    'tp.ago': '{time} ago',
    'tp.close': 'Close',
    'tp.dateLabel': 'DATE (UTC)',
    'tp.decrease': 'Decrease {unit}',
    'tp.fromNow': '{time} from now',
    'tp.hh': 'HH',
    'tp.increase': 'Increase {unit}',
    'tp.mm': 'MM',
    // Snap the start time to the next mark on an hour / half / quarter grid.
    // NOT "a time ending in :15" -- at 19:34 the quarter button gives 19:45.
    'tp.nextHour': 'Next hour',
    'tp.nextHalf': 'Next half hour',
    'tp.nextQuarter': 'Next quarter hour',
    'tp.nextDay': 'Next day',
    'tp.now': 'Now',
    'tp.prevDay': 'Previous day',
    'tp.rightNow': 'right now',
    'tp.setTime': 'Set time',
    'tp.ss': 'SS',
    'tp.today': 'Today',
    'tp.tomorrow': 'Tomorrow',
    'tp.utcNote': 'Entered and stored in UTC — the clock the game runs on.',
    'tp.zeroSecs': 'Zero secs',

    // Form labels passed as arguments, and the piecewise model.
    'cal.coefficient': 'Coefficient',
    'cal.exponent': 'Exponent',
    'cal.fixedOffset': 'Fixed offset (s)',
    'cal.insidePerTile': 'Inside s/tile',
    'cal.piecewiseSummary': '{near} s/tile to {join} · {far} s/tile + √ beyond',
    'cal.radiusTiles': 'Radius (tiles)',
    'cal.rallyLead': 'Rally lead',
    'cal.relicX': 'Relic X',
    'cal.relicY': 'Relic Y',
    'cal.secondsPerTile': 'Seconds per tile',
    'cal.speedDivisor': '÷ (1 + speed%/100)',
    'cal.targetField': 'Target',
    'field.x': 'X',
    'field.y': 'Y',
    'ros.allianceField': 'Alliance',
    'ros.marchPower': 'March power',
    'ros.nameField': 'Name',
    'ros.rallyCapacity': 'Rally capacity',
    'ros.squadField': 'Squad',
    'tgt.nameField': 'Name',
    'tgt.typeField': 'Type',
    'tgt.zoneModel': 'Zone model',

    // Text drawn inside the walkthrough figures.
    'howto.fig.attack': 'Attack',
    'howto.fig.deploy': 'Deploy',
    'howto.fig.getFromGame': 'Get this from the game without marching',
    'howto.fig.holdRally': 'Hold a rally',
    'howto.fig.mini1': '1. Tap the target, then Rally',
    'howto.fig.mini2': '2. Pick a window, Hold a rally',
    'howto.fig.mini3': '3. Read the time by the timer icon',
    'howto.fig.neverTap': 'never tap',
    'howto.fig.noFormula': 'No formula is used for this pair again.',
    'howto.fig.nowExact': 'The tap time is now exact.',
    'howto.fig.rally': 'Rally',
    'howto.fig.scout': 'Scout',
    'howto.fig.step1': '1. Tap the target, then Rally',
    'howto.fig.step2': '2. Any window will do',
    'howto.fig.step3': '3. THIS is the march time',
    'howto.fig.step4': '4. Back out. Nothing deploys, no stamina spent',
    'howto.fig.step5': '5. On the row, tap Exact time',
    'howto.fig.step6': '6. Type what the game showed',
    'howto.fig.step7': '7. Done — this row is a fact',
    'howto.fig.targetOnMap': 'target on the map',
    'howto.fig.targetTown': 'Target: Town',
    'howto.fig.troops': 'your heroes and troops',

    // The language sheet.
    'lang.close': 'Close',
    'lang.everythingFollows': 'Text, voice and the guide all follow.',
    'nav.language': 'Language',
    'set.changeLanguage': 'Change language',

    // Buttons. These were literals in the children array of el(),
    // so they never reached t() and shipped English in every language.
    'btn.addLead': 'Add a lead',
    'btn.addTarget': 'Add a target',
    'btn.checkUpdates': 'Check for updates',
    'btn.checking': 'Checking…',
    'btn.chooseLead': 'Choose a lead',
    'btn.chooseTarget': 'Choose a target',
    'btn.eraseAll': 'Erase everything',
    'btn.exportBackup': 'Export backup',
    'btn.fix': 'Fix',
    'btn.importBackup': 'Import backup',
    'btn.importPasted': 'Import pasted JSON',
    'btn.open': 'Open',
    'btn.preview': 'Preview',
    'btn.reloadUpdate': 'Reload to update',
    'btn.resetDefault': 'Reset to default',
    'btn.resetZones': 'Reset all zones',
    'btn.saveMeasurement': 'Save measurement',
    'btn.saveSetup': 'Save current setup',
    'btn.selectAll': 'Select all',
    'btn.testAlarm': 'Test launch alarm',
    'btn.testVoice': 'Test voice',
    'btn.testWarning': 'Test warning',
    'btn.useExample': 'Use example',
    'calc.noLeadsSelected': 'No rally leads selected.',

    // The first-run checklist.
    'qs.leads': 'Add your rally leads',
    'qs.leadsBody': 'Name, city X/Y, March Speed Up %. You can paste a whole list.',
    'qs.march': 'Log a real march',
    'qs.marchBody': 'Optional. Makes that lead exact instead of estimated.',
    'qs.targets': 'Set target coordinates',
    'qs.targetsBody': 'Castle, turrets, Sanctuary, Outpost — whatever you hit.',

    // The accuracy legend on the About panel.
    'tier.calibrated': 'Calibrated',
    'tier.calibratedBody': 'Zone constants fitted to your own recorded samples.',
    'tier.estimated': 'Estimated',
    'tier.estimatedBody': 'Unverified community defaults. Keep a safety buffer.',
    'tier.exact': 'Exact',
    'tier.exactBody': 'The time the game itself gave for this exact lead and target. Read it from the rally screen without deploying, then set it on the result row. No formula involved.',

    // Destructive confirmations, and counts that used to be glued
    // to English tails where both halves were English.
    'calc.countIncomplete': '{n} incomplete',
    'calc.countTooLate': '{n} too late',
    'calc.inMinutes': 'in {n}m',
    'calc.someNeedCoords': '{n} of these still need coordinates.',
    'common.thisLead': 'this lead',
    'common.thisTarget': 'this target',
    'confirm.deleteLead': 'Delete {name}? Their saved measurements go too.',
    'confirm.deleteSetup': 'Delete the setup "{name}"?',
    'confirm.deleteTarget': 'Delete {name}?',
    'confirm.eraseAll': 'Erase all leads, targets, measurements and calibration on this device? This cannot be undone.',
    'confirm.resetAllZones': 'Put every zone back on the shipped defaults? Fitted and hand-edited constants are discarded. Your logged marches and samples are kept, so you can refit.',
    'confirm.resetZone': 'Reset {zone} to its research-phase default?',
    'confirm.switchModel': 'Switch to the {model}? All fitted and hand-edited constants are discarded. Your logged marches and samples are kept.',
    'ros.sharedNames': '{n} leads share a name.',
    'ros.sharedNamesBody': 'They will appear as identical rows with different launch times, which is how somebody taps at the wrong moment. Rename or delete the spares.',
    'tgt.needCoordsBody': 'Open one and fill in the X/Y you see in game.',
    'tgt.needCoordsMany': '{n} targets still need coordinates.',
    'tgt.needCoordsOne': '{n} target still needs coordinates.',

    // The calibration feedback loop, the paste preview, and three
    // stray messages that were English in every language.
    'btn.refitMany': 'Refit from {n} samples',
    'btn.refitOne': 'Refit from {n} sample',
    'cal.leadMissingData': '{name} is missing coordinates or March Speed Up % — fill those in first, or the sample cannot be fitted.',
    'cal.modelWasClose': 'The model predicted {time} — close already.',
    'cal.modelWasOff': 'The model predicted {time}, so it was {factor}. That is the community default being wrong, not your reading.',
    'cal.nSamplesMany': '{n} samples',
    'cal.nSamplesOne': '{n} sample',
    'cal.oneSampleOnly': 'One sample can only fit a straight line. Log a second at a clearly different distance and the curve itself can be fitted.',
    'cal.pairNowExact': '{lead} → {target} is now exact at {time}.',
    'cal.recordedOn': '{time} · recorded {date}',
    'cal.sampleMeta': '{tiles} tiles at +{speed}% · {date}',
    'cal.staleSince': '{time} · stale, inputs changed since recording',
    'cal.targetNoCoords': '{name} has no coordinates yet.',
    'cal.timeUnreadable': 'That march time could not be read. Try 95, 95s, 1m35s or 1:35.',
    'cal.tooFast': '{n}× too fast',
    'cal.tooSlow': '{n}× too slow',
    'cal.zoneNotRefitted': '{zone} not refitted: {reason}',
    'cal.zoneRefitMany': '{zone} refitted to {n} samples.',
    'cal.zoneRefitOne': '{zone} refitted to {n} sample.',
    'cal.zoneRefittedMany': '{zone} refitted to {summary} from {n} samples.',
    'cal.zoneRefittedOne': '{zone} refitted to {summary} from {n} sample.',
    'cal.zoneReset': '{zone} reset to defaults.',
    'calc.unknownZone': 'Unknown zone "{key}".',
    'common.thatLead': 'That lead',
    'common.thatTarget': 'That target',
    'ros.importMany': 'Import {n} leads',
    'ros.importOne': 'Import {n} lead',
    'ros.nPower': '{n} power',
    'ros.nReady': '{n} ready',
    'ros.nUnreadable': '{n} unreadable',
    'ros.noSpeed': 'no speed %',
    'ros.speedPercent': '+{n}% speed',
    'set.publishedAt': 'Published {when} UTC.',
    'set.serverReturned': 'Server returned {status}.',

    // The results screen, the per-row copy, and the shareable plan
    // block that gets pasted into chat.
    'calc.addAllIn': 'Add all {n} in {group}',
    'calc.allLandAt': 'All {n} land {time} UTC',
    'calc.allLaunched': 'all launched',
    'calc.bufferSeconds': '{n}s buffer',
    'calc.diagonalMany': '{n} marches run close to 45 degrees, and the one such march measured took about 30% longer than its straight-line distance implies',
    'calc.diagonalOne': '{n} march runs close to 45 degrees, and the one such march measured took about 30% longer than its straight-line distance implies',
    'calc.estimatesNote': 'Rows marked {badge} come from a real march you logged and are exact. Everything else should carry a {buffer} — the in-game countdown is the final word.',
    'calc.extrapolating': 'Extrapolating: {list}. Log a real march for those and they become exact.',
    'calc.firstGoIn': 'first go in {time}',
    'calc.formulaAgreed': 'The formula agreed with this to within a second.',
    'calc.formulaWasFast': 'Using this. The formula was {time} too fast.',
    'calc.formulaWasSlow': 'Using this. The formula was {time} too slow.',
    'calc.gapChip': '{n}s gap',
    'calc.landingsApart': '{n} landings {gap}s apart from {time} UTC',
    'calc.nPower': '{n} power',
    'calc.nRallyMany': '{n} rallies',
    'calc.nRallyOne': '{n} rally',
    'calc.nTroops': '{n} troops',
    'calc.noPlanYet': 'no plan yet',
    'calc.offSpeedMany': '{n} leads march at a speed the model has never been measured at (it was fitted only at +{speeds}%)',
    'calc.offSpeedOne': '{n} lead marches at a speed the model has never been measured at (it was fitted only at +{speeds}%)',
    'calc.removeAllIn': 'Remove all {n} in {group}',
    'calc.setupN': 'Setup {n}',
    'copy.departs': 'Departs {time} UTC',
    'copy.distance': 'Distance {distance}',
    'copy.from': 'From X:{x} Y:{y}',
    'copy.lands': 'Lands {time} UTC',
    'copy.march': 'March {time}',
    'copy.marchAt': 'March at {time} UTC',
    'copy.speed': 'Speed +{n}%',
    'copy.tapRallyAt': 'Tap rally at {time} UTC',
    'copy.to': 'To X:{x} Y:{y}',
    'copy.unnamedRally': 'Rally',
    'share.allTimesUtc': 'All times UTC. Rally window already subtracted.',
    'share.blocked': 'BLOCKED: {reason}',
    'share.bufferNote': 'Rows without `*exact` are estimates — keep a {n}s buffer.',
    'share.colLands': 'LANDS',
    'share.colMarch': 'MARCH',
    'share.colName': 'NAME',
    'share.colTapAt': 'TAP AT',
    'share.colTarget': 'TARGET',
    'share.multiTarget': 'multi-target',
    'share.ralliesOpen': 'Rallies open {time} UTC',
    'share.sequenceLine': 'Sequence: {gap}s apart from {time} UTC',
    'share.syncLine': 'Sync: everyone lands {time} UTC',
    'share.target': 'Target',
    'share.unnamed': 'Unnamed',
    'calc.beyondMany': '{n} marches are well outside the distance its zone was measured over',
    'calc.beyondOne': '{n} march is well outside the distance its zone was measured over',

    // Empty states, help text and error messages that lived in ternary
    // arms, where a +-only guard could not see them.
    'btn.pressCtrlC': 'Press Ctrl+C',
    'calc.alarmOffTitle': 'Turn on sound and vibration before each launch',
    'calc.alarmOnTitle': 'Sound and vibration before each launch — tap to turn off',
    'calc.anchorEarliest': 'as early as the slowest lead can make it',
    'calc.anchorFromPlan': 'worked out from the slowest march once a plan exists',
    'calc.hideSetup': 'Hide setup',
    'calc.multiTarget': 'Multi-target',
    'calc.nLeadsMany': '{n} leads',
    'calc.nLeadsOne': '{n} lead',
    'calc.noSpeedShort': 'no speed',
    'calc.noTarget': 'No target',
    'calc.noTargetMatches': 'No target matches that.',
    'calc.openSetupLeads': 'Open Setup and tap the leads joining this hit.',
    'calc.openSetupTarget': 'Open Setup and choose what you are hitting.',
    'calc.pickATarget': 'Pick a target',
    'calc.searchTargets': 'Search your targets…',
    'calc.selectMarching': 'Select who is marching',
    'calc.setup': 'Setup',
    'calc.unnamedTarget': 'Unnamed',
    'ros.emptySub': 'Add everyone who opens rallies. Saved on this device.',
    'ros.nSavedMany': '{n} leads saved',
    'ros.nSavedOne': '{n} lead saved',
    'set.audioArmsOnTap': 'Browsers only allow audio after you have tapped the page once, so the alarm arms itself on your first tap.',
    'set.audioUnsupported': 'This browser does not support the audio API, so only vibration will be used.',
    'set.bgActiveNow': 'active now',
    'set.bgIdle': 'idle — no launch pending',
    'set.cannotReach': 'Could not reach the server — you may be offline.',
    'set.noPublishDate': 'The server did not say when this was published.',
    'set.screenHeld': 'screen held on',
    'set.screenLockAvailable': 'screen lock available',
    'set.screenLockUnsupported': 'screen lock not supported here',
    'set.speechHelp': 'Calls each lead by name — “TS, rally in 30 seconds”, then “TS, go now” — at 60, 30 and 10 seconds. Uses your device’s own voice, so it works offline.',
    'set.speechUnsupported': 'This browser has no speech support, so only the tones will play.',
    'state.noSamples': 'No samples recorded for this zone yet.',
    'state.noUsableFit': 'These samples do not produce a usable fit.',
    'state.unknownZone': 'Unknown zone.',
    'store.differentApp': 'That backup came from a different app.',
    'store.noData': 'That backup contained no RallySync data.',
    'store.notBackup': 'That file is not a RallySync backup.',
    'tgt.emptySub': 'Set your kingdom’s coordinates once. Reused every event.',
    'tgt.nSavedMany': '{n} targets saved',
    'tgt.nSavedOne': '{n} target saved',
    // Separator between the clauses of calc.extrapolating. A semicolon, not a
    // comma: the clauses each contain their own commas, so joining them with
    // one more is a comma splice that hides where each warning ends. Chinese
    // takes ； for exactly this reason (GB/T 15834); Japanese takes 、;
    // Thai takes a bare space, which is how Thai separates clauses.
    'calc.listJoiner': '; '
  };

  /**
   * Overlays. Kept terse on purpose: these are read on a phone, mid-event, by
   * someone about to tap a button, so the game's own wording is preferred over
   * a more literal translation wherever the two differ.
   */
  var DICT = {
    // Filled by js/locale/*.js at load time. Kept empty here so a language is
    // one self-contained file rather than a slice of a growing monolith.
  };

  /**
   * Adds or extends a locale. Merges rather than replaces so a file can be
   * split up later without changing how it loads.
   */
  function register(code, table) {
    if (!code || !table) return;
    var into = DICT[code] || (DICT[code] = {});
    Object.keys(table).forEach(function (k) { into[k] = table[k]; });
    return into;
  }

  var current = 'en';

  function known(code) {
    for (var i = 0; i < LANGUAGES.length; i++) {
      if (LANGUAGES[i].code === code) return LANGUAGES[i];
    }
    return null;
  }

  /**
   * Best match for a browser tag. "pt-BR" takes Portuguese, "zh-TW" and "zh-HK"
   * take Traditional rather than falling back to Simplified, which would be
   * readable but wrong.
   */
  function resolve(tag) {
    if (!tag) return null;
    var raw = String(tag);
    var lower = raw.toLowerCase();
    if (known(raw)) return raw;
    if (lower.indexOf('zh') === 0) {
      return /hant|tw|hk|mo/.test(lower) ? 'zh-Hant' : 'zh-Hans';
    }
    var base = lower.split('-')[0];
    return known(base) ? base : null;
  }

  /** The first browser preference the app can actually speak. */
  function detect() {
    var nav = root.navigator || {};
    var list = nav.languages && nav.languages.length ? nav.languages : [nav.language];
    for (var i = 0; i < list.length; i++) {
      var hit = resolve(list[i]);
      if (hit) return hit;
    }
    return 'en';
  }

  /**
   * Look up a key. Falls back to English, then to the key itself — a missing
   * translation should read as English, never as a blank button.
   */
  function t(key, params) {
    var table = DICT[current] || {};
    var text = table[key];
    if (text === undefined) text = EN[key];
    if (text === undefined) return key;
    if (params) {
      Object.keys(params).forEach(function (name) {
        text = text.split('{' + name + '}').join(params[name]);
      });
    }
    return text;
  }

  function setLanguage(code) {
    current = known(code) ? code : 'en';
    var def = known(current);
    var doc = root.document;
    if (doc && doc.documentElement) {
      doc.documentElement.setAttribute('lang', current);
      doc.documentElement.setAttribute('dir', def && def.rtl ? 'rtl' : 'ltr');
    }
    return current;
  }

  function language() { return current; }

  /**
   * The tag to hand a speech engine. Our own codes are close to BCP-47 but the
   * Chinese ones are not: a synthesiser wants a REGION, so zh-Hans has to
   * become zh-CN and zh-Hant zh-TW or it falls back to the default voice and
   * reads Chinese with an English accent.
   */
  function speechTag() {
    if (current === 'zh-Hans') return 'zh-CN';
    if (current === 'zh-Hant') return 'zh-TW';
    return current;
  }
  function isRtl() { var d = known(current); return !!(d && d.rtl); }

  /** How much of the key set a locale actually covers, for the picker. */
  function coverage(code) {
    if (code === 'en') return 1;
    var table = DICT[code];
    if (!table) return 0;
    var keys = Object.keys(EN);
    var have = 0;
    for (var i = 0; i < keys.length; i++) if (table[keys[i]] !== undefined) have++;
    return have / keys.length;
  }

  root.RallySync = root.RallySync || {};
  root.RallySync.i18n = {
    LANGUAGES: LANGUAGES,
    KEYS: EN,
    DICT: DICT,
    register: register,
    t: t,
    detect: detect,
    resolve: resolve,
    setLanguage: setLanguage,
    language: language,
    speechTag: speechTag,
    isRtl: isRtl,
    coverage: coverage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
