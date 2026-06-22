// =============================================================================
// Blood on the Clocktower - Character Database
// 血染钟楼 - 角色数据库
// =============================================================================

// -----------------------------------------------------------------------------
// Type colors and labels
// -----------------------------------------------------------------------------

export const TYPE_COLORS = {
  townsfolk: '#1e6bb8',
  outsider: '#46a86c',
  minion: '#c94922',
  demon: '#b72a2a',
};

export const TYPE_LABELS = {
  townsfolk: '镇民',
  outsider: '外来者',
  minion: '爪牙',
  demon: '恶魔',
};

// -----------------------------------------------------------------------------
// Characters
// -----------------------------------------------------------------------------

export const CHARACTERS = {
  // ===========================================================================
  // Trouble Brewing (初来乍到) - Townsfolk
  // ===========================================================================
  washerwoman: {
    id: 'washerwoman',
    name: '洗衣妇',
    nameEn: 'Washerwoman',
    type: 'townsfolk',
    ability: '在你的首个夜晚，你会得知两名玩家中的某一名是某个特定的镇民角色。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 32,
  },
  librarian: {
    id: 'librarian',
    name: '图书管理员',
    nameEn: 'Librarian',
    type: 'townsfolk',
    ability: '在你的首个夜晚，你会得知两名玩家中的某一名是某个特定的外来者角色，或得知没有外来者在场。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 33,
  },
  investigator: {
    id: 'investigator',
    name: '调查员',
    nameEn: 'Investigator',
    type: 'townsfolk',
    ability: '在你的首个夜晚，你会得知两名玩家中的某一名是某个特定的爪牙角色。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 34,
  },
  chef: {
    id: 'chef',
    name: '厨师',
    nameEn: 'Chef',
    type: 'townsfolk',
    ability: '在你的首个夜晚，你会得知有多少对邪恶玩家彼此相邻。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 35,
  },
  empath: {
    id: 'empath',
    name: '共情者',
    nameEn: 'Empath',
    type: 'townsfolk',
    ability: '每个夜晚，你会得知你存活的邻座中有多少名邪恶玩家。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 36,
    otherNightsOrder: 53,
  },
  fortune_teller: {
    id: 'fortune_teller',
    name: '占卜师',
    nameEn: 'Fortune Teller',
    type: 'townsfolk',
    ability: '每个夜晚，你选择两名玩家并得知他们之中是否有恶魔。有一名善良玩家会被你误认为恶魔。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 37,
    otherNightsOrder: 54,
  },
  undertaker: {
    id: 'undertaker',
    name: '入殓师',
    nameEn: 'Undertaker',
    type: 'townsfolk',
    ability: '每个夜晚*，你会得知今天白天被处决死亡的玩家的角色。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 55,
  },
  monk: {
    id: 'monk',
    name: '僧侣',
    nameEn: 'Monk',
    type: 'townsfolk',
    ability: '每个夜晚*，选择一名非你自己的玩家，该玩家今晚对恶魔的能力免疫。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 12,
  },
  ravenkeeper: {
    id: 'ravenkeeper',
    name: '守鸦人',
    nameEn: 'Ravenkeeper',
    type: 'townsfolk',
    ability: '如果你在夜晚死亡，你会被唤醒并选择一名玩家，你会得知该玩家的角色。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 52,
  },
  virgin: {
    id: 'virgin',
    name: '处女',
    nameEn: 'Virgin',
    type: 'townsfolk',
    ability: '首个提名你的镇民玩家会立即被处决。',
    firstNight: false,
    otherNights: false,
  },
  slayer: {
    id: 'slayer',
    name: '猛士',
    nameEn: 'Slayer',
    type: 'townsfolk',
    ability: '白天，你可以选择一名玩家公开一次。如果该玩家是恶魔，该玩家死亡。',
    firstNight: false,
    otherNights: false,
  },
  soldier: {
    id: 'soldier',
    name: '士兵',
    nameEn: 'Soldier',
    type: 'townsfolk',
    ability: '你对恶魔的能力免疫。',
    firstNight: false,
    otherNights: false,
  },
  mayor: {
    id: 'mayor',
    name: '市长',
    nameEn: 'Mayor',
    type: 'townsfolk',
    ability: '如果只剩三名玩家存活且其中没有玩家被处决，你的阵营获胜。如果你在夜晚将要死亡，可能改为另一名玩家死亡。',
    firstNight: false,
    otherNights: false,
  },

  // ===========================================================================
  // Trouble Brewing (初来乍到) - Outsiders
  // ===========================================================================
  butler: {
    id: 'butler',
    name: '管家',
    nameEn: 'Butler',
    type: 'outsider',
    ability: '每个夜晚，选择一名玩家（非你自己）。明天投票时，只有在该玩家投票后你才能投票。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 39,
    otherNightsOrder: 67,
  },
  drunk: {
    id: 'drunk',
    name: '酒鬼',
    nameEn: 'Drunk',
    type: 'outsider',
    ability: '你以为你是一个镇民角色，但实际上你不是。你的能力不会生效。',
    firstNight: false,
    otherNights: false,
  },
  recluse: {
    id: 'recluse',
    name: '隐士',
    nameEn: 'Recluse',
    type: 'outsider',
    ability: '你可能会被识别为邪恶阵营并被相关能力影响，即使你其实是善良的。',
    firstNight: false,
    otherNights: false,
  },
  saint: {
    id: 'saint',
    name: '圣徒',
    nameEn: 'Saint',
    type: 'outsider',
    ability: '如果你被处决死亡，你的阵营（善良）失败。',
    firstNight: false,
    otherNights: false,
  },

  // ===========================================================================
  // Trouble Brewing (初来乍到) - Minions
  // ===========================================================================
  poisoner: {
    id: 'poisoner',
    name: '毒师',
    nameEn: 'Poisoner',
    type: 'minion',
    ability: '每个夜晚，选择一名玩家，该玩家今晚和明天白天中毒（能力失效且可能得到错误信息）。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 17,
    otherNightsOrder: 7,
  },
  spy: {
    id: 'spy',
    name: '间谍',
    nameEn: 'Spy',
    type: 'minion',
    ability: '每个夜晚，你可以查看魔典。你可能会被识别为善良阵营并被相关能力影响。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 49,
    otherNightsOrder: 68,
  },
  scarlet_woman: {
    id: 'scarlet_woman',
    name: '绯绒女',
    nameEn: 'Scarlet Woman',
    type: 'minion',
    ability: '如果存活玩家在五名或以上时恶魔死亡，你会成为恶魔。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 19,
  },
  baron: {
    id: 'baron',
    name: '男爵',
    nameEn: 'Baron',
    type: 'minion',
    ability: '场上会额外增加两名外来者角色。',
    firstNight: false,
    otherNights: false,
  },

  // ===========================================================================
  // Trouble Brewing (初来乍到) - Demons
  // ===========================================================================
  imp: {
    id: 'imp',
    name: '小鬼',
    nameEn: 'Imp',
    type: 'demon',
    ability: '每个夜晚*，选择一名玩家，该玩家死亡。如果你以此方式自杀，一名爪牙会成为小鬼。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 24,
  },

  // ===========================================================================
  // Bad Moon Rising (暗流涌动) - Townsfolk
  // ===========================================================================
  grandmother: {
    id: 'grandmother',
    name: '奶奶',
    nameEn: 'Grandmother',
    type: 'townsfolk',
    ability: '在你的首个夜晚，你会得知一名善良玩家及其角色。如果恶魔杀死了该玩家，你也会死亡。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 40,
  },
  sailor: {
    id: 'sailor',
    name: '水手',
    nameEn: 'Sailor',
    type: 'townsfolk',
    ability: '每个夜晚，选择一名存活的玩家，你们中的一个会喝醉（能力失效）直到下个黄昏。你在醉酒时无法死亡。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 11,
    otherNightsOrder: 4,
  },
  chambermaid: {
    id: 'chambermaid',
    name: '侍女',
    nameEn: 'Chambermaid',
    type: 'townsfolk',
    ability: '每个夜晚，选择两名存活的非你自己的玩家，你会得知他们之中有几个今晚因自己的能力而被唤醒。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 50,
    otherNightsOrder: 69,
  },
  exorcist: {
    id: 'exorcist',
    name: '驱魔人',
    nameEn: 'Exorcist',
    type: 'townsfolk',
    ability: '每个夜晚*，选择一名玩家（之前不能选相同的玩家）。如果你选择了恶魔，恶魔今晚不会行动且你会得知。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 21,
  },
  innkeeper: {
    id: 'innkeeper',
    name: '旅店老板',
    nameEn: 'Innkeeper',
    type: 'townsfolk',
    ability: '每个夜晚*，选择两名玩家，他们今晚对恶魔的能力免疫。其中一名会喝醉到明天黄昏。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 9,
  },
  gambler: {
    id: 'gambler',
    name: '赌徒',
    nameEn: 'Gambler',
    type: 'townsfolk',
    ability: '每个夜晚*，猜测一名玩家的角色。如果你猜错了，你会死亡。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 3,
  },
  gossip: {
    id: 'gossip',
    name: '八卦婆',
    nameEn: 'Gossip',
    type: 'townsfolk',
    ability: '每天白天，你可以公开做一个陈述。如果该陈述为真，今晚一名玩家可能会死亡。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 37,
  },
  courtier: {
    id: 'courtier',
    name: '依布士',
    nameEn: 'Courtier',
    type: 'townsfolk',
    ability: '游戏中一次，在夜晚选择一个角色。如果该角色在场，该玩家喝醉三天三夜。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 18,
    otherNightsOrder: 8,
  },
  professor: {
    id: 'professor',
    name: '教授',
    nameEn: 'Professor',
    type: 'townsfolk',
    ability: '游戏中一次，在夜晚选择一名已死亡的玩家。如果该玩家是镇民，该玩家复活。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 43,
  },
  minstrel: {
    id: 'minstrel',
    name: '游吟诗人',
    nameEn: 'Minstrel',
    type: 'townsfolk',
    ability: '当一名爪牙被处决死亡后，所有其他玩家（除了旅行者）在下一个夜晚中醉酒直到明天黄昏。',
    firstNight: false,
    otherNights: false,
  },
  tea_lady: {
    id: 'tea_lady',
    name: '茶老太太',
    nameEn: 'Tea Lady',
    type: 'townsfolk',
    ability: '如果你的两个存活邻座都是善良的，他们无法死亡。',
    firstNight: false,
    otherNights: false,
  },
  pacifist: {
    id: 'pacifist',
    name: '和平主义者',
    nameEn: 'Pacifist',
    type: 'townsfolk',
    ability: '被处决的善良玩家可能不会死亡。',
    firstNight: false,
    otherNights: false,
  },
  fool: {
    id: 'fool',
    name: '愚人',
    nameEn: 'Fool',
    type: 'townsfolk',
    ability: '你第一次将要死亡时，你不会死亡。',
    firstNight: false,
    otherNights: false,
  },

  // ===========================================================================
  // Bad Moon Rising (暗流涌动) - Outsiders
  // ===========================================================================
  tinker: {
    id: 'tinker',
    name: '修补匠',
    nameEn: 'Tinker',
    type: 'outsider',
    ability: '你随时可能会死亡。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 48,
  },
  moonchild: {
    id: 'moonchild',
    name: '月孩',
    nameEn: 'Moonchild',
    type: 'outsider',
    ability: '当你得知你死亡时，你需要公开选择一名存活的玩家。如果该玩家是善良的，该玩家死亡。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 50,
  },
  goon: {
    id: 'goon',
    name: '弄臣',
    nameEn: 'Goon',
    type: 'outsider',
    ability: '每个夜晚，第一个选择你的玩家会变为醉酒直到下个黄昏。你转变为该玩家的阵营。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 21,
    otherNightsOrder: 22,
  },
  lunatic: {
    id: 'lunatic',
    name: '疯子',
    nameEn: 'Lunatic',
    type: 'outsider',
    ability: '你以为你是恶魔，但其实不是。恶魔知道你是谁，并且会假装你的行为有效。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 8,
    otherNightsOrder: 1,
  },

  // ===========================================================================
  // Bad Moon Rising (暗流涌动) - Minions
  // ===========================================================================
  godfather: {
    id: 'godfather',
    name: '教父',
    nameEn: 'Godfather',
    type: 'minion',
    ability: '如果今天白天有外来者被处决死亡，今晚你选择一名玩家，该玩家死亡。场上的外来者数量会发生变化。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 26,
  },
  devils_advocate: {
    id: 'devils_advocate',
    name: '魔鬼代言人',
    nameEn: "Devil's Advocate",
    type: 'minion',
    ability: '每个夜晚，选择一名存活的玩家（之前不能选相同的）。如果该玩家明天被处决，该玩家不会死亡。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 19,
    otherNightsOrder: 10,
  },
  assassin: {
    id: 'assassin',
    name: '刺客',
    nameEn: 'Assassin',
    type: 'minion',
    ability: '游戏中一次，在夜晚*，选择一名玩家，该玩家死亡，即使该玩家有保护能力。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 36,
  },
  mastermind: {
    id: 'mastermind',
    name: '主谋',
    nameEn: 'Mastermind',
    type: 'minion',
    ability: '如果恶魔被处决死亡，游戏还会继续进行。在之后的下一个白天（非当天），如果有一名玩家被处决，该玩家若是善良的则邪恶阵营获胜。',
    firstNight: false,
    otherNights: false,
  },

  // ===========================================================================
  // Bad Moon Rising (暗流涌动) - Demons
  // ===========================================================================
  zombuul: {
    id: 'zombuul',
    name: '僵尸',
    nameEn: 'Zombuul',
    type: 'demon',
    ability: '每个夜晚*，如果没有人在今天白天死亡，选择一名玩家，该玩家死亡。你第一次将要死亡时，你不会死亡而是进入假死状态。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 25,
  },
  pukka: {
    id: 'pukka',
    name: '蓒古豪',
    nameEn: 'Pukka',
    type: 'demon',
    ability: '每个夜晚，选择一名玩家，该玩家中毒。上一个被你如此选择的玩家将会死亡然后恢复健康。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 28,
    otherNightsOrder: 27,
  },
  shabaloth: {
    id: 'shabaloth',
    name: '影魂兽',
    nameEn: 'Shabaloth',
    type: 'demon',
    ability: '每个夜晚*，选择两名玩家，他们死亡。一名上一个夜晚死于你的能力的玩家可能会复活。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 28,
  },
  po: {
    id: 'po',
    name: '波',
    nameEn: 'Po',
    type: 'demon',
    ability: '每个夜晚*，你可以选择一名玩家，该玩家死亡。如果你上个夜晚选择了无人，你可以改为选择三名玩家，他们死亡。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 29,
  },

  // ===========================================================================
  // Sects & Violets (梦中杀机) - Townsfolk
  // ===========================================================================
  clockmaker: {
    id: 'clockmaker',
    name: '钟表匠',
    nameEn: 'Clockmaker',
    type: 'townsfolk',
    ability: '在你的首个夜晚，你会得知恶魔和与之最近的爪牙之间隔了几个座位。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 41,
  },
  dreamer: {
    id: 'dreamer',
    name: '梦中人',
    nameEn: 'Dreamer',
    type: 'townsfolk',
    ability: '每个夜晚，选择一名玩家（之前不能选相同的），你会得知一个善良角色和一个邪恶角色，其中之一是该玩家的角色。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 42,
    otherNightsOrder: 56,
  },
  snake_charmer: {
    id: 'snake_charmer',
    name: '弄蛇人',
    nameEn: 'Snake Charmer',
    type: 'townsfolk',
    ability: '每个夜晚，选择一名存活的玩家。如果该玩家是恶魔，你和该玩家交换角色和阵营，且你中毒。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 20,
    otherNightsOrder: 11,
  },
  mathematician: {
    id: 'mathematician',
    name: '数学家',
    nameEn: 'Mathematician',
    type: 'townsfolk',
    ability: '每个夜晚，你会得知从上个黄昏开始有多少玩家的能力效果异常（与正常情况不同）。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 51,
    otherNightsOrder: 70,
  },
  flowergirl: {
    id: 'flowergirl',
    name: '卖花女',
    nameEn: 'Flowergirl',
    type: 'townsfolk',
    ability: '每个夜晚*，你会得知恶魔今天白天是否进行了投票。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 57,
  },
  town_crier: {
    id: 'town_crier',
    name: '召集人',
    nameEn: 'Town Crier',
    type: 'townsfolk',
    ability: '每个夜晚*，你会得知今天是否有爪牙进行了提名。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 58,
  },
  oracle: {
    id: 'oracle',
    name: '神谕者',
    nameEn: 'Oracle',
    type: 'townsfolk',
    ability: '每个夜晚*，你会得知已死亡的玩家中有多少名邪恶玩家。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 59,
  },
  savant: {
    id: 'savant',
    name: '学者',
    nameEn: 'Savant',
    type: 'townsfolk',
    ability: '每天白天，你可以去找说书人获取两条信息，其中一条是真的，另一条是假的。',
    firstNight: false,
    otherNights: false,
  },
  seamstress: {
    id: 'seamstress',
    name: '裁缝师',
    nameEn: 'Seamstress',
    type: 'townsfolk',
    ability: '游戏中一次，在夜晚选择两名玩家（非你自己），你会得知他们是否属于同一阵营。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 43,
    otherNightsOrder: 60,
  },
  philosopher: {
    id: 'philosopher',
    name: '哲学家',
    nameEn: 'Philosopher',
    type: 'townsfolk',
    ability: '游戏中一次，在夜晚选择一个善良角色，你获得该角色的能力。如果该角色已在场，该玩家会中毒。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 2,
    otherNightsOrder: 2,
  },
  artist: {
    id: 'artist',
    name: '艺术家',
    nameEn: 'Artist',
    type: 'townsfolk',
    ability: '游戏中一次，在白天你可以私下向说书人问一个是或否的问题。',
    firstNight: false,
    otherNights: false,
  },
  juggler: {
    id: 'juggler',
    name: '杂耍师',
    nameEn: 'Juggler',
    type: 'townsfolk',
    ability: '在你的首个白天，你可以公开猜测最多五名玩家各自的角色。那天夜晚，你会得知你猜对了几个。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 61,
  },
  sage: {
    id: 'sage',
    name: '贤者',
    nameEn: 'Sage',
    type: 'townsfolk',
    ability: '如果恶魔杀死了你，你会得知两名玩家，其中一名是恶魔。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 42,
  },

  // ===========================================================================
  // Sects & Violets (梦中杀机) - Outsiders
  // ===========================================================================
  mutant: {
    id: 'mutant',
    name: '突变者',
    nameEn: 'Mutant',
    type: 'outsider',
    ability: '如果你在白天被"出柜"（声称自己是外来者），你可能会被立即处决。',
    firstNight: false,
    otherNights: false,
  },
  sweetheart: {
    id: 'sweetheart',
    name: '甜心人',
    nameEn: 'Sweetheart',
    type: 'outsider',
    ability: '当你死亡时，一名玩家会中毒直到游戏结束。',
    firstNight: false,
    otherNights: false,
  },
  barber: {
    id: 'barber',
    name: '理发师',
    nameEn: 'Barber',
    type: 'outsider',
    ability: '如果你在夜晚死亡，恶魔可以选择两名玩家（非自己），让他们交换角色。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 40,
  },
  klutz: {
    id: 'klutz',
    name: '笨蛋',
    nameEn: 'Klutz',
    type: 'outsider',
    ability: '当你得知你死亡时，你需要公开选择一名存活的玩家。如果该玩家是邪恶的，你的阵营失败。',
    firstNight: false,
    otherNights: false,
  },

  // ===========================================================================
  // Sects & Violets (梦中杀机) - Minions
  // ===========================================================================
  evil_twin: {
    id: 'evil_twin',
    name: '邪恶双胞胎',
    nameEn: 'Evil Twin',
    type: 'minion',
    ability: '你和一名善良玩家互相知道对方。如果善良的双胞胎被处决，邪恶阵营获胜。善良玩家无法通过处决获胜。',
    firstNight: true,
    otherNights: false,
    firstNightOrder: 23,
  },
  witch: {
    id: 'witch',
    name: '女巫',
    nameEn: 'Witch',
    type: 'minion',
    ability: '每个夜晚，选择一名玩家。如果该玩家明天进行了提名，该玩家会立即死亡。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 24,
    otherNightsOrder: 14,
  },
  cerenovus: {
    id: 'cerenovus',
    name: '恶魔法师',
    nameEn: 'Cerenovus',
    type: 'minion',
    ability: '每个夜晚，选择一名玩家和一个善良角色。该玩家明天白天必须声称自己是该角色，否则可能会被处决。',
    firstNight: true,
    otherNights: true,
    firstNightOrder: 25,
    otherNightsOrder: 15,
  },
  pit_hag: {
    id: 'pit_hag',
    name: '坑婆',
    nameEn: 'Pit-Hag',
    type: 'minion',
    ability: '每个夜晚*，选择一名玩家和一个角色。该玩家变为该角色（如果该角色不在场）。如果此角色与原角色阵营不同，该玩家的阵营也会改变。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 16,
  },

  // ===========================================================================
  // Sects & Violets (梦中杀机) - Demons
  // ===========================================================================
  fang_gu: {
    id: 'fang_gu',
    name: '蟲蛇',
    nameEn: 'Fang Gu',
    type: 'demon',
    ability: '每个夜晚*，选择一名玩家，该玩家死亡。你第一次选择外来者时，你死亡而该外来者变为蟲蛇并转变为邪恶阵营。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 30,
  },
  vigormortis: {
    id: 'vigormortis',
    name: '蝎尸魔',
    nameEn: 'Vigormortis',
    type: 'demon',
    ability: '每个夜晚*，选择一名玩家，该玩家死亡。爪牙死亡后仍保留能力。如果你杀死的玩家是爪牙的邻座，该爪牙也会保持能力但邻座中毒。场上少一名外来者。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 31,
  },
  no_dashii: {
    id: 'no_dashii',
    name: '毒恶魔',
    nameEn: 'No Dashii',
    type: 'demon',
    ability: '每个夜晚*，选择一名玩家，该玩家死亡。你最近的两个镇民邻座中毒。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 32,
  },
  vortox: {
    id: 'vortox',
    name: '惑世魔',
    nameEn: 'Vortox',
    type: 'demon',
    ability: '每个夜晚*，选择一名玩家，该玩家死亡。镇民的能力会得到错误信息。每次处决时，如果被提名的玩家是善良的，该玩家死亡。',
    firstNight: false,
    otherNights: true,
    otherNightsOrder: 33,
  },
};

