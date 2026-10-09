export const locales = ["sk", "cs"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export const copy = {
  sk: {
    navModes: "Herné módy",
    navStory: "Náš príbeh",
    navCommunity: "Komunita",
    join: "Pripojiť sa",
    eyebrow: "Minecraft komunita · CZ / SK",
    titleOne: "Hraj po",
    titleTwo: "svojom.",
    intro:
      "Minecraft PvP, ktoré vzniklo z jednoduchej myšlienky: dobrá hra má byť férová pre každého.",
    explore: "Preskúmať server",
    story: "Náš príbeh",
    playerFounded: "Založené hráčmi. Budované komunitou.",
    serverKicker: "PRIPOJENIE",
    serverTitle: "Tvoj svet je\nna dosah.",
    serverIntro: "Priprav sa, skopíruj adresu a vidíme sa v hre.",
    serverAddress: "SERVEROVÁ ADRESA",
    copyIp: "Kopírovať IP",
    copied: "IP servera bola skopírovaná.",
    copyFailed: "Kopírovanie zlyhalo. IP: mc.ninjamelon.cz",
    onlinePlayers: "HRÁČI ONLINE",
    maxSlots: "MAX. SLOTOV",
    waitingBridge: "Čaká sa na overené pripojenie k sieti",
    unavailable: "Stav nedostupný",
    online: "Sieť online",
    offline: "Sieť offline",
    modesKicker: "VYBER SI SVOJ REŽIM",
    modesTitle: "Každý svet má\nsvoje pravidlá.",
    modesIntro:
      "Tri rôzne spôsoby, ako sa stretnúť v hre. Dostupnosť sa zobrazí až po overení siete.",
    unknown: "Stav neoverený",
    duelDescription: "PvP súboje jeden na jedného.",
    anarchyDescription: "Zvládneš prežiť v chaose?",
    knockbackDescription: "Voľný súboj. Zostaň na ostrove.",
    viewServer: "Zobraziť server",
    storyKicker: "PREČO SME ZAČALI",
    storyTitle: "Server, aký sme\nsami hľadali.",
    storyBody:
      "NinjaMelon vznikol z frustrácie z nespravodlivých banov, cheatov a predražených výhod. Rozhodli sme sa vytvoriť vlastný PvP server s férovým prístupom, dobrou komunitou a dôrazom na moderovanie.",
    storyOrigin:
      "Projekt sa začal ako malý hobby server na prelome rokov 2024 a 2025. Základná myšlienka zostáva rovnaká: prefix neurčuje hodnotu hráča.",
    becomePart: "Staň sa súčasťou príbehu",
    communityKicker: "TVOJA ĎALŠIA PARTIA",
    communityTitle: "Postavme to\nspolu.",
    communityBody:
      "Pripoj sa k hre a spoznaj ľudí, ktorí stoja za svetom NinjaMelon.",
    discordMissing: "Discord zatiaľ nie je nakonfigurovaný.",
    footerLine: "Férová hra. Dobrá partia. Tvoj ďalší svet.",
    backTop: "Späť hore",
    originalSite: "Pôvodný web",
    worldTag: "SVET 01",
    spawnTag: "TVOJ ĎALŠÍ SPAWN",
    scrollDown: "Posuň sa nižšie",
  },
  cs: {
    navModes: "Herní módy",
    navStory: "Náš příběh",
    navCommunity: "Komunita",
    join: "Připojit se",
    eyebrow: "Minecraft komunita · CZ / SK",
    titleOne: "Hraj po",
    titleTwo: "svém.",
    intro:
      "Minecraft PvP, které vzniklo z jednoduché myšlenky: dobrá hra má být férová pro každého.",
    explore: "Prozkoumat server",
    story: "Náš příběh",
    playerFounded: "Založeno hráči. Budováno komunitou.",
    serverKicker: "PŘIPOJENÍ",
    serverTitle: "Tvůj svět je\nnadosah.",
    serverIntro: "Připrav se, zkopíruj adresu a vidíme se ve hře.",
    serverAddress: "ADRESA SERVERU",
    copyIp: "Zkopírovat IP",
    copied: "IP serveru byla zkopírována.",
    copyFailed: "Kopírování selhalo. IP: mc.ninjamelon.cz",
    onlinePlayers: "HRÁČI ONLINE",
    maxSlots: "MAX. SLOTŮ",
    waitingBridge: "Čeká se na ověřené připojení k síti",
    unavailable: "Stav nedostupný",
    online: "Síť online",
    offline: "Síť offline",
    modesKicker: "VYBER SI SVŮJ REŽIM",
    modesTitle: "Každý svět má\nsvoje pravidla.",
    modesIntro:
      "Tři různé způsoby, jak se potkat ve hře. Dostupnost se zobrazí až po ověření sítě.",
    unknown: "Stav neověřený",
    duelDescription: "PvP souboje jeden na jednoho.",
    anarchyDescription: "Zvládneš přežít v chaosu?",
    knockbackDescription: "Volný souboj. Zůstaň na ostrově.",
    viewServer: "Zobrazit server",
    storyKicker: "PROČ JSME ZAČALI",
    storyTitle: "Server, jaký jsme\nsami hledali.",
    storyBody:
      "NinjaMelon vznikl z frustrace z nespravedlivých banů, cheatů a předražených výhod. Rozhodli jsme se vytvořit vlastní PvP server s férovým přístupem, dobrou komunitou a důrazem na moderování.",
    storyOrigin:
      "Projekt začal jako malý hobby server na přelomu let 2024 a 2025. Základní myšlenka zůstává stejná: prefix neurčuje hodnotu hráče.",
    becomePart: "Staň se součástí příběhu",
    communityKicker: "TVÁ DALŠÍ PARTA",
    communityTitle: "Postavme to\nspolu.",
    communityBody:
      "Připoj se do hry a poznej lidi, kteří stojí za světem NinjaMelon.",
    discordMissing: "Discord zatím není nakonfigurován.",
    footerLine: "Férová hra. Dobrá parta. Tvůj další svět.",
    backTop: "Zpět nahoru",
    originalSite: "Původní web",
    worldTag: "SVĚT 01",
    spawnTag: "TVŮJ DALŠÍ SPAWN",
    scrollDown: "Posuň se níže",
  },
} as const;

export type Copy = (typeof copy)[Locale];