// -----------------------------------------------------------------------------
// Scripts
// -----------------------------------------------------------------------------

export const SCRIPTS = {
  'trouble-brewing': {
    id: 'trouble-brewing',
    name: '初来乍到',
    nameEn: 'Trouble Brewing',
    characters: [
      // Townsfolk
      'washerwoman', 'librarian', 'investigator', 'chef', 'empath',
      'fortune_teller', 'undertaker', 'monk', 'ravenkeeper', 'virgin',
      'slayer', 'soldier', 'mayor',
      // Outsiders
      'butler', 'drunk', 'recluse', 'saint',
      // Minions
      'poisoner', 'spy', 'scarlet_woman', 'baron',
      // Demons
      'imp',
    ],
  },
  'bad-moon-rising': {
    id: 'bad-moon-rising',
    name: '暗流涌动',
    nameEn: 'Bad Moon Rising',
    characters: [
      // Townsfolk
      'grandmother', 'sailor', 'chambermaid', 'exorcist', 'innkeeper',
      'gambler', 'gossip', 'courtier', 'professor', 'minstrel',
      'tea_lady', 'pacifist', 'fool',
      // Outsiders
      'tinker', 'moonchild', 'goon', 'lunatic',
      // Minions
      'godfather', 'devils_advocate', 'assassin', 'mastermind',
      // Demons
      'zombuul', 'pukka', 'shabaloth', 'po',
    ],
  },
  'sects-and-violets': {
    id: 'sects-and-violets',
    name: '梦中杀机',
    nameEn: 'Sects & Violets',
    characters: [
      // Townsfolk
      'clockmaker', 'dreamer', 'snake_charmer', 'mathematician',
      'flowergirl', 'town_crier', 'oracle', 'savant', 'seamstress',
      'philosopher', 'artist', 'juggler', 'sage',
      // Outsiders
      'mutant', 'sweetheart', 'barber', 'klutz',
      // Minions
      'evil_twin', 'witch', 'cerenovus', 'pit_hag',
      // Demons
      'fang_gu', 'vigormortis', 'no_dashii', 'vortox',
    ],
  },
};

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

/**
 * Get all character data objects for a given script.
 * @param {string} scriptId - The script ID (e.g. 'trouble-brewing')
 * @returns {Array<Object>} Array of character data objects
 */
export function getCharactersByScript(scriptId) {
  const script = SCRIPTS[scriptId];
  if (!script) return [];
  return script.characters
    .map((id) => CHARACTERS[id])
    .filter(Boolean);
}

/**
 * Filter an array of character objects by type.
 * @param {Array<Object>} characters - Array of character data objects
 * @param {string} type - One of 'townsfolk', 'outsider', 'minion', 'demon'
 * @returns {Array<Object>} Filtered array
 */
export function getCharactersByType(characters, type) {
  return characters.filter((c) => c.type === type);
}
